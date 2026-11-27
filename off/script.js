const baseUrl = "https://app2.vbo.co.in";
let currentWindow = "ALL";
let rawRows = [];
let filtered = [];
let currentMode = "all";
let currentView = "cards";
let currentDownList = [];
const INITIAL_VISIBLE_LIMIT = 200;
const VISIBLE_BATCH_SIZE = 200;
let visibleLimit = INITIAL_VISIBLE_LIMIT;
let visibleRows = [];
let searchTimer = null;
const REMARK_OPTIONS = [
  "Red light",
  "Bad power no net",
  "Frequent speed problem",
  "Device change",
  "Shifting request",
  "Device recovery",
  "Other problem"
];

const cardContainer = document.getElementById("cardView");
const tbody = document.querySelector("#dataTable tbody");
const tableWrap = document.getElementById("tableWrap");
const spinner = document.getElementById("spinnerOverlay");
const toastEl = document.getElementById("toast");

const globalSearch = document.getElementById("globalSearch");
const powerRange = document.getElementById("powerRange");

const filterPon = document.getElementById("filterPon");
const filterTeam = document.getElementById("filterTeam");
const filterMode = document.getElementById("filterMode");
const filterStatus = document.getElementById("filterStatus");

const menuToggle = document.getElementById("menuToggle");
const topMenu = document.getElementById("topMenu");
const userCount = document.getElementById("userCount");
const btnToggleView = document.getElementById("btnToggleView");
const loadMoreBtn = document.createElement("button");
loadMoreBtn.id = "loadMoreBtn";
loadMoreBtn.type = "button";
loadMoreBtn.style.cssText = "display:none;margin:16px auto;padding:10px 18px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;font-weight:600;";
loadMoreBtn.onclick = () => {
  visibleLimit += VISIBLE_BATCH_SIZE;
  if (currentView === "cards") renderCards();
  else renderTable();
};
if (tableWrap && tableWrap.parentNode) {
  tableWrap.parentNode.insertBefore(loadMoreBtn, tableWrap.nextSibling);
}

let isComplainsView = false;

/* ===============================
   ✅ PON Excel-style multi select
================================= */
const ponMultiWrap = document.getElementById("ponMultiWrap");
const ponMultiBtn = document.getElementById("ponMultiBtn");
const ponMultiDropdown = document.getElementById("ponMultiDropdown");
const ponMultiList = document.getElementById("ponMultiList");
const ponMultiSearchInput = document.getElementById("ponMultiSearchInput");
const ponClearBtn = document.getElementById("ponClearBtn");
const ponOkBtn = document.getElementById("ponOkBtn");
let selectedPonsSet = new Set();

/* ===============================
   ✅ Modal (Popup)
================================= */
const complaintModal = document.getElementById("complaintModal");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalActions = document.getElementById("modalActions");
const btnDownUsers = document.getElementById("btnDownUsers");
const modalCloseButton = document.getElementById("modalCloseButton");
let addressModal = document.getElementById("addressModal");
if (!addressModal) {
  addressModal = document.createElement("div");
  addressModal.id = "addressModal";
  addressModal.className = "addressModalOverlay";
  addressModal.innerHTML = `
    <div class="addressModalBox">
      <div class="addressModalHead">
        <strong>Full Address</strong>
        <button class="addressModalClose" type="button">Close</button>
      </div>
      <div class="addressModalText"></div>
    </div>
  `;
  document.body.appendChild(addressModal);
}
const addressModalText = addressModal.querySelector(".addressModalText");
const addressModalClose = addressModal.querySelector(".addressModalClose");

function openInfoModal(title, text) {
  if (!addressModal) return;
  const titleEl = addressModal.querySelector('strong');
  if (titleEl) titleEl.textContent = title;
  addressModalText.textContent = text;
  addressModal.style.display = "flex";
}

function openAddressModal(address) {
  openInfoModal("Full Address", address);
}

function closeAddressModal() {
  addressModal.style.display = "none";
}

addressModalClose.onclick = closeAddressModal;
addressModal.onclick = (event) => {
  if (event.target === addressModal) {
    closeAddressModal();
  }
};

/* ===============================
   ✅ Confirmation Modal for Existing Complaints
================================= */
// Create confirmation modal if it doesn't exist
let confirmModal = document.getElementById("confirmModal");
if (!confirmModal) {
  confirmModal = document.createElement("div");
  confirmModal.id = "confirmModal";
  confirmModal.className = "modalOverlay";
  confirmModal.innerHTML = `
    <div class="modalBox" style="max-width: 400px;">
      <div class="modalHead">
        <div class="modalTitle" id="confirmModalTitle">⚠️ Already Complaints Exist</div>
        <button class="modalClose" id="confirmModalCloseBtn">Close</button>
      </div>
      <div id="confirmModalBody" style="padding: 16px 0;"></div>
      <div class="modalActions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;">
        <button id="confirmCancelBtn" class="modalCloseBtn" style="padding: 8px 16px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
        <button id="confirmContinueBtn" class="modalActionBtn" style="padding: 8px 16px; background: var(--success); color: white; border: none; border-radius: 6px; cursor: pointer;">Continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
}

const confirmModalEl = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalBody = document.getElementById("confirmModalBody");
const confirmModalCloseBtn = document.getElementById("confirmModalCloseBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmContinueBtn = document.getElementById("confirmContinueBtn");

// Variables to store pending mark action
let pendingMarkAction = null;

// Close confirmation modal handlers
function closeConfirmModal() {
  confirmModalEl.style.display = "none";
  pendingMarkAction = null;
}

if (confirmModalCloseBtn) {
  confirmModalCloseBtn.onclick = closeConfirmModal;
}

if (confirmCancelBtn) {
  confirmCancelBtn.onclick = closeConfirmModal;
}

if (confirmContinueBtn) {
  confirmContinueBtn.onclick = async () => {
    if (!pendingMarkAction) return;

    const action = pendingMarkAction;
    closeConfirmModal();

    await action(); // yaha markButton already pass hai
  };
}



if (confirmModalEl) {
  confirmModalEl.onclick = (e) => {
    if (e.target === confirmModalEl) {
      closeConfirmModal();
    }
  };
}

/* ===============================
   ✅ Toast + Spinner
================================= */
function showToast(msg, isSuccess = false) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  if (isSuccess) {
    toastEl.style.background = "#52c41a";
    toastEl.style.color = "white";
  } else {
    toastEl.style.background = "rgba(0,0,0,0.85)";
    toastEl.style.color = "white";
  }
  setTimeout(() => {
    toastEl.classList.remove("show");
    // Reset color after hide
    setTimeout(() => {
      toastEl.style.background = "rgba(0,0,0,0.85)";
    }, 300);
  }, 3000);
}

function showSpinner() { spinner.style.display = "flex"; }
function hideSpinner() { spinner.style.display = "none"; }

/* ✅ Smooth fadeout removal with scale */
function fadeOutAndRemove(el) {
  if (!el) return;
  el.classList.add("fade-remove");
  
  // Get next element to focus (for auto-scroll)
  const nextEl = el.nextElementSibling;
  
  setTimeout(() => {
    el.remove();
    
    // Auto-scroll to next item if exists
    if (nextEl && nextEl.scrollIntoView) {
      setTimeout(() => {
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect to next item
        nextEl.classList.add('highlight-pulse');
        setTimeout(() => nextEl.classList.remove('highlight-pulse'), 1000);
      }, 100);
    }

    const cardCount = document.querySelectorAll(".complaint-card").length;
    const rowCount = document.querySelectorAll("#dataTable tbody tr").length;
    const count = currentView === "cards" ? cardCount : rowCount;

    const txt = userCount.textContent || "";
    const ts = txt.includes(")") ? txt.split(")").slice(1).join(")").trim() : "";
    userCount.textContent = ts ? `(${count}) ${ts}` : `(${count})`;
  }, 450);
}

/* ===============================
   ✅ API Fetchers
================================= */
function normalizeLastStatusKey(value, alnumOnly = false) {
  const text = String(value || "").trim().toLowerCase();
  return alnumOnly ? text.replace(/[^a-z0-9]/g, "") : text;
}

function addLastStatusKey(map, prefix, value, row, alnumOnly = false) {
  const normalized = normalizeLastStatusKey(value, alnumOnly);
  if (normalized && !map.has(`${prefix}:${normalized}`)) {
    map.set(`${prefix}:${normalized}`, row);
  }
}

async function fetchLastStatusMap(windowName) {
  try {
    const res = await fetch(`${baseUrl}/${windowName}/lidownusers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const map = new Map();

    (data.drop_users || []).forEach(row => {
      addLastStatusKey(map, "user", row.user_id, row);
      addLastStatusKey(map, "mac", row.mac_address, row, true);
      addLastStatusKey(map, "serial", row.serial_number, row, true);
    });

    return map;
  } catch (err) {
    return new Map();
  }
}

function getLastStatusMatch(row, statusMap) {
  const keys = [
    `user:${normalizeLastStatusKey(row.Users || row.user_id)}`,
    `mac:${normalizeLastStatusKey(row.MAC || row.mac_address, true)}`,
    `serial:${normalizeLastStatusKey(row.Serial || row.serial_number, true)}`
  ];
  return keys.map(key => statusMap.get(key)).find(Boolean) || null;
}

function mergeLastStatus(row, statusMap) {
  const match = getLastStatusMatch(row, statusMap);
  if (!match) return row;
  return {
    ...row,
    down_time: match.down_time || row.down_time || row.Drops || "",
    downEvent: match.downEvent || row.downEvent || "",
    downEventType: match.downEventType || match.downEventtype || row.downEventType || ""
  };
}

async function fetchWindowData(windowName) {
  const url = `${baseUrl}/${windowName}/complains`;
  try {
    const [res, lastStatusMap] = await Promise.all([
      fetch(url),
      fetchLastStatusMap(windowName)
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.rows || []).map(row => prepareRow(mergeLastStatus({
      ...row, 
      down_list: row.down_list || "",
      _complaint_id: row.ComplaintID || row.id || "",
      _window: windowName, 
      _runtime_timestamp: data.runtime_timestamp || "" 
    }, lastStatusMap)));
  } catch (err) {
    showToast(`Failed to load ${windowName}`);
    return [];
  }
}

function buildSearchText(row) {
  return [
    row._window,
    row.PON,
    row.Users,
    row.NMID,
    row["Registered no"],
    row["Calling no"],
    row["Last called no"],
    row.Name,
    row.MAC,
    row.Serial,
    row.Location,
    row.Remarks,
    row.reason,
    row.additional_detail,
    row.Team,
    row.Mode,
    row.down_time,
    row.downEvent,
    row.downEventType,
    row["User status"]
  ].map(v => String(v || "").toLowerCase()).join(" ");
}

function prepareRow(row) {
  const prepared = { ...row };
  prepared._searchText = buildSearchText(prepared);
  return prepared;
}

function updateVisibleRows() {
  visibleRows = filtered.slice(0, visibleLimit);
  if (!loadMoreBtn) return;
  if (filtered.length > visibleRows.length) {
    loadMoreBtn.style.display = "block";
    loadMoreBtn.textContent = `Show more (${visibleRows.length}/${filtered.length})`;
  } else {
    loadMoreBtn.style.display = "none";
  }
}

function scheduleApplyFilters() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    visibleLimit = INITIAL_VISIBLE_LIMIT;
    applyAllFilters();
  }, 250);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getRegisteredPhone(r) {
  return r["Registered no"] || r.registered_phone || r.primary_phone || r.Phone || "";
}

function getCallingPhoneForDisplay(r) {
  return String(r["Calling no"] || r.calling_phone || "").trim();
}

function getCallingPhone(r) {
  return r["Calling no"] || r.calling_phone || "";
}

function getEffectivePhone(r) {
  return getCallingPhone(r) || r["Last called no"] || getRegisteredPhone(r) || "";
}

function buildRemarkSelect(value) {
  const normalizedValue = value === "Other pronlem" || value === "Other problem" ? "Other" : value;
  const selectedValue = REMARK_OPTIONS.includes(normalizedValue) || normalizedValue === "Other" ? normalizedValue : (normalizedValue ? "Other" : "");
  const defaultOption = `<option value="" ${selectedValue ? "" : "selected"}>Select task catagory</option>`;
  const options = REMARK_OPTIONS.map(opt => {
    const optionValue = opt === "Other problem" ? "Other" : opt;
    return `<option value="${escapeHtml(optionValue)}" ${optionValue === selectedValue ? "selected" : ""}>${escapeHtml(opt)}</option>`;
  }
  ).join("");
  return `<select class="remarkInput">${defaultOption}${options}</select>`;
}

function buildAdditionalDetailInput(value, detailValue = "") {
  const enabled = value === "Other" || value === "Other pronlem" || value === "Other problem" || (value && !REMARK_OPTIONS.includes(value));
  const inputValue = value === "Other" || value === "Other pronlem" || value === "Other problem" ? detailValue : value;
  return `<input class="additionalDetailInput" value="${enabled ? escapeHtml(inputValue) : ""}" placeholder="Remarks" ${enabled ? "" : "disabled"}>`;
}

function syncAdditionalDetail(root) {
  const remark = root.querySelector(".remarkInput");
  const detail = root.querySelector(".additionalDetailInput");
  if (!remark || !detail) return;

  const isOther = remark.value === "Other";
  detail.disabled = !isOther;
  if (!isOther) detail.value = "";
  const remarksRow = root.querySelector(".card-row-remarks");
  if (remarksRow) remarksRow.classList.toggle("hidden", !isOther);
  const modeRow = root.querySelector(".card-row-mode");
  if (modeRow) modeRow.classList.toggle("hidden", !isOther);
  const modeSelEl = root.querySelector(".modeSel");
  if (!isOther && modeSelEl) modeSelEl.value = "Auto";
}

function wireRemarkDetail(root) {
  const remark = root.querySelector(".remarkInput");
  if (!remark) return;
  remark.onchange = () => syncAdditionalDetail(root);
  syncAdditionalDetail(root);
}

function getAdditionalDetail(root) {
  const remark = root.querySelector(".remarkInput");
  const detail = root.querySelector(".additionalDetailInput");
  return remark && detail && remark.value === "Other" ? detail.value.trim() : "";
}

async function saveCallingPhone(r, root) {
  const input = root.querySelector(".callingPhoneInput");
  const button = root.querySelector(".callingPhoneSave");
  if (!input || !button) return;

  const userId = r.Users || r.user_id || "";
  if (!userId) {
    showToast("User ID missing");
    return;
  }

  const callingPhone = input.value.trim();
  if (callingPhone !== "" && !/^\d{10}$/.test(callingPhone)) {
    showToast("Please enter a valid 10-digit phone number");
    return;
  }
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = "Saving";

  try {
    const response = await fetch(`${baseUrl}/${r._window}/user/calling_phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, calling_phone: callingPhone })
    });
    const result = await response.json();
    if (!response.ok || result.status !== "ok") {
      throw new Error(result.message || "Save failed");
    }

    [rawRows, filtered].forEach(list => {
      list.forEach(row => {
        const sameUser = String(row.Users || row.user_id || "").toLowerCase() === String(userId).toLowerCase();
        if (row._window === r._window && sameUser) {
          row["Calling no"] = callingPhone;
          row.calling_phone = callingPhone;
          row["Last called no"] = callingPhone || getRegisteredPhone(row);
        }
      });
    });
    r["Calling no"] = callingPhone;
    r.calling_phone = callingPhone;
    r["Last called no"] = callingPhone || getRegisteredPhone(r);
    showToast("Calling no saved", true);
  } catch (error) {
    showToast(error.message || "Calling no save failed");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function wireCallingPhoneSave(root, r) {
      const button = root.querySelector(".callingPhoneSave");
      if (button) {
        button.onclick = () => saveCallingPhone(r, root);
      }
    }

async function fetchOpenComplaintUsers(windowName) {
  const url = `${baseUrl}/${windowName}/heroesocr_latest?limit=5000`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = data.rows || [];

    const latestMap = {};
    rows.forEach(r => {
      const uid = String(r.user_id || "").trim().toLowerCase();
      if (!uid) return;

      const currTs = new Date(r.created_at || 0).getTime();
      const prev = latestMap[uid];
      const prevTs = prev ? new Date(prev.created_at || 0).getTime() : -1;

      if (!prev || currTs >= prevTs) {
        latestMap[uid] = r;
      }
    });

    const openRows = Object.values(latestMap).filter(r =>
      String(r.status || "").toLowerCase() === "open"
    );

    return openRows.map(r => ({ ...r, _window: windowName }));

  } catch (err) {
    showToast(`Failed to load Open Complains ${windowName}`);
    return [];
  }
}

/* ===============================
   ✅ Check for Existing Open Complaints
================================= */
async function checkExistingOpenComplaints(windowName, userId) {
  try {
    const url = `${baseUrl}/${windowName}/heroesocr_user_complaints/${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    
    const data = await res.json();
    const openComplaints = (data.rows || []).filter(c => 
      String(c.status || "").toLowerCase() === "open"
    );
    
    return openComplaints;
  } catch (error) {
    console.error("Error checking open complaints:", error);
    return [];
  }
}

/* ===============================
   ✅ Show Existing Complaints Popup (Improved)
================================= */
function showExistingComplaintsPopup(openComplaints, onContinue, markButton) {
  // 🔥 Prevent multiple popups and handle button state
  if (confirmModalEl.style.display === "flex") {
    if (markButton) {
      markButton.disabled = false;
      markButton.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
    }
    return;
  }
  
  // Store the continue action
  pendingMarkAction = onContinue;
  
  // Build popup content with better highlighting
  const count = openComplaints.length;
  let reasonsHtml = '';
  
  // Sort by created_at (latest first)
  const sortedComplaints = [...openComplaints].sort((a, b) => 
    new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  
  // Get top 3 reasons (or all if less than 3)
  const topReasons = sortedComplaints.slice(0, 3);
  topReasons.forEach((complaint, index) => {
    const reason = complaint.reason || "No reason provided";
    const isLatest = index === 0;
    const created = complaint.created_at ? new Date(complaint.created_at).toLocaleString() : "";
    
    reasonsHtml += `
      <div style="padding: 8px; margin: 4px 0; background: ${isLatest ? '#fff1f0' : 'transparent'}; border-left: ${isLatest ? '3px solid #ff4d4f' : 'none'}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: ${isLatest ? '600' : 'normal'}; color: ${isLatest ? '#cf1322' : 'var(--text-primary)'};">${index + 1}. ${reason}</span>
          ${isLatest ? '<span style="color: #ff4d4f; font-size: 0.8rem;">⬅️ Latest</span>' : ''}
        </div>
        ${created ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${created}</div>` : ''}
      </div>
    `;
  });
  
  if (openComplaints.length > 3) {
    reasonsHtml += `<div style="padding: 8px; color: var(--text-secondary); font-style: italic;">... and ${openComplaints.length - 3} more</div>`;
  }
  
  confirmModalBody.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="font-weight: 700; color: #d40000; font-size: 1.2rem; margin-bottom: 8px;">
        ⚠️ ${count} complaint${count > 1 ? 's' : ''} already open
      </div>
      <div style="background: #fff2f0; padding: 12px; border-radius: 8px; border: 1px solid #ffccc7;">
        ${reasonsHtml}
      </div>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-secondary); padding: 10px; background: #e6f7ff; border-radius: 6px; border-left: 3px solid #1890ff;">
      <i class="fa-solid fa-info-circle"></i> 
      <strong>Note:</strong> Notification may take a few minutes after marking a new complain. Avoid re-marking if it's already marked.
    </div>
  `;
  
  // Show the modal
  confirmModalEl.style.display = "flex";
}

/* ===============================
/* ===============================
   Mark Complaint Handler (Pre-Create Choice Flow)
================================= */
async function handleMarkComplaint(r, cardElement, remarkInput, modeSelect, teamSelect, markButton) {
  try {
    const openComplaints = await checkExistingOpenComplaints(r._window, r.Users || "");
    if (openComplaints.length > 0) {
      showExistingComplaintsPopup(openComplaints, async () => {
        showPreCreateChoice(r, cardElement, remarkInput, modeSelect, teamSelect, markButton);
      }, markButton);
      if (markButton) {
        markButton.disabled = false;
        markButton.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
      }
    } else {
      showPreCreateChoice(r, cardElement, remarkInput, modeSelect, teamSelect, markButton);
    }
  } catch (error) {
    console.error("Error in mark complaint check:", error);
    showPreCreateChoice(r, cardElement, remarkInput, modeSelect, teamSelect, markButton);
  }
}

/* ===============================
   Execute Mark Complaint (POST mark_complain + optional assign)
================================= */
async function executeMarkComplaint(r, cardElement, remarkInput, modeSelect, teamSelect, markButton, assignTo, preCreateModal) {
  const callingPhone = getCallingPhone(r);
  const registeredPhone = getRegisteredPhone(r);
  const payload = {
    user_id: r.Users || "",
    name: r.Name || "",
    address: r.Location || "",
    reason: remarkInput.value || "",
    additional_detail: getAdditionalDetail(cardElement),
    Mode: (remarkInput && remarkInput.value === "Other") ? modeSelect.value : "Auto",
    Power: r.Power,
    Phone: callingPhone || registeredPhone || r["Last called no"] || "",
    registered_phone: registeredPhone,
    calling_phone: callingPhone,
    Team: (teamSelect && teamSelect.value) ? teamSelect.value : getDefaultTeam(r._window),
    pon: r.PON || ""
  };

  try {
    const response = await fetch(`${baseUrl}/${r._window}/mark_complain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    const succeeded = response.ok && (result.status === "ok" || result.ok === true || result.demo === true);
    if (!succeeded) {
      showToast(result.message || "Mark failed");
      preCreateBusy = false;
      resetPreCreateModalButtons(preCreateModal);
      return;
    }

    if (assignTo && assignTo.length) {
      let complaintId = result.id || result.complaint_id || (result.row && result.row.id);
      if (!complaintId) {
        complaintId = await tryFetchLatestComplaintId(r._window, r.Users);
      }
      if (!complaintId) {
        showToast("Complaint created but ID missing. Assign later from Open Complaints.");
        closePreCreateModal();
        fadeOutAndRemove(cardElement);
        return;
      }
      try {
        const assignResp = await fetch(`${baseUrl}/${r._window}/tasks/complaints/${complaintId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "Pending",
            actiontime: nowLucknowForAssign(),
            takenby: assignTo.join(",")
          })
        });
        const assignResult = await assignResp.json().catch(() => ({}));
        if (!assignResp.ok) {
          throw new Error(assignResult.detail || assignResult.message || `HTTP ${assignResp.status}`);
        }
        showToast("Complaint created & assigned", true);
      } catch (assignErr) {
        showToast(`Complaint created but assign failed: ${assignErr.message}`);
        closePreCreateModal();
        fadeOutAndRemove(cardElement);
        return;
      }
    } else {
      showToast("Complaint created unallocated", true);
    }
    closePreCreateModal();
    fadeOutAndRemove(cardElement);
  } catch (error) {
    showToast("Mark failed");
    preCreateBusy = false;
    resetPreCreateModalButtons(preCreateModal);
  }
}

/* ===============================
   Pre-Create Choice Modal
================================= */
let preCreateState = null;
let preCreateBusy = false;
let teamMembersCache = null;
let teamMembersCacheTs = 0;

function nowLucknowForAssign() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

async function getTeamMembersForPower(force) {
  const now = Date.now();
  if (!force && teamMembersCache && (now - teamMembersCacheTs) < 60000) return teamMembersCache;
  const res = await fetch(`${baseUrl}/team-config`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Team config HTTP ${res.status}`);
  const data = await res.json();
  teamMembersCache = (data.members || []).map(m => String(m.name || "").trim()).filter(Boolean);
  teamMembersCacheTs = now;
  return teamMembersCache;
}

async function tryFetchLatestComplaintId(windowName, userId) {
  try {
    const res = await fetch(`${baseUrl}/${windowName}/heroesocr_user_complaints/${encodeURIComponent(userId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = (data.rows || []).filter(r => String(r.status || "").toLowerCase() === "open");
    if (!rows.length) return null;
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return rows[0].id || rows[0].complaint_id || null;
  } catch { return null; }
}

function ensurePreCreateModal() {
  let modal = document.getElementById("preCreateModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "preCreateModal";
  modal.className = "preCreateOverlay";
  modal.innerHTML = `
    <div class="preCreateBox" role="dialog" aria-modal="true">
      <div class="preCreateHead">
        <div>
          <div class="preCreateTitle">Ready to create complaint</div>
          <div class="preCreateSubtitle">Choose the final action</div>
        </div>
        <button class="preCreateClose" type="button" aria-label="Cancel">×</button>
      </div>
      <div class="preCreateIdentity">
        <div class="preCreateIdentityName"></div>
        <div class="preCreateIdentityMeta"></div>
      </div>
      <div class="preCreateBody"></div>
      <p class="preCreateSafeNote"><i class="fa-solid fa-circle-info"></i> Closing this window cancels the action; no complaint will be created.</p>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => { if (e.target === modal && !preCreateBusy) closePreCreateModal(); });
  modal.querySelector(".preCreateClose").addEventListener("click", () => { if (!preCreateBusy) closePreCreateModal(); });
  return modal;
}

function closePreCreateModal() {
  const modal = document.getElementById("preCreateModal");
  if (!modal) return;
  modal.classList.remove("open");
  if (preCreateState && preCreateState.markButton) {
    const mb = preCreateState.markButton;
    const ce = preCreateState.cardElement;
    if (mb && ce && document.body.contains(ce)) {
      mb.disabled = false;
      mb.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
    }
  }
  preCreateState = null;
  preCreateBusy = false;
}

function resetPreCreateModalButtons(modal) {
  if (!modal) return;
  modal.querySelectorAll("button").forEach(b => { b.disabled = false; });
}

function showPreCreateChoice(r, cardElement, remarkInput, modeSelect, teamSelect, markButton) {
  const modal = ensurePreCreateModal();
  preCreateState = { r, cardElement, remarkInput, modeSelect, teamSelect, markButton };
  preCreateBusy = false;
  if (markButton) {
    markButton.disabled = true;
    markButton.innerHTML = '<span class="loading-spinner-small"></span>';
  }
  modal.querySelector(".preCreateIdentityName").textContent = r.Name || "Unknown user";
  modal.querySelector(".preCreateIdentityMeta").textContent = `${r.Users || "-"} - ${r._window || "-"}`;
  const body = modal.querySelector(".preCreateBody");
  body.innerHTML = `
    <div class="preCreateActions">
      <button class="preCreateAssign" type="button"><i class="fa-solid fa-users"></i> Create & assign</button>
      <button class="preCreateUnallocated" type="button"><i class="fa-regular fa-clock"></i> Create unallocated</button>
    </div>
    <div class="preCreateTeamPanel hidden">
      <div class="preCreateTeamTitle">Select team members</div>
      <div class="preCreateTeamOptions"><span class="preCreateTeamLoading">Loading team members...</span></div>
      <div class="preCreateTeamFooter">
        <button class="preCreateTeamBack" type="button">Back</button>
        <button class="preCreateTeamSubmit" type="button"><i class="fa-solid fa-user-check"></i> Create & assign</button>
      </div>
    </div>
  `;
  modal.classList.add("open");

  const actionsEl = body.querySelector(".preCreateActions");
  const teamPanel = body.querySelector(".preCreateTeamPanel");
  const teamOptions = body.querySelector(".preCreateTeamOptions");
  const assignBtn = body.querySelector(".preCreateAssign");
  const unallocBtn = body.querySelector(".preCreateUnallocated");
  const backBtn = body.querySelector(".preCreateTeamBack");
  const submitBtn = body.querySelector(".preCreateTeamSubmit");

  assignBtn.addEventListener("click", async () => {
    actionsEl.classList.add("hidden");
    teamPanel.classList.remove("hidden");
    teamOptions.innerHTML = '<span class="preCreateTeamLoading">Loading team members...</span>';
    try {
      const members = await getTeamMembersForPower(false);
      if (!members.length) throw new Error("No team members configured");
      teamOptions.innerHTML = members.map(name => `
        <label class="preCreateTeamOption">
          <input type="checkbox" value="${escapeHtml(name)}">
          <span>${escapeHtml(name)}</span>
        </label>
      `).join("");
    } catch (err) {
      teamOptions.innerHTML = `<div class="preCreateTeamError">Team load failed: ${escapeHtml(err.message)}</div>`;
    }
  });

  backBtn.addEventListener("click", () => {
    teamPanel.classList.add("hidden");
    actionsEl.classList.remove("hidden");
  });

  unallocBtn.addEventListener("click", async () => {
    const state = preCreateState;
    if (!state) return;
    preCreateBusy = true;
    unallocBtn.disabled = true;
    assignBtn.disabled = true;
    await executeMarkComplaint(state.r, state.cardElement, state.remarkInput, state.modeSelect, state.teamSelect, state.markButton, [], modal);
    if (document.getElementById("preCreateModal") && document.getElementById("preCreateModal").classList.contains("open")) {
      preCreateBusy = false;
      unallocBtn.disabled = false;
      assignBtn.disabled = false;
    }
  });

  submitBtn.addEventListener("click", async () => {
    const state = preCreateState;
    if (!state) return;
    const selected = Array.from(teamOptions.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value).filter(Boolean);
    if (!selected.length) { showToast("Select minimum 1 team member"); return; }
    preCreateBusy = true;
    submitBtn.disabled = true;
    backBtn.disabled = true;
    await executeMarkComplaint(state.r, state.cardElement, state.remarkInput, state.modeSelect, state.teamSelect, state.markButton, selected, modal);
    if (document.getElementById("preCreateModal") && document.getElementById("preCreateModal").classList.contains("open")) {
      preCreateBusy = false;
      submitBtn.disabled = false;
      backBtn.disabled = false;
    }
  });
}
/* ===============================
   Helpers
================================= */
function setHeadingCountAndTimestamp(count, runtimeTs) {
  if (runtimeTs) userCount.textContent = `(${count}) ${runtimeTs}`;
  else userCount.textContent = `(${count})`;
}

function safeParseDate(s) {
  const d = new Date(s || "");
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function formatStatusDate(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue || rawValue === "-") return "";

  const date = new Date(rawValue.replace(" ", "T"));
  if (isNaN(date.getTime())) return rawValue;

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `${day} ${month} ${time}`;
}

function getLastStatusText(row) {
  const time = formatStatusDate(row.down_time || row.Drops || "");
  const eventName = String(row.downEvent || "").trim();
  const eventType = String(row.downEventType || row.downEventtype || "").trim();
  const eventPart = eventName && eventType
    ? `${eventName} (${eventType})`
    : eventName || (eventType ? `(${eventType})` : "");

  if (time && eventPart) return `${time} / ${eventPart}`;
  return time || eventPart || "-";
}

function pageOrder(pageId) {
  const p = String(pageId || "").toLowerCase();
  if (p === "repairs") return 1;
  if (p === "installations") return 2;
  if (p === "collections") return 3;
  return 99;
}

function groupTitle(pageId) {
  if (!pageId) return "Others";
  return pageId;
}

function getDefaultTeam(windowName) {
  if (windowName === "AMANWIZ") return "TeamAmanwiz";
  if (windowName === "MEDANTA") return "TeamMedanta";
  if (windowName === "SEVAI") return "TeamSevai";
  return "";
}

/* ===============================
   ✅ LAZY Badge Check (only for visible cards)
   Using Intersection Observer to check only when needed
================================= */
const badgeCheckQueue = new Map();
let observer = null;

function setupLazyBadgeCheck() {
  if (observer) return;
  
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        const userId = card.dataset.userId;
        const windowName = card.dataset.window;
        
        if (userId && windowName && !card.dataset.badgeChecked) {
          card.dataset.badgeChecked = "true";
          
          // Small delay to batch requests
          setTimeout(() => {
            checkAndShowBadge(card, windowName, userId);
          }, 100);
        }
      }
    });
  }, {
    rootMargin: "50px", // Start loading when within 50px of viewport
    threshold: 0.1
  });
  
  return observer;
}

async function checkAndShowBadge(card, windowName, userId) {
  try {
    // Use a simple cache to avoid duplicate checks
    const cacheKey = `${windowName}_${userId}`;
    if (badgeCheckQueue.has(cacheKey)) {
      const hasOpen = badgeCheckQueue.get(cacheKey);
      if (hasOpen) addWarningBadge(card);
      return;
    }
    
    const openComplaints = await checkExistingOpenComplaints(windowName, userId);
    const hasOpen = openComplaints.length > 0;
    
    // Cache for 30 seconds
    badgeCheckQueue.set(cacheKey, hasOpen);
    setTimeout(() => badgeCheckQueue.delete(cacheKey), 30000);
    
    if (hasOpen) {
      addWarningBadge(card);
    }
  } catch (error) {
    console.error("Badge check failed:", error);
  }
}

function addWarningBadge(card) {
  const header = card.querySelector(".card-header div");
  if (header && !header.querySelector(".warning-badge")) {
    const badge = document.createElement("span");
    badge.className = "warning-badge";
    badge.title = "Already has open complaints";
    badge.innerHTML = "⚠️";
    header.appendChild(badge);
    const removeBtn = card.querySelector(".remove-btn");
  if (removeBtn) removeBtn.classList.remove("hidden");
}
}

/* ===============================
   ✅ Down Users Helper Functions
================================= */
function normalizeMac(m) {
  return String(m || "")
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "");
}

function getDownUsersDetails() {
  const downSet = new Set(
    currentDownList.map(mac => normalizeMac(mac))
  );

  return rawRows.filter(u => {
    const userMac = normalizeMac(u.MAC);
    return userMac && downSet.has(userMac);
  });
}

function showDownUsersInModal() {
  const users = getDownUsersDetails();

  if (!users.length) {
    modalBody.innerHTML = "<div class='modalRow'>No down users found</div>";
    return;
  }

  modalBody.innerHTML = users.map((u, i) => `
    <div class="modalEntry">
      <div class="modalRow"><b>${i + 1}. ${u.Name || "N/A"}</b></div>
      <div class="modalRow"><b>Phone:</b> Reg ${getRegisteredPhone(u) || ""} / Call ${getCallingPhone(u) || ""}</div>
      <div class="modalRow"><b>📍 Location:</b> ${u.Location || ""}</div>
      <div class="modalRow"><b>🔌 Status:</b> ${u["User status"] || ""}</div>
      <div class="modalRow"><b>🧷 MAC:</b> ${u.MAC || ""}</div>
      <div class="modalRow"><b>Window:</b> ${u._window || ""}</div>
      <div class="modalRow"><b>Power:</b> ${u.Power?.toFixed(2) || ""}</div>
      <div class="modalRow"><b>Down Count:</b> ${u.downusers || 0}</div>
      <hr style="margin:10px 0;border-color:#ddd;">
    </div>
  `).join("");
}

/* ===============================
   ✅ PON Dropdown logic
================================= */
function updatePonButtonText() {
  const cnt = selectedPonsSet.size;
  if (!ponMultiBtn) return;
  if (cnt === 0) ponMultiBtn.textContent = "All PON";
  else ponMultiBtn.textContent = `PON (${cnt} selected)`;
}

if (ponMultiBtn && ponMultiDropdown) {
  ponMultiBtn.onclick = () => {
    ponMultiDropdown.classList.toggle("show");
    if (ponMultiSearchInput) ponMultiSearchInput.value = "";
  };

  document.addEventListener("click", (e) => {
    if (ponMultiWrap && !ponMultiWrap.contains(e.target)) {
      ponMultiDropdown.classList.remove("show");
    }
  });
}

if (ponMultiList) {
  ponMultiList.onclick = (e) => {
    const item = e.target.closest(".ponItem");
    if (!item) return;

    const pon = item.getAttribute("data-pon");
    const cb = item.querySelector("input[type='checkbox']");
    cb.checked = !cb.checked;

    if (cb.checked) selectedPonsSet.add(pon);
    else selectedPonsSet.delete(pon);

    updatePonButtonText();
  };
}

if (ponMultiSearchInput) {
  ponMultiSearchInput.oninput = () => {
    const q = ponMultiSearchInput.value.trim().toLowerCase();
    const items = ponMultiList.querySelectorAll(".ponItem");
    items.forEach(it => {
      const p = (it.getAttribute("data-pon") || "").toLowerCase();
      it.style.display = p.includes(q) ? "flex" : "none";
    });
  };
}

if (ponClearBtn) {
  ponClearBtn.onclick = () => {
    selectedPonsSet.clear();
    if (ponMultiList) {
      ponMultiList.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);
    }
    updatePonButtonText();
    visibleLimit = INITIAL_VISIBLE_LIMIT;
    applyAllFilters();
  };
}

if (ponOkBtn) {
  ponOkBtn.onclick = () => {
    ponMultiDropdown.classList.remove("show");
    visibleLimit = INITIAL_VISIBLE_LIMIT;
    applyAllFilters();
  };
}

/* ===============================
   ✅ Modal events
================================= */
if (modalCloseBtn && complaintModal) {
  modalCloseBtn.onclick = () => {
    complaintModal.style.display = "none";
    if (modalActions) modalActions.style.display = "flex";
    if (btnDownUsers) {
      btnDownUsers.textContent = "Down users list";
      btnDownUsers.style.display = "inline-flex";
    }
  };
}

if (modalCloseButton && complaintModal) {
  modalCloseButton.onclick = () => {
    complaintModal.style.display = "none";
    if (modalActions) modalActions.style.display = "flex";
    if (btnDownUsers) {
      btnDownUsers.textContent = "Down users list";
      btnDownUsers.style.display = "inline-flex";
    }
  };
}

if (complaintModal) {
  complaintModal.onclick = (e) => {
    if (e.target === complaintModal) {
      complaintModal.style.display = "none";
      if (modalActions) modalActions.style.display = "flex";
      if (btnDownUsers) {
        btnDownUsers.textContent = "Down users list";
        btnDownUsers.style.display = "inline-flex";
      }
    }
  };
}

/* ===============================
   ✅ Down Users Button Logic
================================= */
if (btnDownUsers) {
  btnDownUsers.onclick = () => {
    if (btnDownUsers.textContent === "Down users list") {
      showDownUsersInModal();
      btnDownUsers.textContent = "← Back to complaint";
    } else {
      if (modalBody && modalBody._originalHtml) {
        modalBody.innerHTML = modalBody._originalHtml;
      }
      btnDownUsers.textContent = "Down users list";
    }
  };
}

/* ===============================
   ✅ UPDATED: Complaint Popup with fixed grouping and edge cases
================================= */
async function openComplaintPopup(windowName, userId, userName) {
  try {
    showSpinner();
    const url = `${baseUrl}/${windowName}/heroesocr_user_complaints/${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();

    const rows = data.rows || [];
    const current = rows.filter(r => String(r.status || "").toLowerCase() === "open");
    const logs = rows;
    const latest = current[0] || rows[0] || null;

    if (modalTitle) modalTitle.textContent = `${userName || "User"} (${userId}) - Complaints`;

    let html = "";
    if (!latest && logs.length === 0) {
      html = `<div class="modalRow">No complaint history found.</div>`;
    } else {
      currentDownList = latest?.down_list
        ? latest.down_list.split(",").map(x => x.trim()).filter(Boolean)
        : [];
      
      if (btnDownUsers) {
        if (currentDownList.length === 0) {
          btnDownUsers.style.display = "none";
        } else {
          btnDownUsers.style.display = "inline-flex";
        }
      }

      if (latest) {
        html += `
          <div class="modalEntry">
            <div class="modalRow"><b>Status:</b> ${latest.status || ""}</div>
            <div class="modalRow"><b>Page:</b> ${latest.page_id || ""}</div>
            <div class="modalRow"><b>Reason:</b> ${latest.reason || ""}</div>
            <div class="modalRow"><b>Created:</b> ${latest.created_at || ""}</div>
            <div class="modalRow"><b>Team:</b> ${latest.Team || ""}</div>
            <div class="modalRow"><b>Mode:</b> ${latest.Mode || ""}</div>
            <div class="modalRow"><b>Power:</b> ${latest.Power ?? ""}</div>
            <div class="modalRow"><b>Phone:</b> ${latest.Phone || ""}</div>
            <div class="modalRow"><b>PON:</b> ${latest.pon || ""}</div>
            <div class="modalRow"><b>Drops:</b> ${latest.drops || ""}</div>
            <div class="modalRow"><b>Down Time:</b> ${latest.down_time || ""}</div>
            <div class="modalRow"><b>Down List:</b> ${latest.down_list || "None"}</div>
            <div class="modalRow"><b>StatusUpDown:</b> ${latest.statusUpDown || ""}</div>
          </div>
        `;
      }

      if (logs.length > 0) {
        // ✅ Group by user_id + reason (same user + same reason = same ticket)
        const ticketMap = {};
        logs.forEach(l => {
          const key = (l.user_id || "") + "|" + (l.reason || "");
          if (!ticketMap[key]) ticketMap[key] = [];
          ticketMap[key].push(l);
        });

        html += `<div style="font-weight:800;margin-top:10px;">History</div>`;
        
        // ✅ Track if we actually show any history
        let hasHistory = false;

        // ✅ Only show valid OPEN + CLOSE pairs with proper handling
        Object.values(ticketMap).forEach(group => {
          // ✅ Match exact database values: "Open" and "Close" (case insensitive)
          const opens = group.filter(x => String(x.status).toLowerCase() === "open");
          const closes = group.filter(x => String(x.status).toLowerCase() === "close");
          
          // ✅ Skip if no opens or no closes
          if (!opens.length || !closes.length) return;
          
          // ✅ Get latest open and latest close (using copy to avoid modifying original)
          const open = [...opens].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          const close = [...closes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          
          // ✅ RULE 1: Skip if no close (redundant check but safe)
          if (!open || !close) return;
          
          // ✅ RULE 2: Skip if latest entry is OPEN (already shown in current complaints)
          const sorted = [...group].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          if (String(sorted[0].status).toLowerCase() === "open") return;

          // ✅ We have a valid history entry
          hasHistory = true;

          const openTime = open?.created_at || "";
          const closeTime = close?.created_at || "";

          let duration = "-";
          if (openTime && closeTime) {
            const diff = new Date(closeTime) - new Date(openTime);
            const mins = Math.floor(diff / 60000);
            const hrs = Math.floor(mins / 60);
            const remMin = mins % 60;
            duration = `${hrs}h ${remMin}m`;
          }

          html += `
            <div class="modalEntry" style="margin-bottom: 12px; border-left: 3px solid #4caf50; padding-left: 10px;">
              <div class="modalRow"><b>Ticket Status:</b> Closed</div>
              <div class="modalRow"><b>Opened:</b> ${openTime}</div>
              <div class="modalRow"><b>Closed:</b> ${closeTime}</div>
              <div class="modalRow"><b>Duration:</b> ${duration}</div>
              <div class="modalRow"><b>Reason:</b> ${open?.reason || ""}</div>
              <div class="modalRow"><b>Page:</b> ${open?.page_id || ""}</div>
            </div>
          `;
        });
        
        // ✅ Show message if no history found
        if (!hasHistory) {
          html += `<div class="modalRow" style="color: var(--text-secondary); padding: 10px;">No closed complaint history found</div>`;
        }
      } else {
        // ✅ No logs at all
        html += `<div class="modalRow" style="color: var(--text-secondary); padding: 10px;">No complaint history found</div>`;
      }
    }

    if (modalBody) {
      modalBody.innerHTML = html;
      modalBody._originalHtml = html;
    }
    
    if (btnDownUsers) {
      btnDownUsers.textContent = "Down users list";
    }
    
    if (modalActions) {
      modalActions.style.display = "flex";
    }
    
    if (complaintModal) complaintModal.style.display = "flex";

      return null;

  } catch (e) {
    showToast("Popup load failed");
    return null;
  } finally {
    hideSpinner();
  }
}
/* ===============================
   ✅ Main Load
================================= */
async function fetchData() {
  showSpinner();
  try {
    if (currentWindow === "ALL") {
      const [amanwizData, medantaData, sevaiData] = await Promise.all([
        fetchWindowData("AMANWIZ"),
        fetchWindowData("MEDANTA"),
        fetchWindowData("SEVAI")
      ]);
      rawRows = [...amanwizData, ...medantaData, ...sevaiData];
    } else {
      rawRows = await fetchWindowData(currentWindow);
    }

    showToast(rawRows.length ? `${rawRows.length} users loaded` : "No users found");
    populateFilters();
    visibleLimit = INITIAL_VISIBLE_LIMIT;
    applyAllFilters();
  } catch (err) {
    showToast("Load failed");
  } finally {
    hideSpinner();
  }
}

function populateFilters() {
  const pons = [...new Set(rawRows.map(r => r.PON || "").filter(Boolean))].sort();

  if (ponMultiList) {
    ponMultiList.innerHTML = pons.map(p => `
      <div class="ponItem" data-pon="${p}">
        <input type="checkbox" ${selectedPonsSet.has(p) ? "checked" : ""}/>
        <span>${p}</span>
      </div>
    `).join("");
  }
  updatePonButtonText();

  if (filterTeam) filterTeam.style.display = "none";

  const modes = [...new Set(rawRows.map(r => r.Mode || "").filter(Boolean))].sort();
  filterMode.innerHTML = '<option value="">All Mode</option>' + modes.map(m => `<option value="${m}">${m}</option>`).join('');

  const statuses = [...new Set(rawRows.map(r => r["User status"] || "").filter(Boolean))].sort();
  let html = '<option value="">All Status</option>';
  statuses.forEach(s => html += `<option value="${s}">${s}</option>`);
  filterStatus.innerHTML = html;
}

function applyAllFilters() {
  let data = [...rawRows];

  const term = globalSearch.value.trim().toLowerCase();
  if (term) {
    data = data.filter(r => (r._searchText || buildSearchText(r)).includes(term));
  }

  const pr = (powerRange?.value || "").trim();
  if (pr.includes("-")) {
    const parts = pr.split("-").map(x => x.trim()).filter(Boolean);
    if (parts.length === 2) {
      const a = parseFloat(parts[0]);
      const b = parseFloat(parts[1]);
      if (!isNaN(a) && !isNaN(b)) {
        const minAbs = Math.min(a, b);
        const maxAbs = Math.max(a, b);
        const minVal = -maxAbs;
        const maxVal = -minAbs;
        data = data.filter(r => r.Power != null && Number(r.Power) >= minVal && Number(r.Power) <= maxVal);
      }
    }
  }

  if (selectedPonsSet.size > 0) {
    data = data.filter(r => selectedPonsSet.has(r.PON));
  }

  if (filterMode.value) data = data.filter(r => r.Mode === filterMode.value);
  if (filterStatus.value) data = data.filter(r => r["User status"] === filterStatus.value);

  filtered = data;
  updateVisibleRows();

  const runtimeTs = (filtered[0] && filtered[0]._runtime_timestamp) ? filtered[0]._runtime_timestamp : "";
  setHeadingCountAndTimestamp(filtered.length, runtimeTs);

  if (currentView === "cards") renderCards();
  else renderTable();
}

/* ===============================
   ✅ Cards Render (with LAZY warning badge)
================================= */
async function renderCards() {
  cardContainer.innerHTML = "";
  tableWrap.style.display = "none";
  updateVisibleRows();

  if (!filtered.length) {
    cardContainer.style.display = "grid";
    cardContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);">No users found</div>';
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    return;
  }

  const hasSections = visibleRows.some(r => r._page_id);
  if (!hasSections) {
    cardContainer.style.display = "grid";
    const fragment = document.createDocumentFragment();
    
    // Render cards without blocking on badge checks
    visibleRows.forEach((r, index) => {
      renderSingleCard(r, index, fragment);
    });
    cardContainer.appendChild(fragment);
    return;
  }

  cardContainer.style.display = "block";

  const groups = {};
  visibleRows.forEach(r => {
    const key = r._page_id || "Others";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const groupKeys = Object.keys(groups).sort((a, b) => pageOrder(a) - pageOrder(b));

  // Setup lazy badge checker
  const badgeObserver = setupLazyBadgeCheck();

  const fragment = document.createDocumentFragment();

  groupKeys.forEach(gk => {
    groups[gk].sort((a, b) => safeParseDate(b._created_at) - safeParseDate(a._created_at));

    const section = document.createElement("div");
    section.className = "sectionWrap";

    const head = document.createElement("div");
    head.className = "sectionHead";
    head.innerHTML = `${groupTitle(gk)} <span class="secCount">(${groups[gk].length})</span>`;
    section.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "sectionGrid";
    section.appendChild(grid);

    groups[gk].forEach((r, idx) => {
      const card = renderSingleCard(r, idx, grid);
      if (badgeObserver && r.Users && !r._complain_open) {
        badgeObserver.observe(card);
      }
    });
    
    fragment.appendChild(section);
  });
  cardContainer.appendChild(fragment);
}

function renderSingleCard(r, index, container) {
  const lastStatusText = getLastStatusText(r);

  const card = document.createElement("div");
  card.className = "complaint-card";

  if (r["User status"] === "DOWN") {
    card.classList.add("card-complain");
  } else if (r["User status"] === "UP") {
    if (r._complain_open) card.classList.add("card-blink");
    else card.classList.add("card-online");
  } else {
    card.classList.add("card-offline");
  }

  const statusEmoji = r["User status"] === "UP" ? '📶' : r["User status"] === "DOWN" ? '📵' : '💀';

  // ✅ Store user data for lazy badge check
  if (r.Users) {
    card.dataset.userId = r.Users;
    card.dataset.window = r._window;
  }

  // ✅ Remark with fallback to reason
  const remarkValue = r.Remarks || r.reason || "";

  card.innerHTML = `
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 6px;">
          ${r.Name || "Unknown"}
          <!-- Badge will be added dynamically by observer -->
        </div>
        <span>${statusEmoji}</span>
      </div>
      <div class="card-row"><span class="card-label">Window:</span><span class="card-value">${r._window || ""}</span></div>
      <div class="card-row"><span class="card-label">User ID:</span><span class="card-value">${r.Users || ""}</span></div>
      <div class="card-row"><span class="card-label">Reg No:</span><span class="card-value">${getRegisteredPhone(r) || ""}</span></div>
      <div class="card-row">
        <span class="card-label">Calling No:</span>
        <div class="phoneEdit">
          <input class="callingPhoneInput" value="${escapeHtml(getCallingPhoneForDisplay(r))}" type="tel" maxlength="10" placeholder="10-digit no">
          <button class="callingPhoneSave" type="button">Save</button>
        </div>
      </div>
      <div class="card-row"><span class="card-label">PON:</span><span class="card-value">${r.PON || ""}</span></div>
      <div class="card-row"><span class="card-label">Location:</span><button class="card-value addressLink" type="button" title="${escapeHtml(r.Location || "")}">${r.Location || ""}</button></div>
      <div class="card-row"><span class="card-label">Power:</span><span class="card-value">${r.Power?.toFixed(2) || ""}</span></div>
      <div class="card-row"><span class="card-label">Last status:</span><button class="card-value statusLink" type="button" title="${escapeHtml(lastStatusText)}" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;text-align:right;">${escapeHtml(lastStatusText.length > 15 ? lastStatusText.substring(0, 15) + "..." : lastStatusText)}</button></div>
      <div class="card-row"><span class="card-label">MAC / Serial:</span><span class="card-value">${r.MAC || ""} / ${r.Serial || ""}</span></div>
      <div class="card-row"><span class="card-label">Task catagory:</span>${buildRemarkSelect(remarkValue)}</div>
      <div class="card-row card-row-remarks hidden"><span class="card-label">Remarks:</span>${buildAdditionalDetailInput(remarkValue, r.additional_detail || "")}</div>
      <div class="card-row card-row-team hidden">
        <span class="card-label">Team:</span>
        <select class="teamSel">
          <option>TeamAmanwiz</option><option>TeamMedanta</option><option>TeamSevai</option>
        </select>
      </div>
      <div class="card-row card-row-mode hidden">
        <span class="card-label">Mode:</span>
        <select class="modeSel">
          <option>Manual</option><option>Auto</option>
        </select>
      </div>
      <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:10px;">
      <button class="mark-btn"><i class="fa-solid fa-thumbtack"></i></button>
      <button class="remove-btn${r._complain_open ? '' : ' hidden'}"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

  card.style.cursor = (isComplainsView && r._complain_open) ? "pointer" : "default";
  card.onclick = async (e) => {
    if (e.target.closest("button") || e.target.closest("select") || e.target.closest("input")) return;
    if (!isComplainsView || !r._complain_open) return;
    const complaintId = await openComplaintPopup(r._window, r.Users || "", r.Name || "");
    if (complaintId) {
      r._complaint_id = complaintId;
    }
  };

  const teamSel = card.querySelector(".teamSel"); if (teamSel) if (teamSel) teamSel.value = r.Team || getDefaultTeam(r._window);

  const modeSel = card.querySelector(".modeSel"); if (modeSel) if (modeSel) modeSel.value = r.Mode || "Auto";
  const addressLink = card.querySelector(".addressLink");
  if (addressLink) {
    addressLink.onclick = (event) => {
      event.stopPropagation();
      openAddressModal(r.Location || "");
    };
  }
  wireRemarkDetail(card);
  wireCallingPhoneSave(card, r);

  // MARK BUTTON - With loading state and button disable
  const markBtn = card.querySelector(".mark-btn");
  markBtn.onclick = async (e) => {
    e.stopPropagation();
    
    // Prevent double click
    if (!card.querySelector(".remarkInput").value) { showToast("Please select a Task Category before marking."); return; }
    if (markBtn.disabled) return;
    
    // 🔥 Loading state
    markBtn.disabled = true;
    const originalHTML = markBtn.innerHTML;
    markBtn.innerHTML = '<span class="loading-spinner-small"></span>⏳';
    
    try {
      await handleMarkComplaint(r, card, card.querySelector(".remarkInput"), modeSel, teamSel, markBtn);
    } catch (error) {
      console.error(error);
      // If error and card not removed, restore button
      if (document.body.contains(card)) {
        markBtn.disabled = false;
        markBtn.innerHTML = originalHTML;
      }
    }
    // Note: If successful, card gets removed so button state doesn't matter
  };

  // REMOVE BUTTON - Add loading state too for consistency
  const removeBtn = card.querySelector(".remove-btn");
  removeBtn.onclick = async (e) => {
    e.stopPropagation();
    
    if (removeBtn.disabled) return;
    
    removeBtn.disabled = true;
    const originalHTML = removeBtn.innerHTML;
    removeBtn.innerHTML = '<span class="loading-spinner-small"></span>⏳';
    
    try {
      try {
        const payload = {
          complaint_id: r._complaint_id || r.ComplaintID || r.id || "",
          user_id: r.Users || "",
          name: r.Name || "",
          address: r.Location || "",
          reason: card.querySelector(".remarkInput").value || "",
          additional_detail: getAdditionalDetail(card),
          Mode: modeSel.value,
          Power: r.Power,
          Phone: getEffectivePhone(r),
          registered_phone: getRegisteredPhone(r),
          calling_phone: getCallingPhone(r),
          Team: teamSel.value,
          pon: r.PON || ""
        };

        const response = await fetch(`${baseUrl}/${r._window}/delete_complain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.status === "ok" || result.status === "skipped") {
          showToast("✅ Complaint removed successfully", true);
          fadeOutAndRemove(card);
        } else {
          showToast(result.message || "❌ Remove failed");
          removeBtn.disabled = false;
          removeBtn.innerHTML = originalHTML;
        }
      } catch (error) {
        console.error("Delete error:", error);
        showToast("❌ Remove failed");
        removeBtn.disabled = false;
        removeBtn.innerHTML = originalHTML;
      }
    } catch (error) {
      console.error("Error in remove handler:", error);
      removeBtn.disabled = false;
      removeBtn.innerHTML = originalHTML;
    }
  };

  const statusLink = card.querySelector(".statusLink");
  if (statusLink) {
    statusLink.onclick = (e) => {
      e.stopPropagation();
      openInfoModal("Last Status", lastStatusText);
    };
  }
  const addressLinkCard = card.querySelector(".addressLink");
  if (addressLinkCard) {
    addressLinkCard.onclick = (e) => {
      e.stopPropagation();
      openInfoModal("Full Address", r.Location || "");
    };
  }
  container.appendChild(card);
  setTimeout(() => card.classList.add("visible"), Math.min(index, 30) * 12);
  
  return card; // Return card for observer
}

/* ===============================
   ✅ Table Render (no badge for table to avoid performance issues)
================================= */
async function renderTable() {
  tbody.innerHTML = "";
  cardContainer.style.display = "none";
  tableWrap.style.display = "block";
  updateVisibleRows();

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:20px;color:var(--text-secondary);">No users found</td></tr>';
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    return;
  }

  const tableData = [...visibleRows];

  if (tableData.some(r => r._page_id)) {
    tableData.sort((a, b) => {
      const po = pageOrder(a._page_id) - pageOrder(b._page_id);
      if (po !== 0) return po;
      return safeParseDate(b._created_at) - safeParseDate(a._created_at);
    });
  }

  let lastGroup = "";
  const fragment = document.createDocumentFragment();

  // Table view: No badge checks (performance)
  for (const r of tableData) {
    if (r._page_id) {
      const grp = r._page_id || "";
      if (grp !== lastGroup) {
        const sep = document.createElement("tr");
        sep.innerHTML = `<td colspan="13" style="font-weight:800;padding:10px;background:#f5f5f5;">${grp}</td>`;
        fragment.appendChild(sep);
        lastGroup = grp;
      }
    }

    const lastStatusText = getLastStatusText(r);

    const tr = document.createElement("tr");
    const statusEmoji = r["User status"] === "UP" ? '📶' : r["User status"] === "DOWN" ? '📵' : '💀';

    if (r["User status"] === "DOWN") {
      tr.classList.add("ticket");
    } else if (r["User status"] === "UP") {
      if (r._complain_open) tr.classList.add("tr-blink");
      else tr.classList.add("onlineRow");
    } else {
      tr.classList.add("offline");
    }

    // ✅ Remark with fallback to reason
    const remarkValue = r.Remarks || r.reason || "";

    tr.innerHTML = `
      <td>${r._window || ""}</td>
      <td>${r.PON || ""}</td>
      <td>${r.Users || ""}</td>
      <td>
        <div class="phoneStack">
          <div><span>Reg:</span> ${getRegisteredPhone(r) || ""}</div>
          <div class="phoneEdit">
            <span>Call:</span>
            <input class="callingPhoneInput" value="${escapeHtml(getCallingPhoneForDisplay(r))}" type="tel" maxlength="10" placeholder="10-digit no">
            <button class="callingPhoneSave" type="button">Save</button>
          </div>
        </div>
      </td>
      <td>${r.Name || ""}</td>
      <td>${r.MAC || ""}<br><small>${r.Serial || ""}</small></td>
      <td>
        <button class="statusLink" type="button" title="${escapeHtml(lastStatusText)}" style="background:none;border:none;color:var(--accent);cursor:pointer;text-align:center;padding:0;font-size:0.85rem;display:block;width:100%;">${escapeHtml(lastStatusText.length > 15 ? lastStatusText.substring(0, 15) + "..." : lastStatusText)}</button>
      </td>
      <td>
        ${buildRemarkSelect(remarkValue)}
        <div class="card-row-remarks hidden" style="margin-top:4px;">${buildAdditionalDetailInput(remarkValue, r.additional_detail || "")}</div>
      </td>
      <td class="modeCol resizableCol">
        <div class="card-row-mode hidden">
          <select class="modeSel">
            <option>Manual</option>
            <option>Auto</option>
          </select>
        </div>
      </td>
      <td>${r.Power != null ? Number(r.Power).toFixed(2) : ""}</td>
      <td>
        <button class="mark-btn"><i class="fa-solid fa-thumbtack"></i></button>
        <button class="remove-btn${r._complain_open ? '' : ' hidden'}"><i class="fas fa-trash"></i></button>
      </td>
      <td>
        <button class="addressLink" type="button" title="${escapeHtml(r.Location || "")}" style="background:none;border:none;color:var(--accent);cursor:pointer;text-align:center;padding:0;font-size:0.85rem;display:block;width:100%;">${escapeHtml(r.Location ? (r.Location.length > 15 ? r.Location.substring(0, 15) + "..." : r.Location) : "")}</button>
      </td>
      <td>${statusEmoji} ${r["User status"] || ""}</td>
    `;

    tr.style.cursor = (isComplainsView && r._complain_open) ? "pointer" : "default";
    tr.onclick = async (e) => {
      if (e.target.closest("button") || e.target.closest("select") || e.target.closest("input")) return;
      if (!isComplainsView || !r._complain_open) return;
      const complaintId = await openComplaintPopup(r._window, r.Users || "", r.Name || "");
      if (complaintId) {
        r._complaint_id = complaintId;
      }
    };

    const teamSelect = null;

    const modeSelect = tr.querySelector(".modeSel"); if (modeSelect) modeSelect.value = r.Mode || "Auto";
    wireRemarkDetail(tr);
    wireCallingPhoneSave(tr, r);

    // MARK BUTTON - With loading state
    const markBtn = tr.querySelector(".mark-btn");
    markBtn.onclick = async (e) => {
      e.stopPropagation();

      if (!tr.querySelector(".remarkInput").value) { showToast("Please select a Task Category before marking."); return; }

      if (markBtn.disabled) return;
      
      markBtn.disabled = true;
      const originalHTML = markBtn.innerHTML;
      markBtn.innerHTML = '<span class="loading-spinner-small"></span>⏳';
      
      try {
        await handleMarkComplaint(r, tr, tr.querySelector(".remarkInput"), modeSelect, teamSelect, markBtn);
      } catch (error) {
        console.error(error);
        if (document.body.contains(tr)) {
          markBtn.disabled = false;
          markBtn.innerHTML = originalHTML;
        }
      }
    };

    // REMOVE BUTTON - With loading state
    const removeBtn = tr.querySelector(".remove-btn");
    removeBtn.onclick = async (e) => {
      e.stopPropagation();

      if (removeBtn.disabled) return;
      
      removeBtn.disabled = true;
      const originalHTML = removeBtn.innerHTML;
      removeBtn.innerHTML = '<span class="loading-spinner-small"></span>⏳';

      try {
        try {
          const payload = {
            complaint_id: r._complaint_id || r.ComplaintID || r.id || "",
            user_id: r.Users || "",
            name: r.Name || "",
            address: r.Location || "",
            reason: tr.querySelector(".remarkInput").value || "",
            additional_detail: getAdditionalDetail(tr),
            Mode: modeSelect.value,
            Power: r.Power,
            Phone: getEffectivePhone(r),
            registered_phone: getRegisteredPhone(r),
            calling_phone: getCallingPhone(r),
            Team: teamSelect.value,
            pon: r.PON || ""
          };

          const response = await fetch(`${baseUrl}/${r._window}/delete_complain`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          if (result.status === "ok" || result.status === "skipped") {
            showToast("✅ Complaint removed successfully", true);
            fadeOutAndRemove(tr);
          } else {
            showToast(result.message || "❌ Remove failed");
            removeBtn.disabled = false;
            removeBtn.innerHTML = originalHTML;
          }
        } catch (err) {
          showToast("❌ Remove failed");
          removeBtn.disabled = false;
          removeBtn.innerHTML = originalHTML;
        }
      } catch (error) {
        console.error("Error in remove handler:", error);
        removeBtn.disabled = false;
        removeBtn.innerHTML = originalHTML;
      }
    };

    wireRemarkDetail(tr);
    wireCallingPhoneSave(tr, r);
    const statusLink = tr.querySelector(".statusLink");
    if (statusLink) {
      statusLink.onclick = (e) => {
        e.stopPropagation();
        openInfoModal("Last Status", lastStatusText);
      };
    }
    const addressLinkTr = tr.querySelector(".addressLink");
    if (addressLinkTr) {
      addressLinkTr.onclick = (e) => {
        e.stopPropagation();
        openInfoModal("Full Address", r.Location || "");
      };
    }
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
}

/* ===============================
   ✅ UI events
================================= */
menuToggle.onclick = () => {
  topMenu.classList.toggle("show");
};

document.addEventListener("click", (e) => {
  if (!topMenu.contains(e.target) && !menuToggle.contains(e.target)) {
    topMenu.classList.remove("show");
  }
});

btnToggleView.onclick = () => {
  currentView = currentView === "cards" ? "table" : "cards";
  btnToggleView.textContent = currentView === "cards" ? "Switch to Table" : "Switch to Cards";
  applyAllFilters();
};

document.getElementById("btnScreenshot").onclick = () => {
  if (filtered.length > 100) {
    showToast("Too many users for screenshot!");
    return;
  }

  html2canvas(document.getElementById("contentWrap"), {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff"
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = "complain-manager-screenshot.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("✅ Screenshot downloaded", true);
  }).catch(() => showToast("❌ Screenshot failed"));
};

document.getElementById("btnCsv").onclick = () => {
  if (!visibleRows.length) {
    showToast("No data to export");
    return;
  }

  const headers = [
    "Window", "PON", "User ID", "Registered No", "Calling No", "Name",
    "Mac / Serial", "Power", "Location"
  ];

  const rows = visibleRows.map(r => {
    return [
      r._window || "",
      r.PON || "",
      r.Users || "",
      getRegisteredPhone(r) || "",
      getCallingPhone(r) || "",
      r.Name || "",
      `${r.MAC || ""} / ${r.Serial || ""}`,
      r.Power != null ? Number(r.Power).toFixed(2) : "",
      r.Location || ""
    ];
  });

  const csvContent = [
    headers.map(h => `"${h}"`).join(","),
    ...rows.map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = "complain-manager.csv";
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  showToast("✅ CSV downloaded", true);
};

document.getElementById("windowSelect").onchange = (e) => {
  currentWindow = e.target.value;
  isComplainsView = false;
  visibleLimit = INITIAL_VISIBLE_LIMIT;
  fetchData();
};

document.getElementById("btnComplains").onclick = async () => {
  showSpinner();
  try {
    isComplainsView = true;

    let allData = [];

    if (currentWindow === "ALL") {
      const [a, m, s] = await Promise.all([
        fetch(`${baseUrl}/AMANWIZ/heroesocr_latest`).then(r => r.json()),
        fetch(`${baseUrl}/MEDANTA/heroesocr_latest`).then(r => r.json()),
        fetch(`${baseUrl}/SEVAI/heroesocr_latest`).then(r => r.json())
      ]);

      allData = [
        ...(a.rows || []).map(r => ({ ...r, _window: "AMANWIZ" })),
        ...(m.rows || []).map(r => ({ ...r, _window: "MEDANTA" })),
        ...(s.rows || []).map(r => ({ ...r, _window: "SEVAI" }))
      ];
    } else {
      const res = await fetch(`${baseUrl}/${currentWindow}/heroesocr_latest`);
      const data = await res.json();
      allData = (data.rows || []).map(r => ({ ...r, _window: currentWindow }));
    }

    const statusMapsByWindow = {};
    await Promise.all([...new Set(allData.map(r => r._window).filter(Boolean))].map(async windowName => {
      statusMapsByWindow[windowName] = await fetchLastStatusMap(windowName);
    }));

    rawRows = allData.map(r => prepareRow(mergeLastStatus({
      ...r,
      Users: r.user_id,
      Name: r.name,
      Location: r.address,
      "Registered no": r.registered_phone || r.Phone || "",
      "Calling no": r.calling_phone || "",
      "Last called no": r.calling_phone || r.Phone || r.registered_phone || "",
      PON: r.pon || "",
      "User status": (r.statusUpDown || r["User status"] || "DOWN").toUpperCase(),
      down_list: r.down_list || "",
      downusers: r.downusers || 0,
      _complaint_id: r.id,
      _complain_open: true
    }, statusMapsByWindow[r._window] || new Map())));

    showToast(rawRows.length ? `${rawRows.length} complaints loaded` : "No complaints found");

    populateFilters();
    visibleLimit = INITIAL_VISIBLE_LIMIT;
    applyAllFilters();

  } catch (e) {
    showToast("Failed to load complaints");
  } finally {
    hideSpinner();
  }
};

document.getElementById("btnRefresh").onclick = () => {
  isComplainsView = false;
  visibleLimit = INITIAL_VISIBLE_LIMIT;
  fetchData();
};

globalSearch.oninput = scheduleApplyFilters;
if (powerRange) powerRange.oninput = scheduleApplyFilters;
filterMode.onchange = () => {
  visibleLimit = INITIAL_VISIBLE_LIMIT;
  applyAllFilters();
};
filterStatus.onchange = () => {
  visibleLimit = INITIAL_VISIBLE_LIMIT;
  applyAllFilters();
};

// init
fetchData();
