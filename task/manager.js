const CLIENTS = ["AMANWIZ", "MEDANTA", "SEVAI"];
const DEFAULT_CLIENT = "MEDANTA";
const API_BASE = window.TASK_API_BASE || "https://app2.vbo.co.in";
let TEAM_MEMBERS = [
  "Sujeet kumar",
  "Rohit tiwari",
  "Jitendra kumar",
  "Anchal shukla",
  "Arun kumar",
  "Sunny singh",
  "Alok vishwakarma"
];

const state = {
  client: "All",
  managerName: "",
  view: "tasks",
  rows: [],
  allLogs: {},
  performanceLoaded: false,
  performanceRows: [],
  unallocatedLoaded: false,
  unallocatedRows: [],
  teamMembers: [],
  editingTeamId: null,
  reasonFilter: new Set(),
  teamFilter: new Set(),
  slaFilter: new Set(),
  performanceReasonFilter: new Set(),
  searchText: ""
};

const els = {
  clientSelect: document.getElementById("clientSelect"),
  reasonSelect: document.getElementById("reasonSelect"),
  teamFilter: document.getElementById("teamFilter"),
  slaFilter: document.getElementById("slaFilter"),
  searchInput: document.getElementById("searchInput"),
  screenshotButton: document.getElementById("screenshotButton"),
  csvButton: document.getElementById("csvButton"),
  refreshButton: document.getElementById("refreshButton"),
  panelTitle: document.getElementById("panelTitle"),
  taskBody: document.getElementById("taskBody"),
  statusText: document.getElementById("statusText"),
  toast: document.getElementById("toast"),
  nameModal: document.getElementById("nameModal"),
  managerNameInput: document.getElementById("managerNameInput"),
  saveNameButton: document.getElementById("saveNameButton"),
  addressModal: document.getElementById("addressModal"),
  addressText: document.getElementById("addressText"),
  closeAddress: document.getElementById("closeAddress")
};
els.tasksPanel = document.getElementById("tasksPanel");
els.performancePanel = document.getElementById("performancePanel");
els.unallocatedPanel = document.getElementById("unallocatedPanel");
els.teamPanel = document.getElementById("teamPanel");
els.viewTabs = Array.from(document.querySelectorAll(".tabbar .tab"));
els.perfEmployee = document.getElementById("perfEmployee");
els.perfReason = document.getElementById("perfReason");
els.perfFrom = document.getElementById("perfFrom");
els.perfTo = document.getElementById("perfTo");
els.performanceTitle = document.getElementById("performanceTitle");
els.performanceSummary = document.getElementById("performanceSummary");
els.performanceBody = document.getElementById("performanceBody");
els.unallocatedTitle = document.getElementById("unallocatedTitle");
els.unallocatedStatus = document.getElementById("unallocatedStatus");
els.unallocatedBody = document.getElementById("unallocatedBody");
els.closedFrom = document.getElementById("closedFrom");
els.closedTo = document.getElementById("closedTo");
els.teamTitle = document.getElementById("teamTitle");
els.teamStatus = document.getElementById("teamStatus");
els.teamNameInput = document.getElementById("teamNameInput");
els.teamWindowInput = document.getElementById("teamWindowInput");
els.teamSaveButton = document.getElementById("teamSaveButton");
els.teamCancelButton = document.getElementById("teamCancelButton");
els.teamBody = document.getElementById("teamBody");
els.performanceDetailModal = document.getElementById("performanceDetailModal");
els.performanceDetailTitle = document.getElementById("performanceDetailTitle");
els.performanceDetailBody = document.getElementById("performanceDetailBody");
els.closePerformanceDetail = document.getElementById("closePerformanceDetail");

function setupTableScrollBars() {
  let fixedScroll = document.querySelector(".fixed-scrollbar");
  if (!fixedScroll) {
    fixedScroll = document.createElement("div");
    fixedScroll.className = "fixed-scrollbar";
    fixedScroll.innerHTML = "<div></div>";
    document.body.appendChild(fixedScroll);
    fixedScroll.addEventListener("scroll", () => {
      const wrap = document.querySelector(".table-wrap.active-scroll");
      if (wrap && wrap.scrollLeft !== fixedScroll.scrollLeft) {
        wrap.scrollLeft = fixedScroll.scrollLeft;
      }
    });
    window.addEventListener("resize", setupTableScrollBars);
  }

  document.querySelectorAll(".table-wrap").forEach((wrap) => {
    wrap.classList.remove("active-scroll");
    if (!wrap.dataset.fixedScrollReady) {
      wrap.dataset.fixedScrollReady = "1";
      wrap.addEventListener("scroll", () => {
        if (wrap.classList.contains("active-scroll") && fixedScroll.scrollLeft !== wrap.scrollLeft) {
          fixedScroll.scrollLeft = wrap.scrollLeft;
        }
      });
    }
  });

  const activeWrap = Array.from(document.querySelectorAll(".panel:not(.hidden) .table-wrap"))[0];
  const scrollSizer = fixedScroll.firstElementChild;
  if (!activeWrap || !scrollSizer) {
    return;
  }
  activeWrap.classList.add("active-scroll");
  scrollSizer.style.width = `${Math.max(activeWrap.scrollWidth, activeWrap.clientWidth)}px`;
  fixedScroll.scrollLeft = activeWrap.scrollLeft;
}

function setupMobileDrawer() {
  const menuToggle = document.querySelector(".menu-toggle");
  const drawerClose = document.querySelector(".drawer-close");
  const drawer = document.querySelector(".topbar > .controls");
  const mobileApply = document.querySelector(".mobile-apply");
  if (!menuToggle || !drawerClose || !drawer) {
    return;
  }
  const closeDrawer = () => document.body.classList.remove("drawer-open");
  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    document.body.classList.add("drawer-open");
  });
  drawerClose.addEventListener("click", closeDrawer);
  if (mobileApply) {
    mobileApply.addEventListener("click", closeDrawer);
  }
  drawer.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", (event) => {
    if (document.body.classList.contains("drawer-open") && !drawer.contains(event.target) && event.target !== menuToggle) {
      closeDrawer();
    }
  });
  els.viewTabs.forEach((tab) => tab.addEventListener("click", closeDrawer));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
}

async function loadTeamConfig() {
  try {
    const response = await fetch(`${API_BASE}/team-config`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    state.teamMembers = data.members || [];
    TEAM_MEMBERS = state.teamMembers.map((member) => member.name).filter(Boolean);
    renderTeamConfig();
  } catch (error) {
    toast(`Team config load failed: ${error.message}`);
  }
}

function setupTeamWindowInput() {
  els.teamWindowInput.innerHTML = ["All", ...CLIENTS]
    .map((client) => `<option value="${client}">${client}</option>`)
    .join("");
  els.teamWindowInput.value = DEFAULT_CLIENT;
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

function stripRemarkTimestamp(value) {
  return String(value || "").replace(/\s*\(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\)\s*$/, "");
}

function valueOf(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUserId(value) {
  return escapeHtml(value).replace(/_/g, "_<wbr>");
}

function shortText(value, limit = 16) {
  const text = cleanText(value);
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
}

function parseDbDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0)
  };
}

function dateSortValue(value) {
  const parsed = parseDbDate(value);
  if (!parsed) {
    return 0;
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, parsed.second).getTime();
}

function dateOnlyValue(value) {
  const parsed = parseDbDate(value);
  if (!parsed) {
    return "";
  }
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
}

function toDateTimeLocal(value) {
  const parsed = parseDbDate(value);
  if (!parsed) {
    return "";
  }
  return [
    parsed.year,
    String(parsed.month).padStart(2, "0"),
    String(parsed.day).padStart(2, "0")
  ].join("-") + `T${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

function fromDateTimeLocal(value) {
  const text = String(value || "").trim();
  if (!text) {
    return nowLucknow();
  }
  return text.replace("T", " ") + ":00";
}

function setupDefaultPerformanceDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  els.perfFrom.value = `${year}-${month}-01`;
  els.perfTo.value = `${year}-${month}-${day}`;
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function setupDefaultClosedDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  els.closedFrom.value = dateInputValue(from);
  els.closedTo.value = dateInputValue(to);
}

function formatCreatedAt(value) {
  const parsed = parseDbDate(value);
  if (!parsed) {
    return value || "";
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour12 = parsed.hour % 12 || 12;
  const ampm = parsed.hour >= 12 ? "PM" : "AM";
  return `${parsed.day} ${months[parsed.month - 1]}<br>${hour12}:${String(parsed.minute).padStart(2, "0")} ${ampm}`;
}

function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) {
    return `${rest} Min`;
  }
  return `${hours} Hrs ${rest} Min`;
}

function formatMinutesTwoLine(totalMinutes) {
  return formatMinutes(totalMinutes).replace(" Hrs ", " Hrs<br>");
}

function minutesBetween(startValue, endValue) {
  const start = dateSortValue(startValue);
  const end = dateSortValue(endValue);
  if (!start || !end || end < start) {
    return 0;
  }
  return Math.round((end - start) / 60000);
}

function workingMinutesBetween(startValue, endValue) {
  const startMs = dateSortValue(startValue);
  const endMs = endValue instanceof Date ? endValue.getTime() : dateSortValue(endValue);
  if (!startMs || !endMs || endMs <= startMs) {
    return 0;
  }
  let total = 0;
  const current = new Date(startMs);
  current.setHours(0, 0, 0, 0);
  while (current.getTime() <= endMs) {
    const dayStart = new Date(current);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(21, 0, 0, 0);
    const from = Math.max(startMs, dayStart.getTime());
    const to = Math.min(endMs, dayEnd.getTime());
    if (to > from) {
      total += Math.round((to - from) / 60000);
    }
    current.setDate(current.getDate() + 1);
  }
  return total;
}

function breachLimitMinutes(reason) {
  const text = cleanText(reason).toLowerCase();
  if (text.includes("no connectivity")) {
    return 240;
  }
  if (text.includes("speed issue")) {
    return 1440;
  }
  if (text.includes("installation")) {
    return 2160;
  }
  if (text.includes("red light") || text === "red" || text.includes(" red ")) {
    return 420;
  }
  if (text.includes("bad power no net")) {
    return 420;
  }
  if (text.includes("frequent speed")) {
    return 1440;
  }
  if (text.includes("shifting request")) {
    return 2160;
  }
  if (text.includes("device recovery")) {
    return 4320;
  }
  return 0;
}

function breachInfo(row, endValue = new Date()) {
  const limit = breachLimitMinutes(row.reason);
  if (!limit) {
    return { applies: false, breached: false, remaining: 0 };
  }
  const used = workingMinutesBetween(row.created_at, endValue);
  return { applies: true, breached: used > limit, remaining: limit - used };
}

function slaStatus(row, endValue) {
  const info = breachInfo(row, endValue);
  if (!info.applies) {
    return "-";
  }
  const used = workingMinutesBetween(row.created_at, endValue);
  return `${info.breached ? "Breached" : "Within SLA"} (${formatMinutes(used)})`;
}

function makeSlaControl(row) {
  const info = breachInfo(row);
  const span = document.createElement("span");
  if (!info.applies) {
    span.className = "cell-muted";
    span.textContent = "-";
    return span;
  }
  span.className = `breach-timer ${info.breached ? "breached" : "safe"}`;
  span.dataset.createdAt = row.created_at || "";
  span.dataset.reason = row.reason || "";
  updateSlaTimerNode(span);
  return span;
}

function updateSlaTimerNode(node) {
  const info = breachInfo({
    created_at: node.dataset.createdAt,
    reason: node.dataset.reason
  });
  node.classList.toggle("breached", info.breached);
  node.classList.toggle("safe", !info.breached);
  node.innerHTML = info.breached
    ? "\u23f1 Breached"
    : formatMinutesTwoLine(info.remaining);
}

function updateSlaTimers() {
  document.querySelectorAll(".breach-timer").forEach(updateSlaTimerNode);
}

function reasonPriority(reason) {
  const text = cleanText(reason).toLowerCase();
  if (text.includes("no connectivity")) {
    return 0;
  }
  if (text.includes("speed issue")) {
    return 1;
  }
  return 2;
}

function pruneReasonFilter(selectedSet, reasons) {
  const allowed = new Set(reasons);
  Array.from(selectedSet).forEach((reason) => {
    if (!allowed.has(reason)) {
      selectedSet.delete(reason);
    }
  });
}

function reasonFilterLabel(selectedSet) {
  if (!selectedSet.size) {
    return "All";
  }
  if (selectedSet.size === 1) {
    return Array.from(selectedSet)[0];
  }
  return `${selectedSet.size} selected`;
}

function reasonMatches(row, selectedSet) {
  return !selectedSet.size || selectedSet.has(cleanText(row.reason));
}

function shouldShowComplaintRow(row) {
  const createdBy = cleanText(valueOf(row, "createdBy", "CreatedBy", "created_by")).toLowerCase();
  if (createdBy !== "system") {
    return true;
  }
  const reason = cleanText(row.reason).toLowerCase();
  return reason.includes("no connectivity") || reason.includes("speed issue");
}

function teamMatches(row, selectedSet) {
  if (!selectedSet.size) {
    return true;
  }
  const names = splitNames(row.takenby).map((name) => name.toLowerCase());
  return Array.from(selectedSet).some((name) => names.includes(name.toLowerCase()));
}

function slaFilterValue(row, endValue = new Date()) {
  const info = breachInfo(row, endValue);
  if (!info.applies) {
    return "";
  }
  return info.breached ? "Breached" : "Within SLA";
}

function slaMatches(row, selectedSet, endValue = new Date()) {
  return !selectedSet.size || selectedSet.has(slaFilterValue(row, endValue));
}

function searchMatches(row) {
  const query = cleanText(state.searchText).toLowerCase();
  if (!query) {
    return true;
  }
  return Object.values(row).some((value) => cleanText(value).toLowerCase().includes(query));
}

function renderReasonMultiFilter(container, reasons, selectedSet, onChange) {
  pruneReasonFilter(selectedSet, reasons);
  const isOpen = container.classList.contains("open");
  container.innerHTML = `
    <button class="multi-filter-button" type="button">
      <span>${reasonFilterLabel(selectedSet)}</span>
      <span class="multi-filter-arrow">▾</span>
    </button>
    <div class="multi-filter-menu">
      <input class="multi-filter-search" type="search" placeholder="Search options">
      <label class="multi-filter-option ${selectedSet.size ? "" : "selected"}" data-value="">
        <input type="checkbox" ${selectedSet.size ? "" : "checked"}>
        <span>All</span>
      </label>
      ${reasons.map((reason) => `
        <label class="multi-filter-option ${selectedSet.has(reason) ? "selected" : ""}" data-value="${escapeHtml(reason)}">
          <input type="checkbox" ${selectedSet.has(reason) ? "checked" : ""}>
          <span>${escapeHtml(reason)}</span>
        </label>
      `).join("")}
    </div>
  `;
  container.classList.toggle("open", isOpen);
  const searchInput = container.querySelector(".multi-filter-search");
  searchInput.addEventListener("input", () => {
    const query = cleanText(searchInput.value).toLowerCase();
    container.querySelectorAll(".multi-filter-option").forEach((option) => {
      const value = cleanText(option.dataset.value || "All").toLowerCase();
      option.hidden = Boolean(query) && !value.includes(query);
    });
  });
  container.onclick = (event) => {
    if (event.target.closest(".multi-filter-search")) {
      return;
    }
    const button = event.target.closest(".multi-filter-button");
    if (button) {
      event.preventDefault();
      const willOpen = !container.classList.contains("open");
      document.querySelectorAll(".multi-filter.open").forEach((filter) => {
        if (filter !== container) {
          filter.classList.remove("open");
        }
      });
      container.classList.toggle("open", willOpen);
      return;
    }
    const option = event.target.closest(".multi-filter-option");
    if (!option) {
      return;
    }
    event.preventDefault();
    const value = option.dataset.value || "";
    if (!value) {
      selectedSet.clear();
    } else if (selectedSet.has(value)) {
      selectedSet.delete(value);
    } else {
      selectedSet.add(value);
    }
    container.classList.remove("open");
    renderReasonMultiFilter(container, reasons, selectedSet, onChange);
    onChange();
  };
}

function compareRows(a, b) {
  if (state.client === "All") {
    const clientDiff = cleanText(a.client).localeCompare(cleanText(b.client));
    if (clientDiff !== 0) {
      return clientDiff;
    }
  }
  const priorityDiff = reasonPriority(a.reason) - reasonPriority(b.reason);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  if (reasonPriority(a.reason) === 2) {
    const reasonDiff = cleanText(a.reason).localeCompare(cleanText(b.reason));
    if (reasonDiff !== 0) {
      return reasonDiff;
    }
  }
  return dateSortValue(a.created_at) - dateSortValue(b.created_at);
}

function setupClients() {
  els.clientSelect.innerHTML = ["All", ...CLIENTS].map((client) => `<option value="${client}">${client}</option>`).join("");
  els.clientSelect.value = state.client;
}

function requireManagerName() {
  const saved = String(localStorage.getItem("taskManagerName") || "").trim();
  if (saved) {
    state.managerName = saved;
    setupClients();
    loadTasks();
    return;
  }
  els.nameModal.classList.add("open");
  els.managerNameInput.focus();
}

function saveManagerName() {
  const name = els.managerNameInput.value.trim();
  if (!name) {
    toast("Manager name is required");
    return;
  }
  localStorage.setItem("taskManagerName", name);
  state.managerName = name;
  els.nameModal.classList.remove("open");
  setupClients();
  loadTasks();
}

function splitNames(value) {
  return String(value || "").split(",").map((name) => name.trim()).filter(Boolean);
}

function logSortValue(row) {
  const id = Number(row.id);
  if (Number.isFinite(id)) {
    return id;
  }
  return dateSortValue(row.log_timestamp || row.created_at);
}

function getClosedPairsForClient(client) {
  const groups = new Map();
  for (const row of state.allLogs[client] || []) {
    const key = cleanText(row.complaint_id) || `${cleanText(row.user_id)}|${cleanText(row.created_at)}|${cleanText(row.pon)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  const rows = [];
  for (const groupRows of groups.values()) {
    const sorted = groupRows.slice().sort((a, b) => logSortValue(a) - logSortValue(b));
    for (let index = 1; index < sorted.length; index += 1) {
      const row = sorted[index];
      const previous = sorted[index - 1];
      const action = cleanText(row.action).toLowerCase();
      const previousAction = cleanText(previous.action).toLowerCase();
      if (action === "closed" && previousAction === "opened") {
        rows.push({
          ...row,
          client,
          open_log_id: previous.id,
          open_created_at: previous.created_at,
          created_at: previous.created_at || row.created_at
        });
      }
    }
  }
  return rows;
}

function getClosedLogRows() {
  const rows = [];
  for (const client of CLIENTS) {
    for (const row of getClosedPairsForClient(client)) {
      const task = cleanText(row.task).toLowerCase();
      if (task === "pick") {
        rows.push(row);
      }
    }
  }
  return rows;
}

function setupEmployeeFilter() {
  const selected = els.perfEmployee.value || "All";
  const names = Array.from(new Set(getClosedLogRows().flatMap((row) => splitNames(row.takenby))))
    .filter(Boolean)
    .sort();
  els.perfEmployee.innerHTML = ["All", ...names]
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");
  els.perfEmployee.value = names.includes(selected) ? selected : "All";
}

function setupPerformanceReasonFilter() {
  const reasons = Array.from(new Set(getClosedLogRows().map((row) => cleanText(row.reason)).filter(Boolean))).sort();
  renderReasonMultiFilter(els.perfReason, reasons, state.performanceReasonFilter, renderPerformance);
}

function makeTaskSelect(row) {
  const select = document.createElement("select");
  select.className = "task-select nice-select";
  const current = String(row.task || "Pending");
  select.innerHTML = ["Pending", "Pick", "Unpick"].map((task) => (
    `<option value="${task}" ${task.toLowerCase() === current.toLowerCase() ? "selected" : ""}>${task}</option>`
  )).join("");
  return select;
}

function makeRunningBadge(row) {
  if (String(row.task || "").trim().toLowerCase() !== "pick") {
    return null;
  }
  const badge = document.createElement("span");
  badge.className = "running-badge";
  badge.title = "Technician working";
  badge.setAttribute("aria-label", "Technician working");
  return badge;
}

function makeRunningTaskSelect(isBreached) {
  const select = document.createElement("select");
  select.className = "task-select nice-select running-select";
  if (isBreached) {
    select.classList.add("breached-running");
  }
  select.innerHTML = `
    <option value="Running" selected hidden>Running</option>
    <option value="Unpick">Unpick</option>
  `;
  return select;
}

function makeTeamPicker(row) {
  const selected = splitNames(row.takenby);
  const members = Array.from(new Set([...TEAM_MEMBERS, ...selected].filter(Boolean))).sort();
  const wrapper = document.createElement("div");
  wrapper.className = "team-picker";
  const box = document.createElement("button");
  box.className = "team-box";
  box.type = "button";
  const menu = document.createElement("div");
  menu.className = "team-menu";

  function drawBox() {
    box.innerHTML = selected.length
      ? selected.map((name) => `<span class="chip">${name}</span>`).join("")
      : `<span class="placeholder">Select team</span>`;
  }

  function drawMenu() {
    menu.innerHTML = members.map((name) => {
      const checked = selected.includes(name) ? "checked" : "";
      return `<label><input type="checkbox" value="${name}" ${checked}> ${name}</label>`;
    }).join("");
  }

  box.addEventListener("click", () => wrapper.classList.toggle("open"));
  menu.addEventListener("change", (event) => {
    const input = event.target;
    if (!input.matches("input[type='checkbox']")) {
      return;
    }
    if (input.checked) {
      selected.push(input.value);
    } else {
      const index = selected.indexOf(input.value);
      if (index >= 0) {
        selected.splice(index, 1);
      }
    }
    drawBox();
  });

  drawBox();
  drawMenu();
  wrapper.appendChild(box);
  wrapper.appendChild(menu);
  wrapper.getValues = () => selected.slice();
  return wrapper;
}

function makeRemarkControl(row) {
  const wrapper = document.createElement("div");
  wrapper.className = "remark-box";
  const input = document.createElement("textarea");
  input.placeholder = "Remark";
  input.value = stripRemarkTimestamp(row.userremark);
  const meta = document.createElement("span");
  meta.className = "remark-meta";
  meta.textContent = row.userremark || "";
  const button = document.createElement("button");
  button.className = "button secondary";
  button.type = "button";
  button.textContent = "Save remarks";
  button.addEventListener("click", () => saveRemark(row, input));
  wrapper.appendChild(input);
  wrapper.appendChild(meta);
  wrapper.appendChild(button);
  return wrapper;
}

function setupReasonFilter() {
  const sourceRows = getTopFilterSourceRows();
  const reasons = Array.from(new Set(sourceRows
    .map((row) => cleanText(row.reason))
    .filter(Boolean)))
    .sort((a, b) => {
      const priorityDiff = reasonPriority(a) - reasonPriority(b);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.localeCompare(b);
    });
  renderReasonMultiFilter(els.reasonSelect, reasons, state.reasonFilter, () => {
    if (state.view === "unallocated") {
      renderUnallocated();
      return;
    }
    render();
  });
}

function getTopFilterSourceRows() {
  if (state.view === "unallocated") {
    return (state.client === "All" ? CLIENTS : [state.client])
      .flatMap((client) => getClosedPairsForClient(client))
      .filter(shouldShowComplaintRow);
  }
  return state.rows.filter(shouldShowComplaintRow);
}

function setupTeamFilter() {
  const names = Array.from(new Set([
    ...TEAM_MEMBERS,
    ...getTopFilterSourceRows().flatMap((row) => splitNames(row.takenby))
  ].filter(Boolean))).sort();
  renderReasonMultiFilter(els.teamFilter, names, state.teamFilter, () => {
    if (state.view === "unallocated") {
      renderUnallocated();
      return;
    }
    render();
  });
}

function setupSlaFilter() {
  renderReasonMultiFilter(els.slaFilter, ["Breached", "Within SLA"], state.slaFilter, () => {
    if (state.view === "unallocated") {
      renderUnallocated();
      return;
    }
    if (state.view === "performance") {
      renderPerformance();
      return;
    }
    render();
  });
}

function filteredRows() {
  return state.rows
    .filter(shouldShowComplaintRow)
    .filter((row) => reasonMatches(row, state.reasonFilter))
    .filter((row) => teamMatches(row, state.teamFilter))
    .filter((row) => slaMatches(row, state.slaFilter))
    .filter(searchMatches)
    .slice()
    .sort(compareRows);
}

function showAddress(row) {
  const data = typeof row === "object" && row ? row : { address: row };
  const fields = [
    ["Name", valueOf(data, "name", "Name")],
    ["Address", valueOf(data, "address", "Location")]
  ];
  els.addressText.innerHTML = "";
  fields.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "info-row";
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    const span = document.createElement("span");
    span.textContent = cleanText(value) || "NA";
    item.appendChild(strong);
    item.appendChild(span);
    els.addressText.appendChild(item);
  });
  if (data.id) {
    const removeButton = makeRemoveComplaintButton(data);
    removeButton.classList.add("info-remove-btn");
    els.addressText.appendChild(removeButton);
  }
  els.addressModal.classList.add("open");
}

function makeInfoButton(row) {
  const button = document.createElement("button");
  button.className = "info-btn";
  button.type = "button";
  button.title = "User info";
  button.textContent = "i";
  button.addEventListener("click", () => showAddress(row));
  return button;
}

function makeRemoveComplaintButton(row) {
  const button = document.createElement("button");
  button.className = "remove-btn";
  button.type = "button";
  button.title = "Remove complaint";
  button.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    removeComplaint(row, button);
  });
  return button;
}

function confirmRemoveComplaint(row) {
  return new Promise((resolve) => {
    let modal = document.getElementById("removeConfirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "removeConfirmModal";
      modal.className = "modal-backdrop confirm-backdrop";
      modal.innerHTML = `
        <div class="modal confirm-modal">
          <h2>Remove Complaint?</h2>
          <div class="confirm-user" id="removeConfirmUser"></div>
          <div class="modal-actions">
            <button class="button secondary" id="cancelRemoveComplaint" type="button">Cancel</button>
            <button class="remove-btn confirm-remove-btn" id="confirmRemoveComplaint" type="button"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    const user = modal.querySelector("#removeConfirmUser");
    user.textContent = `${cleanText(valueOf(row, "user_id")) || "NA"} - ${cleanText(valueOf(row, "name")) || "NA"}`;
    const close = (answer) => {
      modal.classList.remove("open");
      resolve(answer);
    };
    modal.querySelector("#cancelRemoveComplaint").onclick = () => close(false);
    modal.querySelector("#confirmRemoveComplaint").onclick = () => close(true);
    modal.onclick = (event) => {
      if (event.target === modal) {
        close(false);
      }
    };
    modal.classList.add("open");
  });
}

async function removeComplaint(row, button) {
  if (!(await confirmRemoveComplaint(row))) {
    return;
  }
  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.textContent = "...";
  const payload = {
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
  try {
    const response = await fetch(`${API_BASE}/${row.client || state.client}/delete_complain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (data.status !== "ok" && data.status !== "skipped")) {
      throw new Error(data.message || data.detail || `HTTP ${response.status}`);
    }
    toast("Complaint removed successfully");
    els.addressModal.classList.remove("open");
    await loadTasks();
  } catch (error) {
    toast(`Remove failed: ${error.message}`);
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}

function render() {
  const rows = filteredRows();
  els.panelTitle.textContent = `Open Complaints (${rows.length})`;
  els.statusText.textContent = "";
  els.taskBody.innerHTML = "";

  if (!rows.length) {
    els.taskBody.innerHTML = `<tr><td colspan="12" class="cell-muted">No rows found</td></tr>`;
    setupTableScrollBars();
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.classList.add(`task-row-${String(row.task || "Pending").trim().toLowerCase() || "pending"}`);
    const isRunning = String(row.task || "").trim().toLowerCase() === "pick";
    const taskSelect = isRunning ? makeRunningTaskSelect(breachInfo(row).breached) : makeTaskSelect(row);
    const teamPicker = makeTeamPicker(row);
    const remarkControl = makeRemarkControl(row);
    const slaControl = makeSlaControl(row);
    const saveButton = document.createElement("button");
    saveButton.className = "button";
    saveButton.type = "button";
    saveButton.textContent = "Assign team";
    saveButton.classList.toggle("assign-disabled", isRunning);
    taskSelect.addEventListener("change", () => {
      saveButton.classList.toggle("assign-disabled", taskSelect.value === "Running");
    });
    saveButton.addEventListener("click", () => saveRow(row, taskSelect, teamPicker));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
      <td>${row.client || state.client}</td>
      <td><span class="user-id-cell">${formatUserId(valueOf(row, "user_id"))}</span></td>
      
<td>${Array.from(new Set([
  valueOf(row, "Phone"),
  valueOf(row, "registered_phone"),
  valueOf(row, "calling_phone")
].map(v => String(v || "").trim()).filter(Boolean))).join(", ")}</td>
      
      <td class="reason">${valueOf(row, "reason")}</td>
      <td></td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "created_at"))}</td>
      <td></td>
      <td></td>
      <td>${valueOf(row, "Power", "power", "rxPower")}</td>
      <td></td>
      <td class="address action-cell"></td>
    `;

    tr.children[11].appendChild(makeInfoButton(row));
    tr.children[11].appendChild(makeRemoveComplaintButton(row));

    tr.children[7].appendChild(taskSelect);
    tr.children[8].appendChild(teamPicker);
    tr.children[8].classList.add("team-action-cell");
    tr.children[5].appendChild(slaControl);
    tr.children[8].appendChild(saveButton);
    tr.children[10].appendChild(remarkControl);
    els.taskBody.appendChild(tr);
  });
  setupTableScrollBars();
}

function getPerformanceRows() {
  const from = els.perfFrom.value;
  const to = els.perfTo.value;
  const employee = els.perfEmployee.value || "All";
  const grouped = new Map();

  getClosedLogRows().forEach((row) => {
    const closedDate = dateOnlyValue(row.log_timestamp);
    if (!shouldShowComplaintRow(row)) {
      return;
    }
    if (from && closedDate && closedDate < from) {
      return;
    }
    if (to && closedDate && closedDate > to) {
      return;
    }
    if (!reasonMatches(row, state.performanceReasonFilter)) {
      return;
    }
    if (!slaMatches(row, state.slaFilter, row.log_timestamp)) {
      return;
    }
    splitNames(row.takenby).forEach((name) => {
      if (employee !== "All" && name !== employee) {
        return;
      }
      if (!grouped.has(name)) {
        grouped.set(name, {
          name,
          tasks: 0,
          totalMinutes: 0,
          breached: 0,
          details: [],
          windows: new Set()
        });
      }
      const item = grouped.get(name);
      item.tasks += 1;
      item.totalMinutes += workingMinutesBetween(row.created_at, row.log_timestamp);
      if (breachInfo(row, row.log_timestamp).breached) {
        item.breached += 1;
      }
      item.details.push(row);
      item.windows.add(row.client);
    });
  });

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      details: row.details.sort((a, b) => dateSortValue(b.log_timestamp) - dateSortValue(a.log_timestamp))
    }))
    .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name));
}

function renderPerformance() {
  const rows = getPerformanceRows();
  state.performanceRows = rows;
  const totalTasks = rows.reduce((sum, row) => sum + row.tasks, 0);
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const totalBreached = rows.reduce((sum, row) => sum + row.breached, 0);
  const avgMinutes = totalTasks ? Math.round(totalMinutes / totalTasks) : 0;
  els.performanceTitle.textContent = `Performance (${rows.length})`;
  els.performanceSummary.innerHTML = `
    <span>Employees: <strong>${rows.length}</strong></span>
    <span>Tasks: <strong>${totalTasks}</strong></span>
    <span>Avg: <strong>${formatMinutes(avgMinutes)}</strong></span>
    <span>Total Time: <strong>${formatMinutes(totalMinutes)}</strong></span>
    <span>Breached: <strong>${totalBreached}</strong></span>
  `;
  if (!rows.length) {
    els.performanceBody.innerHTML = `<tr><td colspan="7" class="cell-muted">No performance data found</td></tr>`;
    setupTableScrollBars();
    return;
  }
  els.performanceBody.innerHTML = rows.map((row, index) => {
    const avg = row.tasks ? Math.round(row.totalMinutes / row.tasks) : 0;
    return `
      <tr>
        <td class="small">${index + 1}</td>
        <td>${row.name}</td>
        <td><button class="count-button" data-performance-index="${index}" data-detail-mode="breached" type="button">${row.breached}</button></td>
        <td><button class="count-button" data-performance-index="${index}" data-detail-mode="all" type="button">${row.tasks}</button></td>
        <td>${formatMinutes(avg)}</td>
        <td>${formatMinutes(row.totalMinutes)}</td>
        <td>${Array.from(row.windows).sort().join(", ")}</td>
      </tr>
    `;
  }).join("");
  setupTableScrollBars();
}

function getUnallocatedRows() {
  const rows = [];
  const clients = state.client === "All" ? CLIENTS : [state.client];
  for (const client of clients) {
    rows.push(...getClosedPairsForClient(client));
  }
  return rows
    .filter(shouldShowComplaintRow)
    .filter((row) => reasonMatches(row, state.reasonFilter))
    .filter((row) => teamMatches(row, state.teamFilter))
    .filter((row) => slaMatches(row, state.slaFilter, row.log_timestamp))
    .filter(searchMatches)
    .filter((row) => {
      const closedDate = dateOnlyValue(row.log_timestamp);
      return (!els.closedFrom.value || closedDate >= els.closedFrom.value)
        && (!els.closedTo.value || closedDate <= els.closedTo.value);
    })
    .sort((a, b) => dateSortValue(b.log_timestamp) - dateSortValue(a.log_timestamp));
}

function renderUnallocated() {
  const rows = getUnallocatedRows();
  state.unallocatedRows = rows;
  els.unallocatedTitle.textContent = `Closed Tasks (${rows.length})`;
  els.unallocatedStatus.textContent = "";
  if (!rows.length) {
    els.unallocatedBody.innerHTML = `<tr><td colspan="10" class="cell-muted">No closed tasks found</td></tr>`;
    setupTableScrollBars();
    return;
  }

  els.unallocatedBody.innerHTML = "";
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    const teamPicker = makeTeamPicker(row);

    const saveButton = document.createElement("button");
    saveButton.className = "button";
    saveButton.type = "button";
    saveButton.textContent = "OK";
    saveButton.addEventListener("click", () => saveUnallocatedRow(row, teamPicker));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
      <td>${row.client}</td>
      <td><span class="user-id-cell">${formatUserId(valueOf(row, "user_id"))}</span></td>
      <td>${valueOf(row, "name")}</td>
      <td class="reason">${valueOf(row, "reason")}</td>
      <td>${slaStatus(row, row.log_timestamp)}</td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "created_at"))}</td>
      <td></td>
      <td></td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "log_timestamp"))}</td>
    `;
    tr.children[7].appendChild(teamPicker);
    tr.children[8].appendChild(saveButton);
    els.unallocatedBody.appendChild(tr);
  });
  setupTableScrollBars();
}

function showPerformanceDetails(index, mode = "all") {
  const row = state.performanceRows[index];
  if (!row) {
    return;
  }
  const details = mode === "breached"
    ? row.details.filter((item) => breachInfo(item, item.log_timestamp).breached)
    : row.details;
  els.performanceDetailTitle.textContent = `${row.name} - ${mode === "breached" ? "Breached Tasks" : "Completed Tasks"} (${details.length})`;
  if (!details.length) {
    els.performanceDetailBody.innerHTML = `<tr><td colspan="10" class="cell-muted">No tasks found</td></tr>`;
    els.performanceDetailModal.classList.add("open");
    return;
  }
  els.performanceDetailBody.innerHTML = details.map((item, itemIndex) => {
    const takenMinutes = workingMinutesBetween(item.created_at, item.log_timestamp);
    const sla = slaStatus(item, item.log_timestamp);
    return `
      <tr>
        <td class="small">${itemIndex + 1}</td>
        <td>${item.client}</td>
        <td><span class="user-id-cell">${formatUserId(valueOf(item, "user_id"))}</span></td>
        <td>${valueOf(item, "name")}</td>
        <td class="reason">${valueOf(item, "reason")}</td>
        <td>${sla}</td>
        <td>${formatCreatedAt(valueOf(item, "actiontime"))}</td>
        <td>${valueOf(item, "takenby")}</td>
        <td>${formatCreatedAt(valueOf(item, "log_timestamp"))}</td>
        <td>${formatMinutes(takenMinutes)}</td>
      </tr>
    `;
  }).join("");
  els.performanceDetailModal.classList.add("open");
}

function clearTeamForm() {
  state.editingTeamId = null;
  els.teamNameInput.value = "";
  els.teamWindowInput.value = DEFAULT_CLIENT;
  els.teamSaveButton.textContent = "Add";
}

function renderTeamConfig() {
  els.teamTitle.textContent = `Team Members (${state.teamMembers.length})`;
  els.teamStatus.textContent = "";
  if (!state.teamMembers.length) {
    els.teamBody.innerHTML = `<tr><td colspan="4" class="cell-muted">No team members found</td></tr>`;
    setupTableScrollBars();
    return;
  }
  els.teamBody.innerHTML = "";
  state.teamMembers.forEach((member, index) => {
    const tr = document.createElement("tr");
    const editButton = document.createElement("button");
    editButton.className = "button secondary";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      state.editingTeamId = member.id;
      els.teamNameInput.value = member.name || "";
      els.teamWindowInput.value = member.default_window || DEFAULT_CLIENT;
      els.teamSaveButton.textContent = "Update";
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "button secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Remove";
    deleteButton.addEventListener("click", () => deleteTeamMember(member.id));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
      <td>${member.name || ""}</td>
      <td>${member.default_window || ""}</td>
      <td class="actions-cell"></td>
    `;
    tr.children[3].appendChild(editButton);
    tr.children[3].appendChild(deleteButton);
    els.teamBody.appendChild(tr);
  });
  setupTableScrollBars();
}

async function saveTeamMember() {
  const payload = {
    name: els.teamNameInput.value.trim(),
    default_window: els.teamWindowInput.value
  };
  if (!payload.name) {
    toast("Name is required");
    return;
  }

  try {
    const url = state.editingTeamId
      ? `${API_BASE}/team-config/${state.editingTeamId}`
      : `${API_BASE}/team-config`;
    const response = await fetch(url, {
      method: state.editingTeamId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    toast("Team updated");
    clearTeamForm();
    await loadTeamConfig();
  } catch (error) {
    toast(`Team update failed: ${error.message}`);
  }
}

async function deleteTeamMember(memberId) {
  try {
    const response = await fetch(`${API_BASE}/team-config/${memberId}`, {
      method: "DELETE"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    toast("Team member removed");
    clearTeamForm();
    await loadTeamConfig();
  } catch (error) {
    toast(`Remove failed: ${error.message}`);
  }
}

async function loadTasks() {
  els.panelTitle.textContent = "Complaints";
  els.statusText.textContent = "Loading...";
  try {
    if (state.client === "All") {
      const results = await Promise.all(CLIENTS.map(async (client) => {
        const response = await fetch(`${API_BASE}/${client}/tasks`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`${client} HTTP ${response.status}`);
        }
        const data = await response.json();
        return (data.tables?.complaints?.rows || []).map((row) => ({ ...row, client }));
      }));
      state.rows = results.flat().sort(compareRows);
    } else {
      const response = await fetch(`${API_BASE}/${state.client}/tasks`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      state.rows = (data.tables?.complaints?.rows || []).map((row) => ({ ...row, client: state.client })).sort(compareRows);
    }
    setupReasonFilter();
    setupTeamFilter();
    setupSlaFilter();
    render();
  } catch (error) {
    els.statusText.textContent = "Load failed";
    toast(`Load failed: ${error.message}`);
  }
}

async function loadPerformance() {
  els.performanceTitle.textContent = "Performance";
  els.performanceSummary.innerHTML = "";
  els.performanceBody.innerHTML = `<tr><td colspan="7" class="cell-muted">Loading...</td></tr>`;
  try {
    const results = await Promise.all(CLIENTS.map(async (client) => {
      const response = await fetch(`${API_BASE}/${client}/tasks`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${client} HTTP ${response.status}`);
      }
      const data = await response.json();
      return [client, data.tables?.complaint_logs?.rows || []];
    }));
    state.allLogs = Object.fromEntries(results);
    state.performanceLoaded = true;
    setupEmployeeFilter();
    setupPerformanceReasonFilter();
    setupSlaFilter();
    renderPerformance();
  } catch (error) {
    els.performanceBody.innerHTML = `<tr><td colspan="7" class="cell-muted">Performance load failed</td></tr>`;
    toast(`Performance load failed: ${error.message}`);
  }
}

async function loadUnallocated() {
  els.unallocatedTitle.textContent = "Closed Tasks";
  els.unallocatedStatus.textContent = "Loading...";
  els.unallocatedBody.innerHTML = `<tr><td colspan="10" class="cell-muted">Loading...</td></tr>`;
  try {
    const results = await Promise.all(CLIENTS.map(async (client) => {
      const response = await fetch(`${API_BASE}/${client}/tasks`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${client} HTTP ${response.status}`);
      }
      const data = await response.json();
      return [client, data.tables?.complaint_logs?.rows || []];
    }));
    state.allLogs = Object.fromEntries(results);
    state.unallocatedLoaded = true;
    setupReasonFilter();
    setupTeamFilter();
    setupSlaFilter();
    renderUnallocated();
  } catch (error) {
    els.unallocatedStatus.textContent = "Load failed";
    els.unallocatedBody.innerHTML = `<tr><td colspan="10" class="cell-muted">Closed task load failed</td></tr>`;
    toast(`Closed task load failed: ${error.message}`);
  }
}

function switchView(view) {
  state.view = view;
  const showPerformance = view === "performance";
  const showUnallocated = view === "unallocated";
  const showTeam = view === "team";
  els.tasksPanel.classList.toggle("hidden", showPerformance || showUnallocated || showTeam);
  els.performancePanel.classList.toggle("hidden", !showPerformance);
  els.unallocatedPanel.classList.toggle("hidden", !showUnallocated);
  els.teamPanel.classList.toggle("hidden", !showTeam);
  els.viewTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  if (showPerformance && !state.performanceLoaded) {
    loadPerformance();
  }
  if (showUnallocated) {
    if (!state.unallocatedLoaded) {
      loadUnallocated();
    } else {
      setupReasonFilter();
      setupTeamFilter();
      setupSlaFilter();
      renderUnallocated();
    }
  }
  if (showTeam) {
    loadTeamConfig();
  }
  if (!showPerformance && !showUnallocated && !showTeam) {
    setupReasonFilter();
    setupTeamFilter();
    setupSlaFilter();
    render();
  }
  window.setTimeout(setupTableScrollBars, 0);
}

async function saveRow(row, taskSelect, teamPicker) {
  if (taskSelect.value === "Running") {
    toast("Task is running. Select Unpick first before assigning team.");
    return;
  }
  const payload = {
    task: taskSelect.value,
    actiontime: nowLucknow(),
    unpickremark: row.unpickremark || "",
    usermail: state.managerName,
    takenby: teamPicker.getValues().join(",")
  };

  try {
    const response = await fetch(`${API_BASE}/${row.client || state.client}/tasks/complaints/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    toast("Record saved");
    await loadTasks();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

async function saveRemark(row, input) {
  const remark = input.value.trim();
  const payload = {
    userremark: remark ? `${remark} (${nowLucknow()})` : ""
  };
  try {
    const response = await fetch(`${API_BASE}/${row.client || state.client}/tasks/complaints/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    toast("Remark saved");
    await loadTasks();
  } catch (error) {
    toast(`Remark update failed: ${error.message}`);
  }
}

async function saveUnallocatedRow(row, teamPicker) {
  const team = teamPicker.getValues();
  if (!team.length) {
    toast("Select minimum 1 team member");
    return;
  }
  const payload = {
    task: "Pick",
    actiontime: row.actiontime || "",
    unpickremark: row.unpickremark || "",
    usermail: state.managerName,
    takenby: team.join(",")
  };

  try {
    const response = await fetch(`${API_BASE}/${row.client}/tasks/complaint_logs/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    toast("Record saved");
    state.performanceLoaded = false;
    await loadUnallocated();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

function csvCell(value) {
  const text = cleanText(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function tableCellText(cell) {
  const textarea = cell.querySelector("textarea");
  if (textarea) {
    return cleanText(textarea.value || cell.textContent);
  }
  const select = cell.querySelector("select");
  if (select) {
    return cleanText(select.selectedOptions[0]?.textContent || select.value);
  }
  const input = cell.querySelector("input");
  if (input && input.type !== "checkbox") {
    return cleanText(input.value);
  }
  return cleanText(cell.textContent);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = cleanText(text).split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !line) {
      line = testLine;
      return;
    }
    lines.push(line);
    line = word;
  });
  if (line) {
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function downloadTablePng() {
  const panel = document.querySelector(".panel:not(.hidden)");
  const table = panel?.querySelector("table");
  if (!table) {
    toast("No table found");
    return;
  }
  const headers = Array.from(table.tHead?.rows[0]?.cells || []).map((cell) => tableCellText(cell));
  const bodyRows = Array.from(table.tBodies[0]?.rows || []).map((row) => Array.from(row.cells).map(tableCellText));
  if (!headers.length || !bodyRows.length) {
    toast("No table data");
    return;
  }

  const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = "13px Segoe UI, Arial";
  const columns = headers.map((header, index) => {
    const values = [header, ...bodyRows.map((row) => row[index] || "")];
    const longestWord = values.flatMap((value) => cleanText(value).split(" ")).reduce((max, word) => Math.max(max, measureCtx.measureText(word).width), 0);
    const longestText = values.reduce((max, value) => Math.max(max, measureCtx.measureText(cleanText(value)).width), 0);
    return Math.ceil(Math.min(210, Math.max(64, longestWord + 24, Math.min(longestText + 24, 150))));
  });
  const tableWidth = columns.reduce((sum, width) => sum + width, 0);
  const rowLines = bodyRows.map((row) => row.map((text, index) => wrapCanvasText(measureCtx, text, columns[index] - 16)));
  const rowHeights = rowLines.map((lines) => Math.max(34, Math.max(...lines.map((lineSet) => lineSet.length)) * 17 + 16));
  const headerHeight = 38;
  const titleHeight = 42;
  const canvasWidth = tableWidth + 2;
  const canvasHeight = titleHeight + headerHeight + rowHeights.reduce((sum, height) => sum + height, 0) + 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(canvasWidth * scale);
  canvas.height = Math.ceil(canvasHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#101828";
  ctx.font = "700 16px Segoe UI, Arial";
  ctx.fillText(cleanText(panel.querySelector(".panel-head strong")?.textContent || document.title), 12, 26);

  let x = 1;
  let y = titleHeight;
  ctx.font = "700 12px Segoe UI, Arial";
  headers.forEach((header, index) => {
    ctx.fillStyle = "#f5f8fb";
    ctx.fillRect(x, y, columns[index], headerHeight);
    ctx.strokeStyle = "#d5dde8";
    ctx.strokeRect(x, y, columns[index], headerHeight);
    ctx.fillStyle = "#253249";
    wrapCanvasText(ctx, header, columns[index] - 16).slice(0, 2).forEach((line, lineIndex) => {
      ctx.fillText(line, x + 8, y + 15 + lineIndex * 14);
    });
    x += columns[index];
  });
  y += headerHeight;

  ctx.font = "12px Segoe UI, Arial";
  bodyRows.forEach((row, rowIndex) => {
    x = 1;
    const height = rowHeights[rowIndex];
    row.forEach((cell, columnIndex) => {
      ctx.fillStyle = rowIndex % 2 ? "#fbfdff" : "#ffffff";
      ctx.fillRect(x, y, columns[columnIndex], height);
      ctx.strokeStyle = "#e7edf4";
      ctx.strokeRect(x, y, columns[columnIndex], height);
      ctx.fillStyle = "#101828";
      rowLines[rowIndex][columnIndex].forEach((line, lineIndex) => {
        ctx.fillText(line, x + 8, y + 18 + lineIndex * 17);
      });
      x += columns[columnIndex];
    });
    y += height;
  });

  const link = document.createElement("a");
  link.download = `${cleanText(panel.id || "table")}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast("PNG downloaded");
}

function downloadCsv() {
  let filename = "tasks.csv";
  let headers = [];
  let rows = [];
  if (state.view === "unallocated") {
    filename = "closed-tasks.csv";
    headers = ["Window", "User ID", "Name", "Reason", "Start Time", "End Time", "SLA", "Team"];
    rows = getUnallocatedRows().map((row) => [
      row.client,
      valueOf(row, "user_id"),
      valueOf(row, "name"),
      valueOf(row, "reason"),
      valueOf(row, "created_at"),
      valueOf(row, "log_timestamp"),
      slaStatus(row, row.log_timestamp),
      valueOf(row, "takenby")
    ]);
  } else if (state.view === "performance") {
    filename = "performance.csv";
    headers = ["Employee", "Breached", "Tasks", "Avg Time", "Total Time", "Windows"];
    rows = getPerformanceRows().map((row) => {
      const avg = row.tasks ? Math.round(row.totalMinutes / row.tasks) : 0;
      return [row.name, row.breached, row.tasks, formatMinutes(avg), formatMinutes(row.totalMinutes), Array.from(row.windows).sort().join(", ")];
    });
  } else if (state.view === "team") {
    filename = "team.csv";
    headers = ["Name", "Default Window"];
    rows = state.teamMembers.map((member) => [member.name, member.default_window]);
  } else {
    filename = "open-tasks.csv";
    headers = ["Window", "User ID", "Name", "Mobile No", "Address", "Pon No", "Reason", "Created At", "Task", "Team", "SLA", "Remark"];
    rows = filteredRows().map((row) => [
      row.client || state.client,
      valueOf(row, "user_id"),
      valueOf(row, "name"),
      valueOf(row, "Phone", "phone", "mobile"),
      valueOf(row, "address"),
      valueOf(row, "pon"),
      valueOf(row, "reason"),
      valueOf(row, "created_at"),
      valueOf(row, "task"),
      valueOf(row, "takenby"),
      slaStatus(row, new Date()),
      valueOf(row, "userremark")
    ]);
  }
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

els.saveNameButton.addEventListener("click", saveManagerName);
els.managerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveManagerName();
  }
});

els.clientSelect.addEventListener("change", () => {
  state.client = els.clientSelect.value;
  if (state.view === "unallocated") {
    state.unallocatedLoaded = false;
    loadUnallocated();
    return;
  }
  if (state.view === "performance") {
    state.performanceLoaded = false;
    loadPerformance();
    return;
  }
  loadTasks();
});

els.searchInput.addEventListener("input", () => {
  state.searchText = els.searchInput.value;
  if (state.view === "unallocated") {
    renderUnallocated();
    return;
  }
  if (state.view === "performance") {
    renderPerformance();
    return;
  }
  render();
});
els.closedFrom.addEventListener("change", renderUnallocated);
els.closedTo.addEventListener("change", renderUnallocated);
els.screenshotButton.addEventListener("click", downloadTablePng);
els.csvButton.addEventListener("click", downloadCsv);
els.refreshButton.addEventListener("click", () => {
  if (state.view === "performance") {
    state.performanceLoaded = false;
    loadPerformance();
    return;
  }
  if (state.view === "unallocated") {
    state.unallocatedLoaded = false;
    loadUnallocated();
    return;
  }
  if (state.view === "team") {
    loadTeamConfig();
    return;
  }
  loadTasks();
});
els.perfEmployee.addEventListener("change", renderPerformance);
els.perfFrom.addEventListener("change", renderPerformance);
els.perfTo.addEventListener("change", renderPerformance);
els.performanceBody.addEventListener("click", (event) => {
  const button = event.target.closest(".count-button");
  if (button) {
    showPerformanceDetails(Number(button.dataset.performanceIndex), button.dataset.detailMode || "all");
  }
});
els.teamSaveButton.addEventListener("click", saveTeamMember);
els.teamCancelButton.addEventListener("click", clearTeamForm);
els.viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

els.closeAddress.addEventListener("click", () => {
  els.addressModal.classList.remove("open");
});

els.closePerformanceDetail.addEventListener("click", () => {
  els.performanceDetailModal.classList.remove("open");
});

els.addressModal.addEventListener("click", (event) => {
  if (event.target === els.addressModal) {
    els.addressModal.classList.remove("open");
  }
});

els.performanceDetailModal.addEventListener("click", (event) => {
  if (event.target === els.performanceDetailModal) {
    els.performanceDetailModal.classList.remove("open");
  }
});

document.addEventListener("click", (event) => {
  document.querySelectorAll(".team-picker.open").forEach((picker) => {
    if (!picker.contains(event.target)) {
      picker.classList.remove("open");
    }
  });
  document.querySelectorAll(".multi-filter.open").forEach((filter) => {
    if (!filter.contains(event.target)) {
      filter.classList.remove("open");
    }
  });
});

setupDefaultPerformanceDates();
setupDefaultClosedDates();
setupTeamWindowInput();
setupTableScrollBars();
setupMobileDrawer();
window.setInterval(updateSlaTimers, 60000);
loadTeamConfig().finally(requireManagerName);
