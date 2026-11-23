(() => {
  const trigger = document.getElementById("newComplaintButton");
  if (!trigger) {
    return;
  }

  const API_BASE = window.TASK_API_BASE || "https://app2.vbo.co.in";
  const WINDOWS = ["AMANWIZ", "MEDANTA", "SEVAI"];
  const RESULT_LIMIT = 24;
  const CATEGORIES = [
    "Red light",
    "Bad power no net",
    "Frequent speed problem",
    "Device change",
    "Shifting request",
    "Device recovery",
    "Other problem"
  ];
  let users = [];
  let usersLoaded = false;
  let loadingPromise = null;
  let searchTimer = null;
  let toastTimer = null;
  let complaintCreationBusy = false;
  const openComplaintCache = new Map();
  const taskRowsCache = new Map();
  let teamMembersPromise = null;
  const cardUsers = new WeakMap();

  function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function valueOf(row, ...keys) {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key];
      }
    }
    return "";
  }

  function defaultTeam(windowName) {
    return `Team${windowName.charAt(0)}${windowName.slice(1).toLowerCase()}`;
  }

  function splitNames(value) {
    return cleanText(value)
      .split(",")
      .map((name) => cleanText(name))
      .filter(Boolean);
  }

  function nowLucknow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date()).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  function isAdminPage() {
    return /admin/i.test(document.title);
  }

  function currentActor() {
    if (isAdminPage()) {
      return "Admin";
    }
    return cleanText(localStorage.getItem("taskManagerName")) || "Manager";
  }

  function normalizeUser(row, windowName) {
    const user = {
      window: windowName,
      userId: cleanText(valueOf(row, "Users", "user_id", "User ID")),
      name: cleanText(valueOf(row, "Name", "name")),
      registeredPhone: cleanText(valueOf(row, "Registered no", "registered_phone", "primary_phone", "Phone")),
      callingPhone: cleanText(valueOf(row, "Calling no", "calling_phone", "Last called no")),
      pon: cleanText(valueOf(row, "PON", "pon")),
      address: cleanText(valueOf(row, "Location", "address")),
      power: valueOf(row, "Power", "power", "rxPower"),
      mac: cleanText(valueOf(row, "MAC", "mac")),
      serial: cleanText(valueOf(row, "Serial", "serial")),
      lastStatus: cleanText(valueOf(row, "Last status", "last_status")),
      status: cleanText(valueOf(row, "User status", "statusUpDown", "status_up_down")).toUpperCase(),
      raw: row
    };
    if (!user.lastStatus) {
      user.lastStatus = [
        cleanText(valueOf(row, "down_time", "Drops")),
        cleanText(valueOf(row, "downEvent", "down_event"))
      ].filter(Boolean).join(" / ");
    }
    user.searchText = [
      user.window,
      user.userId,
      user.name,
      user.registeredPhone,
      user.callingPhone,
      user.pon,
      user.address,
      user.mac,
      user.serial
    ].join(" ").toLowerCase();
    return user;
  }

  function notify(message, success = false) {
    const toast = document.getElementById("toast");
    if (!toast) {
      return;
    }
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("success", success);
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("show", "success");
    }, 2800);
  }

  const modal = document.createElement("div");
  modal.className = "modal-backdrop complaint-create-backdrop";
  modal.id = "newComplaintModal";
  modal.innerHTML = `
    <div class="modal complaint-create-modal" role="dialog" aria-modal="true" aria-labelledby="newComplaintTitle">
      <div class="complaint-create-head">
        <div>
          <h2 id="newComplaintTitle">New complaint</h2>
          <p>Search users across all windows</p>
        </div>
        <button class="complaint-modal-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="complaint-global-search">
        <span class="complaint-search-icon" aria-hidden="true">⌕</span>
        <input id="complaintUserSearch" type="search" autocomplete="off" placeholder="Search User ID, name, mobile, PON or address">
        <button class="complaint-reload-button" type="button" title="Reload users">Refresh</button>
      </div>
      <div class="complaint-search-status" id="complaintSearchStatus">Type at least 3 characters to search.</div>
      <div class="complaint-search-results" id="complaintSearchResults"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const searchInput = modal.querySelector("#complaintUserSearch");
  const status = modal.querySelector("#complaintSearchStatus");
  const results = modal.querySelector("#complaintSearchResults");
  const closeButton = modal.querySelector(".complaint-modal-close");
  const reloadButton = modal.querySelector(".complaint-reload-button");
  const modalSubtitle = modal.querySelector(".complaint-create-head p");

  async function loadUsers(force = false) {
    if (usersLoaded && !force) {
      return users;
    }
    if (loadingPromise && !force) {
      return loadingPromise;
    }
    status.textContent = "Loading users from all windows...";
    reloadButton.disabled = true;
    loadingPromise = Promise.all(WINDOWS.map(async (windowName) => {
      try {
        const response = await fetch(`${API_BASE}/${windowName}/complains`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return { windowName, rows: data.rows || [], failed: false };
      } catch (error) {
        return { windowName, rows: [], failed: true };
      }
    })).then((windowResults) => {
      const uniqueUsers = new Map();
      windowResults.forEach(({ windowName, rows }) => {
        rows.forEach((row) => {
          const user = normalizeUser(row, windowName);
          const key = `${windowName}|${user.userId || user.pon || user.registeredPhone}`;
          if (key !== `${windowName}|`) {
            uniqueUsers.set(key, user);
          }
        });
      });
      users = Array.from(uniqueUsers.values());
      usersLoaded = true;
      const failed = windowResults.filter((item) => item.failed).map((item) => item.windowName);
      status.textContent = failed.length
        ? `${users.length} users loaded. ${failed.join(", ")} could not be loaded.`
        : `${users.length} users ready. Type at least 3 characters to search.`;
      return users;
    }).finally(() => {
      reloadButton.disabled = false;
      loadingPromise = null;
    });
    return loadingPromise;
  }

  function categoryOptions() {
    return [
      '<option value="">Select task category</option>',
      ...CATEGORIES.map((category) => {
        const value = category === "Other problem" ? "Other" : category;
        return `<option value="${escapeHtml(value)}">${escapeHtml(category)}</option>`;
      })
    ].join("");
  }

  function formatPower(value) {
    if (value === "" || value === null || value === undefined) {
      return "-";
    }
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : cleanText(value);
  }

  function setCardBusy(card, busy) {
    const button = card.querySelector(".complaint-create-submit");
    button.disabled = busy;
    button.innerHTML = busy
      ? '<span class="complaint-button-spinner" aria-hidden="true"></span> Checking...'
      : '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Mark complaint';
  }

  function getTaskRows(windowName, force = false) {
    if (force) {
      taskRowsCache.delete(windowName);
    }
    if (taskRowsCache.has(windowName)) {
      return taskRowsCache.get(windowName);
    }
    const request = fetch(`${API_BASE}/${windowName}/tasks`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.tables?.complaints?.rows || [];
      })
      .catch((error) => {
        taskRowsCache.delete(windowName);
        throw error;
      });
    taskRowsCache.set(windowName, request);
    window.setTimeout(() => taskRowsCache.delete(windowName), 30000);
    return request;
  }

  function getTeamMembers(force = false) {
    if (force) {
      teamMembersPromise = null;
    }
    if (teamMembersPromise) {
      return teamMembersPromise;
    }
    teamMembersPromise = fetch(`${API_BASE}/team-config`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return (data.members || []).map((member) => cleanText(member.name)).filter(Boolean);
      })
      .catch((error) => {
        teamMembersPromise = null;
        throw error;
      });
    return teamMembersPromise;
  }

  async function getOpenComplaints(user, force = false) {
    const cacheKey = `${user.window}|${user.userId}`;
    if (force) {
      openComplaintCache.delete(cacheKey);
      taskRowsCache.delete(user.window);
    }
    if (openComplaintCache.has(cacheKey)) {
      return openComplaintCache.get(cacheKey);
    }
    const request = Promise.all([
      fetch(`${API_BASE}/${user.window}/heroesocr_user_complaints/${encodeURIComponent(user.userId)}`, {
        cache: "no-store"
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return (data.rows || []).filter((row) => cleanText(row.status).toLowerCase() === "open");
      }),
      getTaskRows(user.window).catch(() => [])
    ]).then(([complaints, taskRows]) => {
      const taskById = new Map(taskRows.map((row) => [String(row.id || row.complaint_id || ""), row]));
      return complaints.map((complaint) => {
        const taskRow = taskById.get(String(complaint.id || complaint.complaint_id || ""));
        return taskRow ? { ...complaint, ...taskRow } : complaint;
      });
    }).catch((error) => {
      openComplaintCache.delete(cacheKey);
      throw error;
    });
    openComplaintCache.set(cacheKey, request);
    window.setTimeout(() => openComplaintCache.delete(cacheKey), 30000);
    return request;
  }

  function addOpenComplaintBadge(card) {
    const nameHolder = card.querySelector(".complaint-card-name");
    if (!nameHolder || nameHolder.querySelector(".complaint-open-badge")) {
      return;
    }
    const badge = document.createElement("span");
    badge.className = "complaint-open-badge";
    badge.title = "Already has open complaints";
    badge.setAttribute("aria-label", "Already has open complaints");
    badge.textContent = "⚠️";
    nameHolder.appendChild(badge);
  }

  function clearOpenComplaintState(card) {
    card.classList.remove("complaint-state-blink");
    card.querySelector(".complaint-open-badge")?.remove();
    const holder = card.querySelector(".complaint-existing");
    if (holder) {
      holder.innerHTML = "";
      holder.classList.add("hidden");
    }
  }

  function complaintDeletePayload(row) {
    return {
      complaint_id: row.id || row.complaint_id || "",
      user_id: valueOf(row, "user_id"),
      name: valueOf(row, "name"),
      address: valueOf(row, "address"),
      reason: valueOf(row, "reason"),
      additional_detail: valueOf(row, "additional_detail"),
      Mode: valueOf(row, "Mode"),
      Power: valueOf(row, "Power", "power", "rxPower"),
      Phone: valueOf(row, "Phone", "phone", "mobile"),
      Team: valueOf(row, "Team", "takenby"),
      pon: valueOf(row, "pon")
    };
  }

  async function refreshOpenComplaintState(card, user) {
    clearOpenComplaintState(card);
    try {
      const openComplaints = await getOpenComplaints(user, true);
      if (!card.isConnected || !openComplaints.length) {
        return;
      }
      addOpenComplaintBadge(card);
      renderOpenComplaints(card, user, openComplaints);
      if (user.status === "UP") {
        card.classList.add("complaint-state-blink");
      }
    } catch (error) {
      notify(`Complaint status refresh failed: ${error.message}`);
    }
  }

  async function removeOpenComplaint(card, user, row, button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Removing...";
    try {
      const response = await fetch(`${API_BASE}/${user.window}/delete_complain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintDeletePayload(row))
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || (data.status !== "ok" && data.status !== "skipped")) {
        throw new Error(data.message || data.detail || `HTTP ${response.status}`);
      }
      notify("Complaint removed successfully", true);
      await refreshOpenComplaintState(card, user);
      window.dispatchEvent(new CustomEvent("task:complaint-created", {
        detail: { window: user.window, userId: user.userId }
      }));
    } catch (error) {
      notify(`Remove failed: ${error.message}`);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function saveComplaintAssignment(card, user, row, panel, button) {
    const selected = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => cleanText(input.value))
      .filter(Boolean);
    if (!selected.length) {
      notify("Select minimum 1 team member");
      return;
    }
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Saving...";
    const payload = {
      task: cleanText(row.task) || "Pending",
      actiontime: nowLucknow(),
      unpickremark: row.unpickremark || "",
      usermail: currentActor(),
      takenby: selected.join(",")
    };
    if (isAdminPage()) {
      payload._admin = true;
      payload.created_at = row.created_at || "";
    }
    try {
      const complaintId = row.id || row.complaint_id;
      const response = await fetch(`${API_BASE}/${user.window}/tasks/complaints/${complaintId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP ${response.status}`);
      }
      notify("Team assigned successfully", true);
      await refreshOpenComplaintState(card, user);
      window.dispatchEvent(new CustomEvent("task:complaint-created", {
        detail: { window: user.window, userId: user.userId }
      }));
    } catch (error) {
      notify(`Assignment failed: ${error.message}`);
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function openAssignmentPanel(card, user, row, panel) {
    if (panel.dataset.loaded === "1") {
      panel.classList.toggle("hidden");
      return;
    }
    panel.classList.remove("hidden");
    panel.innerHTML = '<span class="complaint-action-loading">Loading team...</span>';
    try {
      const selected = splitNames(row.takenby);
      const members = Array.from(new Set([...(await getTeamMembers()), ...selected])).sort();
      if (!members.length) {
        throw new Error("No team members configured");
      }
      panel.innerHTML = `
        <div class="complaint-assignment-options">
          ${members.map((name) => `
            <label><input type="checkbox" value="${escapeHtml(name)}" ${selected.includes(name) ? "checked" : ""}><span>${escapeHtml(name)}</span></label>
          `).join("")}
        </div>
        <div class="complaint-assignment-footer">
          <button class="complaint-action-cancel" type="button">Cancel</button>
          <button class="complaint-assignment-save" type="button">Save team</button>
        </div>
      `;
      panel.dataset.loaded = "1";
      panel.querySelector(".complaint-action-cancel").addEventListener("click", () => panel.classList.add("hidden"));
      const saveButton = panel.querySelector(".complaint-assignment-save");
      saveButton.addEventListener("click", () => saveComplaintAssignment(card, user, row, panel, saveButton));
    } catch (error) {
      panel.innerHTML = `<span class="complaint-action-error">Team load failed: ${escapeHtml(error.message)}</span>`;
    }
  }

  async function assignCreatedComplaint(user, complaintId, selected) {
    const payload = {
      task: "Pending",
      actiontime: nowLucknow(),
      unpickremark: "",
      usermail: currentActor(),
      takenby: selected.join(",")
    };
    const response = await fetch(`${API_BASE}/${user.window}/tasks/complaints/${complaintId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || `HTTP ${response.status}`);
    }
  }

  function showCreatedUnallocatedOutcome(card, user, message) {
    modalSubtitle.textContent = "Complaint saved";
    closeButton.title = "Close";
    closeButton.setAttribute("aria-label", "Close");
    const choice = card.querySelector(".complaint-post-create");
    choice.innerHTML = `
      <div class="complaint-post-create-head">
        <span class="complaint-success-icon" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
        <div>
          <strong>Complaint created</strong>
          <span class="complaint-post-create-copy">Currently unallocated</span>
        </div>
      </div>
      <div class="complaint-post-identity">
        <strong>${escapeHtml(user.name || "Unknown user")}</strong>
        <span>${escapeHtml(user.userId || "-")}</span>
        <span class="complaint-window-badge">${escapeHtml(user.window)}</span>
      </div>
      <span class="complaint-action-error">${escapeHtml(message)}</span>
      <div class="complaint-post-create-actions complaint-post-create-actions-single">
        <button class="complaint-post-keep" type="button"><i class="fa-solid fa-xmark" aria-hidden="true"></i> Close</button>
      </div>
    `;
    choice.querySelector(".complaint-post-keep").addEventListener("click", closeModal);
  }

  async function createComplaint(card, user, selected, button) {
    if (complaintCreationBusy) {
      return;
    }
    const category = card.querySelector(".complaint-category");
    const detail = card.querySelector(".complaint-additional-detail");
    const callingPhone = card.querySelector(".complaint-calling-phone");
    const mode = card.querySelector(".complaint-mode");
    const phone = cleanText(callingPhone.value);
    const payload = {
      user_id: user.userId,
      name: user.name,
      address: user.address,
      reason: category.value,
      additional_detail: category.value === "Other" ? cleanText(detail.value) : "",
      Mode: category.value === "Other" ? mode.value : "Auto",
      Power: user.power,
      Phone: phone || user.registeredPhone,
      registered_phone: user.registeredPhone,
      calling_phone: phone,
      Team: defaultTeam(user.window),
      pon: user.pon
    };
    const choice = card.querySelector(".complaint-post-create");
    const choiceButtons = Array.from(choice.querySelectorAll("button"));
    const originalText = button.innerHTML;
    complaintCreationBusy = true;
    closeButton.disabled = true;
    choiceButtons.forEach((item) => { item.disabled = true; });
    button.innerHTML = '<span class="complaint-button-spinner" aria-hidden="true"></span> Creating...';

    let data;
    try {
      const response = await fetch(`${API_BASE}/${user.window}/mark_complain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      data = await response.json().catch(() => ({}));
      const succeeded = response.ok && (data.status === "ok" || data.ok === true || data.demo === true);
      if (!succeeded) {
        throw new Error(data.message || data.detail || `HTTP ${response.status}`);
      }
    } catch (error) {
      complaintCreationBusy = false;
      closeButton.disabled = false;
      notify(`Complaint creation failed: ${error.message}`);
      choiceButtons.forEach((item) => { item.disabled = false; });
      button.innerHTML = originalText;
      return;
    }

    openComplaintCache.delete(`${user.window}|${user.userId}`);
    taskRowsCache.delete(user.window);
    users = users.filter((item) => !(item.window === user.window && item.userId === user.userId));
    window.dispatchEvent(new CustomEvent("task:complaint-created", {
      detail: { window: user.window, userId: user.userId }
    }));

    if (!selected.length) {
      complaintCreationBusy = false;
      closeButton.disabled = false;
      notify("Complaint created unallocated", true);
      closeModal();
      return;
    }

    const complaintId = data.id || data.complaint_id || data.row?.id;
    if (!complaintId) {
      complaintCreationBusy = false;
      closeButton.disabled = false;
      notify("Complaint created, but team assignment could not start.");
      showCreatedUnallocatedOutcome(card, user, "Complaint ID was not returned. Assign it later from Open Complaints.");
      return;
    }

    button.innerHTML = '<span class="complaint-button-spinner" aria-hidden="true"></span> Assigning...';
    try {
      await assignCreatedComplaint(user, complaintId, selected);
      complaintCreationBusy = false;
      closeButton.disabled = false;
      button.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Created & assigned';
      notify("Complaint created and team assigned", true);
      window.setTimeout(closeModal, 700);
    } catch (error) {
      complaintCreationBusy = false;
      closeButton.disabled = false;
      notify(`Complaint created, but assignment failed: ${error.message}`);
      showCreatedUnallocatedOutcome(card, user, `Team assignment failed: ${error.message}. Assign it later from Open Complaints.`);
    }
  }

  async function createAssignedComplaint(card, user, panel, button) {
    const selected = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => cleanText(input.value))
      .filter(Boolean);
    if (!selected.length) {
      notify("Select minimum 1 team member");
      return;
    }
    await createComplaint(card, user, selected, button);
  }

  async function openPreCreateAssignment(card, user, panel) {
    const toggle = card.querySelector(".complaint-post-assign");
    const actions = card.querySelector(".complaint-post-create-actions");
    actions.classList.add("hidden");
    if (panel.dataset.loaded === "1") {
      panel.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
      return;
    }
    panel.classList.remove("hidden");
    toggle.setAttribute("aria-expanded", "true");
    panel.innerHTML = '<span class="complaint-action-loading">Loading team members...</span>';
    try {
      const members = Array.from(new Set(await getTeamMembers())).sort();
      if (!members.length) {
        throw new Error("No team members configured");
      }
      panel.innerHTML = `
        <div class="complaint-post-assignment-title">Select team members</div>
        <div class="complaint-assignment-options">
          ${members.map((name) => `
            <label><input type="checkbox" value="${escapeHtml(name)}"><span>${escapeHtml(name)}</span></label>
          `).join("")}
        </div>
        <div class="complaint-assignment-footer">
          <button class="complaint-action-cancel" type="button">Back</button>
          <button class="complaint-assignment-save" type="button"><i class="fa-solid fa-user-check" aria-hidden="true"></i> Create & assign</button>
        </div>
      `;
      panel.dataset.loaded = "1";
      panel.querySelector(".complaint-action-cancel").addEventListener("click", () => {
        panel.classList.add("hidden");
        actions.classList.remove("hidden");
        toggle.setAttribute("aria-expanded", "false");
      });
      const saveButton = panel.querySelector(".complaint-assignment-save");
      saveButton.addEventListener("click", () => createAssignedComplaint(card, user, panel, saveButton));
    } catch (error) {
      panel.innerHTML = `
        <span class="complaint-action-error">Team load failed: ${escapeHtml(error.message)}. No complaint was created.</span>
        <div class="complaint-assignment-footer"><button class="complaint-action-cancel" type="button">Back</button></div>
      `;
      panel.querySelector(".complaint-action-cancel").addEventListener("click", () => {
        panel.classList.add("hidden");
        actions.classList.remove("hidden");
        toggle.setAttribute("aria-expanded", "false");
      });
    }
  }

  function showPreCreateChoice(card, user) {
    modal.classList.add("complaint-post-create-mode");
    results.classList.add("complaint-post-create-active");
    card.classList.add("complaint-created-card");
    card.querySelector(".complaint-existing")?.classList.add("hidden");
    card.querySelector(".complaint-create-fields")?.classList.add("hidden");
    card.querySelector(".complaint-duplicate-warning")?.classList.add("hidden");
    card.querySelector(".complaint-card-actions")?.classList.add("hidden");
    modalSubtitle.textContent = "";
    closeButton.title = "Close — cancel complaint";
    closeButton.setAttribute("aria-label", "Close — cancel complaint");
    const choice = card.querySelector(".complaint-post-create");
    choice.innerHTML = `
      <div class="complaint-post-create-head">
        <span class="complaint-success-icon" aria-hidden="true"><i class="fa-solid fa-clipboard-check"></i></span>
        <div>
          <strong>Ready to create complaint</strong>
        </div>
      </div>
      <div class="complaint-post-identity">
        <strong>${escapeHtml(user.name || "Unknown user")}</strong>
        <span>${escapeHtml(user.userId || "-")}</span>
        <span class="complaint-window-badge">${escapeHtml(user.window)}</span>
      </div>
      <div class="complaint-post-create-actions">
        <button class="complaint-post-assign" type="button" aria-expanded="false"><i class="fa-solid fa-users" aria-hidden="true"></i> Create & assign</button>
        <button class="complaint-post-keep" type="button"><i class="fa-regular fa-clock" aria-hidden="true"></i> Create unallocated</button>
      </div>
      <div class="complaint-post-assignment hidden"></div>
      <p class="complaint-post-safe-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Closing this window cancels the action; no complaint will be created.</p>
    `;
    choice.classList.remove("hidden");
    status.textContent = "Review complete. Choose the final action.";
    choice.querySelector(".complaint-post-keep").addEventListener("click", (event) => {
      createComplaint(card, user, [], event.currentTarget);
    });
    const panel = choice.querySelector(".complaint-post-assignment");
    choice.querySelector(".complaint-post-assign").addEventListener("click", () => {
      openPreCreateAssignment(card, user, panel);
    });
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderOpenComplaints(card, user, openComplaints) {
    const holder = card.querySelector(".complaint-existing");
    if (!holder) {
      return;
    }
    const allocationGroups = openComplaints.map((row) => splitNames(row.takenby));
    const allocatedCount = allocationGroups.filter((names) => names.length).length;
    const unallocatedCount = openComplaints.length - allocatedCount;
    const firstTask = cleanText(openComplaints[0]?.task) || "Pending";
    const allocationSummary = openComplaints.length === 1
      ? (allocationGroups[0].length ? `Allocated: ${allocationGroups[0].join(", ")}` : "Unallocated")
      : [
        allocatedCount ? `${allocatedCount} allocated` : "",
        unallocatedCount ? `${unallocatedCount} unallocated` : ""
      ].filter(Boolean).join(" · ");
    holder.innerHTML = `
      <button class="complaint-existing-title" type="button" aria-expanded="false">
        <span class="complaint-existing-title-main"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Open complaint${openComplaints.length === 1 ? "" : "s"} (${openComplaints.length})</span>
        <span class="complaint-existing-title-meta">${escapeHtml(allocationSummary)}${openComplaints.length === 1 ? ` · ${escapeHtml(firstTask)}` : ""} <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></span>
      </button>
      <div class="complaint-existing-body hidden"></div>
    `;
    const toggle = holder.querySelector(".complaint-existing-title");
    const body = holder.querySelector(".complaint-existing-body");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.classList.toggle("expanded", expanded);
      body.classList.toggle("hidden", !expanded);
    });
    openComplaints.forEach((row) => {
      const assignedNames = splitNames(row.takenby);
      const task = cleanText(row.task) || "Pending";
      const isRunning = task.toLowerCase() === "pick";
      const item = document.createElement("div");
      item.className = "complaint-existing-item";
      item.innerHTML = `
        <div class="complaint-existing-summary">
          <strong>${escapeHtml(cleanText(row.reason) || "Reason not provided")}</strong>
          <span class="complaint-allocation ${assignedNames.length ? "allocated" : "unallocated"}">
            <i class="fa-solid ${assignedNames.length ? "fa-user-check" : "fa-user-clock"}" aria-hidden="true"></i>
            ${assignedNames.length ? `Allocated: ${escapeHtml(assignedNames.join(", "))}` : "Unallocated"}
          </span>
          <span class="complaint-task-badge">${escapeHtml(task)}</span>
        </div>
        <div class="complaint-existing-actions"></div>
        <div class="complaint-assignment-panel hidden"></div>
        <div class="complaint-remove-panel hidden">
          <span>Remove this complaint?</span>
          <button class="complaint-action-cancel" type="button">Cancel</button>
          <button class="complaint-remove-confirm" type="button">Yes, remove</button>
        </div>
      `;
      const actions = item.querySelector(".complaint-existing-actions");
      const complaintId = row.id || row.complaint_id;
      if (complaintId && !isRunning) {
        const assignButton = document.createElement("button");
        assignButton.className = "complaint-assign-toggle";
        assignButton.type = "button";
        assignButton.innerHTML = `<i class="fa-solid fa-users" aria-hidden="true"></i> ${assignedNames.length ? "Change team" : "Assign"}`;
        const assignmentPanel = item.querySelector(".complaint-assignment-panel");
        assignButton.addEventListener("click", () => openAssignmentPanel(card, user, row, assignmentPanel));
        actions.appendChild(assignButton);
      }
      const removeButton = document.createElement("button");
      removeButton.className = "complaint-remove-toggle";
      removeButton.type = "button";
      removeButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Remove';
      const removePanel = item.querySelector(".complaint-remove-panel");
      removeButton.addEventListener("click", () => removePanel.classList.remove("hidden"));
      removePanel.querySelector(".complaint-action-cancel").addEventListener("click", () => removePanel.classList.add("hidden"));
      const confirmButton = removePanel.querySelector(".complaint-remove-confirm");
      confirmButton.addEventListener("click", () => removeOpenComplaint(card, user, row, confirmButton));
      actions.appendChild(removeButton);
      body.appendChild(item);
    });
    holder.classList.remove("hidden");
  }

  async function decorateOpenComplaintState(card, user) {
    try {
      const openComplaints = await getOpenComplaints(user);
      if (!card.isConnected || !openComplaints.length) {
        return;
      }
      addOpenComplaintBadge(card);
      renderOpenComplaints(card, user, openComplaints);
      if (user.status === "UP") {
        card.classList.add("complaint-state-blink");
      }
    } catch (error) {
      // Status decoration is optional; complaint creation still performs its own check.
    }
  }

  const statusObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        statusObserver.unobserve(entry.target);
        const user = cardUsers.get(entry.target);
        if (user?.userId) {
          decorateOpenComplaintState(entry.target, user);
        }
      });
    }, { root: results, rootMargin: "80px" })
    : null;

  function showDuplicateWarning(card, user, openComplaints) {
    const warning = card.querySelector(".complaint-duplicate-warning");
    const reasons = openComplaints.slice(0, 2)
      .map((row) => escapeHtml(cleanText(row.reason) || "Reason not provided"))
      .join(" · ");
    warning.innerHTML = `
      <strong>${openComplaints.length} open complaint${openComplaints.length === 1 ? "" : "s"} already exist.</strong>
      ${reasons ? `<span>${reasons}</span>` : ""}
      <div>
        <button class="complaint-warning-cancel" type="button">Cancel</button>
        <button class="complaint-warning-continue" type="button">Continue anyway</button>
      </div>
    `;
    warning.classList.remove("hidden");
    warning.querySelector(".complaint-warning-cancel").addEventListener("click", () => {
      warning.classList.add("hidden");
    });
    warning.querySelector(".complaint-warning-continue").addEventListener("click", () => {
      prepareComplaint(card, user, true);
    });
  }

  async function prepareComplaint(card, user, skipDuplicateCheck = false) {
    const category = card.querySelector(".complaint-category");
    const detail = card.querySelector(".complaint-additional-detail");
    const warning = card.querySelector(".complaint-duplicate-warning");
    if (!category.value) {
      category.focus();
      notify("Select a task category");
      return;
    }
    if (category.value === "Other" && !cleanText(detail.value)) {
      detail.focus();
      notify("Enter remarks for Other category");
      return;
    }

    warning.classList.add("hidden");
    setCardBusy(card, true);
    if (!skipDuplicateCheck) {
      try {
        const openComplaints = await getOpenComplaints(user);
        if (openComplaints.length) {
          setCardBusy(card, false);
          showDuplicateWarning(card, user, openComplaints);
          return;
        }
      } catch (error) {
        // Match the existing Power UI behavior: creation can continue if duplicate lookup is unavailable.
      }
    }
    setCardBusy(card, false);
    showPreCreateChoice(card, user);
  }

  function buildCard(user) {
    const card = document.createElement("article");
    card.className = "complaint-create-card";
    const statusIcon = user.status === "UP" ? "📶" : user.status === "DOWN" ? "📵" : "💀";
    const statusLabel = user.status === "UP" ? "Online" : user.status === "DOWN" ? "Down" : "Offline / unknown";
    card.classList.add(user.status === "UP"
      ? "complaint-state-online"
      : user.status === "DOWN"
        ? "complaint-state-down"
        : "complaint-state-offline");
    card.innerHTML = `
      <div class="complaint-card-title">
        <div class="complaint-card-name"><strong>${escapeHtml(user.name || "Unknown user")}</strong></div>
        <div class="complaint-card-indicators">
          <span class="complaint-window-badge">${escapeHtml(user.window)}</span>
          <span class="complaint-status-icon" title="${statusLabel}" aria-label="${statusLabel}">${statusIcon}</span>
        </div>
      </div>
      <div class="complaint-user-facts">
        <div><span>User ID</span><strong>${escapeHtml(user.userId || "-")}</strong></div>
        <div><span>Reg No.</span><strong>${escapeHtml(user.registeredPhone || "-")}</strong></div>
        <div><span>PON</span><strong>${escapeHtml(user.pon || "-")}</strong></div>
        <div><span>Power</span><strong>${escapeHtml(formatPower(user.power))}</strong></div>
        <div class="complaint-fact-wide"><span>Location</span><strong title="${escapeHtml(user.address)}">${escapeHtml(user.address || "-")}</strong></div>
        <div class="complaint-fact-wide"><span>MAC / Serial</span><strong>${escapeHtml([user.mac, user.serial].filter(Boolean).join(" / ") || "-")}</strong></div>
        <div class="complaint-fact-wide"><span>Last status</span><strong>${escapeHtml(user.lastStatus || "-")}</strong></div>
      </div>
      <div class="complaint-existing hidden" aria-live="polite"></div>
      <div class="complaint-create-fields">
        <label>Calling No.
          <input class="complaint-calling-phone" type="tel" inputmode="tel" value="${escapeHtml(user.callingPhone || "")}" placeholder="Calling number">
        </label>
        <label>Task category
          <select class="complaint-category">${categoryOptions()}</select>
        </label>
        <label class="complaint-detail-field hidden">Remarks
          <input class="complaint-additional-detail" type="text" placeholder="Describe the issue">
        </label>
        <label class="complaint-mode-field hidden">Mode
          <select class="complaint-mode"><option>Auto</option><option>Manual</option></select>
        </label>
      </div>
      <div class="complaint-duplicate-warning hidden"></div>
      <div class="complaint-card-actions">
        <button class="button complaint-create-submit" type="button"><i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Mark complaint</button>
      </div>
      <div class="complaint-post-create hidden" aria-live="polite"></div>
    `;
    cardUsers.set(card, user);
    const category = card.querySelector(".complaint-category");
    const detailField = card.querySelector(".complaint-detail-field");
    const modeField = card.querySelector(".complaint-mode-field");
    const mode = card.querySelector(".complaint-mode");
    category.addEventListener("change", () => {
      const showDetail = category.value === "Other";
      detailField.classList.toggle("hidden", !showDetail);
      modeField.classList.toggle("hidden", !showDetail);
      if (!showDetail) {
        detailField.querySelector("input").value = "";
        mode.value = "Auto";
      }
    });
    card.querySelector(".complaint-create-submit").addEventListener("click", () => prepareComplaint(card, user));
    if (statusObserver) {
      statusObserver.observe(card);
    } else if (user.userId) {
      decorateOpenComplaintState(card, user);
    }
    return card;
  }

  function renderSearchResults() {
    const query = cleanText(searchInput.value).toLowerCase();
    results.innerHTML = "";
    if (!usersLoaded) {
      status.textContent = query.length >= 3
        ? "Users are loading. Your search will start automatically."
        : "Loading users from all windows...";
      return;
    }
    if (query.length < 3) {
      status.textContent = `${users.length} users ready. Type at least 3 characters to search.`;
      return;
    }
    const matches = users.filter((user) => user.searchText.includes(query));
    status.textContent = matches.length
      ? `${matches.length} user${matches.length === 1 ? "" : "s"} found${matches.length > RESULT_LIMIT ? ` · showing first ${RESULT_LIMIT}` : ""}`
      : "No users match this search";
    matches.slice(0, RESULT_LIMIT).forEach((user) => results.appendChild(buildCard(user)));
  }

  async function openModal() {
    modal.classList.add("open");
    document.body.classList.add("complaint-modal-open");
    searchInput.focus();
    await loadUsers();
    renderSearchResults();
  }

  function closeModal() {
    if (complaintCreationBusy) {
      notify("Please wait, complaint is being saved.");
      return;
    }
    modal.classList.remove("open");
    modal.classList.remove("complaint-post-create-mode");
    document.body.classList.remove("complaint-modal-open");
    results.classList.remove("complaint-post-create-active");
    modalSubtitle.textContent = "Search users across all windows";
    closeButton.title = "";
    closeButton.disabled = false;
    closeButton.setAttribute("aria-label", "Close");
    searchInput.value = "";
    results.innerHTML = "";
    status.textContent = usersLoaded
      ? `${users.length} users ready. Type at least 3 characters to search.`
      : "Type at least 3 characters to search.";
  }

  trigger.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderSearchResults, 180);
  });
  reloadButton.addEventListener("click", async () => {
    usersLoaded = false;
    await loadUsers(true);
    renderSearchResults();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });
})();
