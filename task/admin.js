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
  client: DEFAULT_CLIENT,
  managerName: "Admin",
  view: "tasks",
  rows: [],
  allLogs: {},
  performanceLoaded: false,
  performanceRows: [],
  performanceDetailRows: [],
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
  return `${parsed.day} ${months[parsed.month - 1]} ${hour12}:${String(parsed.minute).padStart(2, "0")} ${ampm}`;
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
  node.textContent = info.breached
    ? "\u23f1 Breached"
    : `\u23f1 ${formatMinutes(info.remaining)}`;
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
      container.classList.toggle("open");
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
    renderReasonMultiFilter(container, reasons, selectedSet, onChange);
    container.classList.add("open");
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
  state.managerName = "Admin";
  setupClients();
  loadTasks();
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
  button.textContent = "Save";
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
    return (state.client === "All" ? CLIENTS : [state.client]).flatMap((client) => getClosedPairsForClient(client));
  }
  return state.rows;
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
    .filter((row) => reasonMatches(row, state.reasonFilter))
    .filter((row) => teamMatches(row, state.teamFilter))
    .filter((row) => slaMatches(row, state.slaFilter))
    .filter(searchMatches)
    .slice()
    .sort(compareRows);
}

function showAddress(address) {
  els.addressText.textContent = cleanText(address) || "NA";
  els.addressModal.classList.add("open");
}

function render() {
  const rows = filteredRows();
  els.panelTitle.textContent = `Open Complaints (${rows.length})`;
  els.statusText.textContent = "";
  els.taskBody.innerHTML = "";

  if (!rows.length) {
    els.taskBody.innerHTML = `<tr><td colspan="15" class="cell-muted">No rows found</td></tr>`;
    setupTableScrollBars();
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.classList.add(`task-row-${String(row.task || "Pending").trim().toLowerCase() || "pending"}`);
    const taskSelect = makeTaskSelect(row);
    const teamPicker = makeTeamPicker(row);
    const remarkControl = makeRemarkControl(row);
    const slaControl = makeSlaControl(row);
    const createdInput = document.createElement("input");
    createdInput.type = "datetime-local";
    createdInput.value = toDateTimeLocal(row.created_at);
    const saveButton = document.createElement("button");
    saveButton.className = "button";
    saveButton.type = "button";
    saveButton.textContent = "OK";
    saveButton.addEventListener("click", () => saveRow(row, taskSelect, teamPicker, createdInput));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
      <td>${row.client || state.client}</td>
      <td>${valueOf(row, "user_id")}</td>
      <td>${valueOf(row, "name")}</td>
      <td>${valueOf(row, "Phone", "phone", "mobile")}</td>
      <td class="address"></td>
      <td>${valueOf(row, "pon")}</td>
      <td class="reason">${valueOf(row, "reason")}</td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "created_at"))}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    `;

    const address = valueOf(row, "address");
    if (address) {
      const addressLink = document.createElement("button");
      addressLink.className = "link-button address-link";
      addressLink.type = "button";
      addressLink.textContent = shortText(address);
      addressLink.addEventListener("click", () => showAddress(address));
      tr.children[5].appendChild(addressLink);
    }

    tr.children[9].appendChild(createdInput);
    tr.children[10].appendChild(taskSelect);
    tr.children[11].appendChild(teamPicker);
    tr.children[12].appendChild(slaControl);
    tr.children[13].appendChild(saveButton);
    tr.children[14].appendChild(remarkControl);
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
      item.totalMinutes += minutesBetween(row.created_at, row.log_timestamp);
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
    const startInput = document.createElement("input");
    startInput.type = "datetime-local";
    startInput.value = toDateTimeLocal(row.created_at);
    const closeInput = document.createElement("input");
    closeInput.type = "datetime-local";
    closeInput.value = toDateTimeLocal(row.log_timestamp);

    const saveButton = document.createElement("button");
    saveButton.className = "button";
    saveButton.type = "button";
    saveButton.textContent = "OK";
    saveButton.addEventListener("click", () => saveUnallocatedRow(row, startInput, closeInput, teamPicker));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
      <td>${row.client}</td>
      <td>${valueOf(row, "user_id")}</td>
      <td>${valueOf(row, "name")}</td>
      <td class="reason">${valueOf(row, "reason")}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    `;
    tr.children[5].appendChild(startInput);
    tr.children[6].appendChild(closeInput);
    tr.children[7].textContent = slaStatus(row, row.log_timestamp);
    tr.children[8].appendChild(teamPicker);
    tr.children[9].appendChild(saveButton);
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
  state.performanceDetailRows = details;
  if (!details.length) {
    els.performanceDetailBody.innerHTML = `<tr><td colspan="11" class="cell-muted">No tasks found</td></tr>`;
    els.performanceDetailModal.classList.add("open");
    return;
  }
  els.performanceDetailBody.innerHTML = details.map((item, itemIndex) => {
    const takenMinutes = minutesBetween(item.created_at, item.log_timestamp);
    const sla = slaStatus(item, item.log_timestamp);
    const startValue = toDateTimeLocal(item.created_at);
    const closeValue = toDateTimeLocal(item.log_timestamp);
    return `
      <tr>
        <td class="small">${itemIndex + 1}</td>
        <td>${item.client}</td>
        <td>${valueOf(item, "user_id")}</td>
        <td>${valueOf(item, "name")}</td>
        <td class="reason">${valueOf(item, "reason")}</td>
        <td>${valueOf(item, "takenby")}</td>
        <td><input type="datetime-local" class="start-time-input" value="${startValue}"></td>
        <td>${formatCreatedAt(valueOf(item, "actiontime"))}</td>
        <td><input type="datetime-local" class="close-time-input" value="${closeValue}"></td>
        <td>${formatMinutes(takenMinutes)}</td>
        <td>${sla}</td>
        <td><button class="button secondary detail-save" data-detail-index="${itemIndex}" type="button">Save</button></td>
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

async function saveRow(row, taskSelect, teamPicker, createdInput) {
  const payload = {
    _admin: true,
    task: taskSelect.value,
    actiontime: nowLucknow(),
    unpickremark: row.unpickremark || "",
    usermail: state.managerName,
    takenby: teamPicker.getValues().join(","),
    created_at: fromDateTimeLocal(createdInput.value)
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

async function saveUnallocatedRow(row, startInput, closeInput, teamPicker) {
  const team = teamPicker.getValues();
  if (!team.length) {
    toast("Select minimum 1 team member");
    return;
  }
  const startValue = fromDateTimeLocal(startInput.value);
  const payload = {
    _admin: true,
    task: "Pick",
    created_at: startValue,
    log_timestamp: fromDateTimeLocal(closeInput.value),
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
    if (row.open_log_id) {
      const openResponse = await fetch(`${API_BASE}/${row.client}/tasks/complaint_logs/${row.open_log_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _admin: true, created_at: startValue })
      });
      const openData = await openResponse.json().catch(() => ({}));
      if (!openResponse.ok) {
        throw new Error(openData.detail || `HTTP ${openResponse.status}`);
      }
    }
    toast("Record saved");
    state.performanceLoaded = false;
    await loadUnallocated();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

async function savePerformanceDetailTimes(button) {
  const index = Number(button.dataset.detailIndex);
  const row = state.performanceDetailRows[index];
  const tr = button.closest("tr");
  const startInput = tr?.querySelector(".start-time-input");
  const closeInput = tr?.querySelector(".close-time-input");
  if (!row || !startInput || !closeInput) {
    return;
  }
  const startValue = fromDateTimeLocal(startInput.value);
  const payload = {
    _admin: true,
    created_at: startValue,
    log_timestamp: fromDateTimeLocal(closeInput.value)
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
    if (row.open_log_id) {
      const openResponse = await fetch(`${API_BASE}/${row.client}/tasks/complaint_logs/${row.open_log_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _admin: true, created_at: startValue })
      });
      const openData = await openResponse.json().catch(() => ({}));
      if (!openResponse.ok) {
        throw new Error(openData.detail || `HTTP ${openResponse.status}`);
      }
    }
    toast("Start/end time updated");
    state.performanceLoaded = false;
    await loadPerformance();
    els.performanceDetailModal.classList.remove("open");
  } catch (error) {
    toast(`Time update failed: ${error.message}`);
  }
}

function csvCell(value) {
  const text = cleanText(value);
  return `"${text.replace(/"/g, '""')}"`;
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
els.performanceDetailBody.addEventListener("click", (event) => {
  const button = event.target.closest(".detail-save");
  if (button) {
    savePerformanceDetailTimes(button);
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
window.setInterval(updateSlaTimers, 60000);
loadTeamConfig().finally(requireManagerName);
