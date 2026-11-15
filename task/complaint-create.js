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
  const openComplaintCache = new Map();
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
      ? '<span class="complaint-button-spinner" aria-hidden="true"></span> Creating...'
      : '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Create complaint';
  }

  async function getOpenComplaints(user) {
    const cacheKey = `${user.window}|${user.userId}`;
    if (openComplaintCache.has(cacheKey)) {
      return openComplaintCache.get(cacheKey);
    }
    const request = fetch(`${API_BASE}/${user.window}/heroesocr_user_complaints/${encodeURIComponent(user.userId)}`, {
      cache: "no-store"
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return (data.rows || []).filter((row) => cleanText(row.status).toLowerCase() === "open");
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

  async function decorateOpenComplaintState(card, user) {
    try {
      const openComplaints = await getOpenComplaints(user);
      if (!card.isConnected || !openComplaints.length) {
        return;
      }
      addOpenComplaintBadge(card);
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
        <button class="complaint-warning-continue" type="button">Create anyway</button>
      </div>
    `;
    warning.classList.remove("hidden");
    warning.querySelector(".complaint-warning-cancel").addEventListener("click", () => {
      warning.classList.add("hidden");
    });
    warning.querySelector(".complaint-warning-continue").addEventListener("click", () => {
      createComplaint(card, user, true);
    });
  }

  async function createComplaint(card, user, skipDuplicateCheck = false) {
    const category = card.querySelector(".complaint-category");
    const detail = card.querySelector(".complaint-additional-detail");
    const callingPhone = card.querySelector(".complaint-calling-phone");
    const team = card.querySelector(".complaint-service-team");
    const mode = card.querySelector(".complaint-mode");
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

    const phone = cleanText(callingPhone.value);
    const payload = {
      user_id: user.userId,
      name: user.name,
      address: user.address,
      reason: category.value,
      additional_detail: category.value === "Other" ? cleanText(detail.value) : "",
      Mode: mode.value,
      Power: user.power,
      Phone: phone || user.registeredPhone,
      registered_phone: user.registeredPhone,
      calling_phone: phone,
      Team: team.value,
      pon: user.pon
    };

    try {
      const response = await fetch(`${API_BASE}/${user.window}/mark_complain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      const succeeded = response.ok && (data.status === "ok" || data.ok === true || data.demo === true);
      if (!succeeded) {
        throw new Error(data.message || data.detail || `HTTP ${response.status}`);
      }
      openComplaintCache.delete(`${user.window}|${user.userId}`);
      users = users.filter((item) => !(item.window === user.window && item.userId === user.userId));
      closeModal();
      notify("Complaint created successfully", true);
      window.dispatchEvent(new CustomEvent("task:complaint-created", {
        detail: { window: user.window, userId: user.userId }
      }));
    } catch (error) {
      notify(`Complaint creation failed: ${error.message}`);
      setCardBusy(card, false);
    }
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
        <label>Service team
          <select class="complaint-service-team">
            <option>TeamAmanwiz</option>
            <option>TeamMedanta</option>
            <option>TeamSevai</option>
          </select>
        </label>
        <label>Mode
          <select class="complaint-mode"><option>Manual</option><option>Auto</option></select>
        </label>
      </div>
      <div class="complaint-duplicate-warning hidden"></div>
      <div class="complaint-card-actions">
        <button class="button complaint-create-submit" type="button"><i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Create complaint</button>
      </div>
    `;
    cardUsers.set(card, user);
    card.querySelector(".complaint-service-team").value = defaultTeam(user.window);
    const category = card.querySelector(".complaint-category");
    const detailField = card.querySelector(".complaint-detail-field");
    category.addEventListener("change", () => {
      const showDetail = category.value === "Other";
      detailField.classList.toggle("hidden", !showDetail);
      if (!showDetail) {
        detailField.querySelector("input").value = "";
      }
    });
    card.querySelector(".complaint-create-submit").addEventListener("click", () => createComplaint(card, user));
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
    if (query.length < 3) {
      status.textContent = usersLoaded
        ? `${users.length} users ready. Type at least 3 characters to search.`
        : "Type at least 3 characters to search.";
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
    modal.classList.remove("open");
    document.body.classList.remove("complaint-modal-open");
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
