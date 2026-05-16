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
  managerName: "",
  view: "tasks",
  rows: [],
  allLogs: {},
  performanceLoaded: false,
  performanceRows: [],
  unallocatedLoaded: false,
  unallocatedRows: [],
  teamMembers: [],
  editingTeamId: null
};

const els = {
  clientSelect: document.getElementById("clientSelect"),
  reasonSelect: document.getElementById("reasonSelect"),
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
els.perfFrom = document.getElementById("perfFrom");
els.perfTo = document.getElementById("perfTo");
els.performanceTitle = document.getElementById("performanceTitle");
els.performanceSummary = document.getElementById("performanceSummary");
els.performanceBody = document.getElementById("performanceBody");
els.unallocatedTitle = document.getElementById("unallocatedTitle");
els.unallocatedStatus = document.getElementById("unallocatedStatus");
els.unallocatedBody = document.getElementById("unallocatedBody");
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
  els.teamWindowInput.innerHTML = CLIENTS
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

function compareRows(a, b) {
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
  els.clientSelect.innerHTML = CLIENTS.map((client) => `<option value="${client}">${client}</option>`).join("");
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

function getClosedLogRows() {
  const rows = [];
  for (const client of CLIENTS) {
    for (const row of state.allLogs[client] || []) {
      const action = cleanText(row.action).toLowerCase();
      const task = cleanText(row.task).toLowerCase();
      if (action === "closed" && task === "pick") {
        rows.push({ ...row, client });
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

function setupReasonFilter() {
  const selected = els.reasonSelect.value || "All";
  const reasons = Array.from(new Set(state.rows
    .map((row) => cleanText(row.reason))
    .filter(Boolean)))
    .sort((a, b) => {
      const priorityDiff = reasonPriority(a) - reasonPriority(b);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.localeCompare(b);
    });
  els.reasonSelect.innerHTML = ["All", ...reasons]
    .map((reason) => `<option value="${reason}">${reason}</option>`)
    .join("");
  els.reasonSelect.value = reasons.includes(selected) ? selected : "All";
}

function filteredRows() {
  const reason = els.reasonSelect.value || "All";
  return state.rows
    .filter((row) => reason === "All" || cleanText(row.reason) === reason)
    .slice()
    .sort(compareRows);
}

function showAddress(address) {
  els.addressText.textContent = cleanText(address) || "NA";
  els.addressModal.classList.add("open");
}

function render() {
  const rows = filteredRows();
  els.panelTitle.textContent = `Complaints (${rows.length})`;
  els.statusText.textContent = "";
  els.taskBody.innerHTML = "";

  if (!rows.length) {
    els.taskBody.innerHTML = `<tr><td colspan="11" class="cell-muted">No rows found</td></tr>`;
    setupTableScrollBars();
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.classList.add(`task-row-${String(row.task || "Pending").trim().toLowerCase() || "pending"}`);
    const taskSelect = makeTaskSelect(row);
    const teamPicker = makeTeamPicker(row);
    const saveButton = document.createElement("button");
    saveButton.className = "button";
    saveButton.type = "button";
    saveButton.textContent = "OK";
    saveButton.addEventListener("click", () => saveRow(row, taskSelect, teamPicker));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
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
    `;

    const address = valueOf(row, "address");
    if (address) {
      const addressLink = document.createElement("button");
      addressLink.className = "link-button address-link";
      addressLink.type = "button";
      addressLink.textContent = shortText(address);
      addressLink.addEventListener("click", () => showAddress(address));
      tr.children[4].appendChild(addressLink);
    }

    tr.children[8].appendChild(taskSelect);
    tr.children[9].appendChild(teamPicker);
    tr.children[10].appendChild(saveButton);
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
    splitNames(row.takenby).forEach((name) => {
      if (employee !== "All" && name !== employee) {
        return;
      }
      if (!grouped.has(name)) {
        grouped.set(name, {
          name,
          tasks: 0,
          totalMinutes: 0,
          details: [],
          windows: new Set()
        });
      }
      const item = grouped.get(name);
      item.tasks += 1;
      item.totalMinutes += minutesBetween(row.actiontime, row.log_timestamp);
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
  const avgMinutes = totalTasks ? Math.round(totalMinutes / totalTasks) : 0;
  els.performanceTitle.textContent = `Performance (${rows.length})`;
  els.performanceSummary.innerHTML = `
    <span>Employees: <strong>${rows.length}</strong></span>
    <span>Tasks: <strong>${totalTasks}</strong></span>
    <span>Avg: <strong>${formatMinutes(avgMinutes)}</strong></span>
    <span>Total Time: <strong>${formatMinutes(totalMinutes)}</strong></span>
  `;
  if (!rows.length) {
    els.performanceBody.innerHTML = `<tr><td colspan="6" class="cell-muted">No performance data found</td></tr>`;
    setupTableScrollBars();
    return;
  }
  els.performanceBody.innerHTML = rows.map((row, index) => {
    const avg = row.tasks ? Math.round(row.totalMinutes / row.tasks) : 0;
    return `
      <tr>
        <td class="small">${index + 1}</td>
        <td>${row.name}</td>
        <td><button class="count-button" data-performance-index="${index}" type="button">${row.tasks}</button></td>
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
  for (const client of CLIENTS) {
    for (const row of state.allLogs[client] || []) {
      const action = cleanText(row.action).toLowerCase();
      const task = cleanText(row.task).toLowerCase();
      const takenby = cleanText(row.takenby);
      const actiontime = cleanText(row.actiontime);
      if (action !== "closed") {
        continue;
      }
      if (task !== "pick" || !takenby || !actiontime) {
        rows.push({ ...row, client });
      }
    }
  }
  return rows.sort((a, b) => dateSortValue(b.log_timestamp) - dateSortValue(a.log_timestamp));
}

function renderUnallocated() {
  const rows = getUnallocatedRows();
  state.unallocatedRows = rows;
  els.unallocatedTitle.textContent = `Unallocated Closed (${rows.length})`;
  els.unallocatedStatus.textContent = "";
  if (!rows.length) {
    els.unallocatedBody.innerHTML = `<tr><td colspan="10" class="cell-muted">No unallocated closed tasks found</td></tr>`;
    setupTableScrollBars();
    return;
  }

  els.unallocatedBody.innerHTML = "";
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    const teamPicker = makeTeamPicker(row);
    const pickedInput = document.createElement("input");
    pickedInput.type = "datetime-local";
    pickedInput.value = toDateTimeLocal(row.actiontime || row.created_at || row.log_timestamp);

    const saveButton = document.createElement("button");
    saveButton.className = "button";
    saveButton.type = "button";
    saveButton.textContent = "OK";
    saveButton.addEventListener("click", () => saveUnallocatedRow(row, pickedInput, teamPicker));

    tr.innerHTML = `
      <td class="small">${index + 1}</td>
      <td>${row.client}</td>
      <td>${valueOf(row, "user_id")}</td>
      <td>${valueOf(row, "name")}</td>
      <td class="reason">${valueOf(row, "reason")}</td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "created_at"))}</td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "log_timestamp"))}</td>
      <td></td>
      <td></td>
      <td></td>
    `;
    tr.children[7].appendChild(pickedInput);
    tr.children[8].appendChild(teamPicker);
    tr.children[9].appendChild(saveButton);
    els.unallocatedBody.appendChild(tr);
  });
  setupTableScrollBars();
}

function showPerformanceDetails(index) {
  const row = state.performanceRows[index];
  if (!row) {
    return;
  }
  els.performanceDetailTitle.textContent = `${row.name} - Completed Tasks (${row.details.length})`;
  els.performanceDetailBody.innerHTML = row.details.map((item, itemIndex) => {
    const takenMinutes = minutesBetween(item.actiontime, item.log_timestamp);
    return `
      <tr>
        <td class="small">${itemIndex + 1}</td>
        <td>${item.client}</td>
        <td>${valueOf(item, "user_id")}</td>
        <td>${valueOf(item, "name")}</td>
        <td class="reason">${valueOf(item, "reason")}</td>
        <td>${valueOf(item, "takenby")}</td>
        <td>${formatCreatedAt(valueOf(item, "actiontime"))}</td>
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
    const response = await fetch(`${API_BASE}/${state.client}/tasks`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    state.rows = (data.tables?.complaints?.rows || []).slice().sort(compareRows);
    setupReasonFilter();
    render();
  } catch (error) {
    els.statusText.textContent = "Load failed";
    toast(`Load failed: ${error.message}`);
  }
}

async function loadPerformance() {
  els.performanceTitle.textContent = "Performance";
  els.performanceSummary.innerHTML = "";
  els.performanceBody.innerHTML = `<tr><td colspan="6" class="cell-muted">Loading...</td></tr>`;
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
    renderPerformance();
  } catch (error) {
    els.performanceBody.innerHTML = `<tr><td colspan="6" class="cell-muted">Performance load failed</td></tr>`;
    toast(`Performance load failed: ${error.message}`);
  }
}

async function loadUnallocated() {
  els.unallocatedTitle.textContent = "Unallocated Closed";
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
    renderUnallocated();
  } catch (error) {
    els.unallocatedStatus.textContent = "Load failed";
    els.unallocatedBody.innerHTML = `<tr><td colspan="10" class="cell-muted">Unallocated load failed</td></tr>`;
    toast(`Unallocated load failed: ${error.message}`);
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
  if (showUnallocated && !state.unallocatedLoaded) {
    loadUnallocated();
  }
  if (showTeam) {
    loadTeamConfig();
  }
  window.setTimeout(setupTableScrollBars, 0);
}

async function saveRow(row, taskSelect, teamPicker) {
  const payload = {
    task: taskSelect.value,
    actiontime: nowLucknow(),
    unpickremark: row.unpickremark || "",
    usermail: state.managerName,
    takenby: teamPicker.getValues().join(",")
  };

  try {
    const response = await fetch(`${API_BASE}/${state.client}/tasks/complaints/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `HTTP ${response.status}`);
    }
    toast("Task allocated !!");
    await loadTasks();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

async function saveUnallocatedRow(row, pickedInput, teamPicker) {
  const team = teamPicker.getValues();
  if (!team.length) {
    toast("Select minimum 1 team member");
    return;
  }
  const payload = {
    task: "Pick",
    actiontime: fromDateTimeLocal(pickedInput.value),
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
    toast("Allocation updated !!");
    state.performanceLoaded = false;
    await loadUnallocated();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

els.saveNameButton.addEventListener("click", saveManagerName);
els.managerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveManagerName();
  }
});

els.clientSelect.addEventListener("change", () => {
  state.client = els.clientSelect.value;
  loadTasks();
});

els.reasonSelect.addEventListener("change", render);
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
    showPerformanceDetails(Number(button.dataset.performanceIndex));
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
});

setupDefaultPerformanceDates();
setupTeamWindowInput();
setupTableScrollBars();
loadTeamConfig().finally(requireManagerName);
