const CLIENTS = ["AMANWIZ", "MEDANTA", "SEVAI"];
const DEFAULT_CLIENT = "MEDANTA";
const API_BASE = window.TASK_API_BASE || "https://app2.vbo.co.in";
const FORCE_CLOSE_MARKER = "--FC--";
let EMPLOYEE_WINDOW_MAP = {
  "Sujeet kumar": "MEDANTA",
  "Rohit tiwari": "MEDANTA",
  "Jitendra kumar": "MEDANTA",
  "Anchal shukla": "MEDANTA",
  "Arun kumar": "MEDANTA",
  "Sunny singh": "MEDANTA",
  "Alok vishwakarma": "MEDANTA"
};
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
  employeeName: "",
  view: "tasks",
  rows: [],
  allRows: {},
  allLogs: {},
  performanceLoaded: false,
  pendingUnpick: null,
  pendingPick: null
};

const els = {
  clientSelect: document.getElementById("clientSelect"),
  reasonSelect: document.getElementById("reasonSelect"),
  screenshotButton: document.getElementById("screenshotButton"),
  refreshButton: document.getElementById("refreshButton"),
  panelTitle: document.getElementById("panelTitle"),
  taskBody: document.getElementById("taskBody"),
  statusText: document.getElementById("statusText"),
  toast: document.getElementById("toast"),
  nameModal: document.getElementById("nameModal"),
  employeeNameInput: document.getElementById("employeeNameInput"),
  saveNameButton: document.getElementById("saveNameButton"),
  unpickModal: document.getElementById("unpickModal"),
  unpickRemark: document.getElementById("unpickRemark"),
  cancelUnpick: document.getElementById("cancelUnpick"),
  confirmUnpick: document.getElementById("confirmUnpick"),
  pickTeamModal: document.getElementById("pickTeamModal"),
  pickTeamHolder: document.getElementById("pickTeamHolder"),
  cancelPickTeam: document.getElementById("cancelPickTeam"),
  confirmPickTeam: document.getElementById("confirmPickTeam"),
  addressModal: document.getElementById("addressModal"),
  addressText: document.getElementById("addressText"),
  closeAddress: document.getElementById("closeAddress")
};
els.tasksPanel = document.getElementById("tasksPanel");
els.performancePanel = document.getElementById("performancePanel");
els.viewTabs = Array.from(document.querySelectorAll(".tabbar .tab"));
els.taskSearch = document.getElementById("taskSearch");
els.taskFrom = document.getElementById("taskFrom");
els.taskTo = document.getElementById("taskTo");
els.perfFrom = document.getElementById("perfFrom");
els.perfTo = document.getElementById("perfTo");
els.perfSearch = document.getElementById("perfSearch");
els.performanceTitle = document.getElementById("performanceTitle");
els.performanceSummary = document.getElementById("performanceSummary");
els.performanceBody = document.getElementById("performanceBody");

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
    const members = data.members || [];
    if (!members.length) {
      return;
    }
    TEAM_MEMBERS = members.map((member) => member.name).filter(Boolean);
    EMPLOYEE_WINDOW_MAP = {};
    members.forEach((member) => {
      if (member.name && member.default_window) {
        EMPLOYEE_WINDOW_MAP[member.name] = member.default_window;
      }
    });
  } catch (error) {
    toast(`Team config load failed: ${error.message}`);
  }
}

function normalizeTask(value) {
  return String(value || "Pending").trim() || "Pending";
}

function isPick(row) {
  return normalizeTask(row.task).toLowerCase() === "pick";
}

function isPendingOrUnpick(row) {
  const task = normalizeTask(row.task).toLowerCase();
  return task === "pending" || task === "unpick";
}

function isMine(row) {
  const employeeName = state.employeeName.toLowerCase();
  return String(row.usermail || "").trim().toLowerCase() === employeeName
    || includesEmployee(row.takenby, state.employeeName);
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

function shouldShowComplaintRow(row) {
  const createdBy = cleanText(valueOf(row, "createdBy", "CreatedBy", "created_by")).toLowerCase();
  if (createdBy !== "system") {
    return true;
  }
  const reason = cleanText(row.reason).toLowerCase();
  return reason.includes("no connectivity") || reason.includes("speed issue");
}

function getClientRows() {
  if (state.client === "All") {
    return CLIENTS.flatMap((client) => state.allRows[client] || []);
  }
  return state.allRows[state.client] || [];
}

function formatUserId(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/_/g, "_<wbr>");
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

function setupDefaultPerformanceDates() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 6);
  const toValue = now.toISOString().slice(0, 10);
  const fromValue = from.toISOString().slice(0, 10);
  els.taskFrom.value = fromValue;
  els.taskTo.value = toValue;
  els.perfFrom.value = fromValue;
  els.perfTo.value = toValue;
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
  const end = new Date(endMs);
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

function makeBreachTimer(row) {
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
  updateBreachTimerNode(span);
  return span;
}

function updateBreachTimerNode(node) {
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

function updateBreachTimers() {
  document.querySelectorAll(".breach-timer").forEach(updateBreachTimerNode);
}

function slaStatus(row, endValue) {
  const info = breachInfo(row, endValue);
  if (!info.applies) {
    return "-";
  }
  const used = workingMinutesBetween(row.created_at, endValue);
  return `${info.breached ? "Breached" : "Within SLA"} (${formatMinutes(used)})`;
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
  els.clientSelect.innerHTML = ["All", ...CLIENTS].map((client) => `<option value="${client}">${client}</option>`).join("");
  const mappedClient = EMPLOYEE_WINDOW_MAP[state.employeeName] || DEFAULT_CLIENT;
  state.client = mappedClient === "All" || CLIENTS.includes(mappedClient) ? mappedClient : DEFAULT_CLIENT;
  els.clientSelect.value = state.client;
}

function requireEmployeeName() {
  setupEmployeeNameOptions();
  const saved = String(localStorage.getItem("taskEmployeeName") || "").trim();
  if (saved) {
    const matchedName = TEAM_MEMBERS.find((member) => member.toLowerCase() === saved.toLowerCase());
    if (!matchedName) {
      localStorage.removeItem("taskEmployeeName");
      toast("Contact manger to join team");
      els.nameModal.classList.add("open");
      return;
    }
    state.employeeName = matchedName;
    localStorage.setItem("taskEmployeeName", matchedName);
    setupClients();
    loadTasks();
    return;
  }
  els.nameModal.classList.add("open");
}

function saveEmployeeName() {
  const name = els.employeeNameInput.value.trim();
  if (!name) {
    toast("Employee name is required");
    return;
  }
  const matchedName = TEAM_MEMBERS.find((member) => member.toLowerCase() === name.toLowerCase());
  if (!matchedName) {
    toast("Contact manger to join team");
    return;
  }
  localStorage.setItem("taskEmployeeName", matchedName);
  state.employeeName = matchedName;
  els.nameModal.classList.remove("open");
  setupClients();
  loadTasks();
}

function setupEmployeeNameOptions() {
  els.employeeNameInput.innerHTML = [
    `<option value="">Select employee</option>`,
    ...TEAM_MEMBERS.map((name) => `<option value="${name}">${name}</option>`)
  ].join("");
  const saved = String(localStorage.getItem("taskEmployeeName") || "").trim();
  const matchedName = TEAM_MEMBERS.find((member) => member.toLowerCase() === saved.toLowerCase());
  els.employeeNameInput.value = matchedName || "";
}

function splitNames(value) {
  return String(value || "").split(",").map((name) => name.trim()).filter(Boolean);
}

function includesEmployee(value, employeeName) {
  const target = cleanText(employeeName).toLowerCase();
  return splitNames(value).some((name) => cleanText(name).toLowerCase() === target);
}

function makeTaskSelect(current, options) {
  const select = document.createElement("select");
  select.className = "task-select nice-select";
  select.innerHTML = options.map((task) => (
    `<option value="${task}" ${task.toLowerCase() === current.toLowerCase() ? "selected" : ""}>${task}</option>`
  )).join("");
  return select;
}

function makeActionSelect(current, actions) {
  const select = makeTaskSelect(current, [current, ...actions]);
  const currentOption = select.querySelector(`option[value='${current}']`);
  if (currentOption) {
    currentOption.hidden = true;
  }
  return select;
}

function makeTaskPill(task) {
  const span = document.createElement("span");
  const normalized = normalizeTask(task);
  span.className = `pill ${normalized.toLowerCase()}`;
  span.textContent = normalized;
  return span;
}

function makeRunningTaskSelect(isBreached) {
  const select = makeTaskSelect("Running", ["Running", "Unpick"]);
  const runningOption = select.querySelector("option[value='Running']");
  if (runningOption) {
    runningOption.hidden = true;
  }
  select.classList.add("running-select");
  if (isBreached) {
    select.classList.add("breached-running");
  }
  return select;
}

function makeTeamPicker(row) {
  const selected = Array.from(new Set([state.employeeName, ...splitNames(row.takenby)]))
    .filter(Boolean)
    .slice(0, 2);
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
      const locked = name.toLowerCase() === state.employeeName.toLowerCase() ? "disabled" : "";
      return `<label><input type="checkbox" value="${name}" ${checked} ${locked}> ${name}</label>`;
    }).join("");
  }

  box.addEventListener("click", () => wrapper.classList.toggle("open"));
  menu.addEventListener("change", (event) => {
    const input = event.target;
    if (!input.matches("input[type='checkbox']")) {
      return;
    }
    if (input.value.toLowerCase() === state.employeeName.toLowerCase()) {
      input.checked = true;
      return;
    }
    if (input.checked && selected.length >= 2) {
      input.checked = false;
      toast("Please contact your manager or select 2 persons!");
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

function renderTeamText(row) {
  const names = splitNames(row.takenby);
  return names.length ? names.join(", ") : "";
}

function makeRemarkControl(row, canEdit) {
  const wrapper = document.createElement("div");
  wrapper.className = "remark-box";
  const input = document.createElement("textarea");
  input.placeholder = "Remark";
  input.value = stripRemarkTimestamp(row.userremark);
  input.disabled = !canEdit;
  const meta = document.createElement("span");
  meta.className = "remark-meta";
  meta.textContent = row.userremark || "";
  const button = document.createElement("button");
  button.className = "button secondary";
  button.type = "button";
  button.textContent = "Save remarks";
  button.disabled = !canEdit;
  button.addEventListener("click", () => saveRemark(row, input));
  wrapper.appendChild(input);
  wrapper.appendChild(meta);
  wrapper.appendChild(button);
  return wrapper;
}

function setupReasonFilter() {
  const selected = els.reasonSelect.value || "All";
  const reasons = Array.from(new Set(getClientRows()
    .filter(shouldShowComplaintRow)
    .filter(complaintVisibleInView)
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

function rowSearchText(row) {
  return [
    row.client,
    valueOf(row, "user_id"),
    valueOf(row, "name"),
    valueOf(row, "Phone", "phone", "mobile"),
    valueOf(row, "address"),
    valueOf(row, "pon"),
    valueOf(row, "reason"),
    valueOf(row, "task"),
    valueOf(row, "takenby"),
    valueOf(row, "unpickremark"),
    valueOf(row, "userremark")
  ].join(" ").toLowerCase();
}

function isForceClosedRow(row) {
  return String(valueOf(row, "address") || "").trimEnd().endsWith(FORCE_CLOSE_MARKER);
}

function complaintVisibleInView(row) {
  return state.view === "forceclosed" ? isForceClosedRow(row) : !isForceClosedRow(row);
}

function filteredRows() {
  const reason = els.reasonSelect.value || "All";
  const search = cleanText(els.taskSearch.value).toLowerCase();
  const from = els.taskFrom.value;
  const to = els.taskTo.value;
  return state.rows
    .filter(shouldShowComplaintRow)
    .filter(complaintVisibleInView)
    .filter((row) => reason === "All" || cleanText(row.reason) === reason)
    .filter((row) => {
      const createdDate = dateOnlyValue(row.created_at);
      if (from && createdDate && createdDate < from) {
        return false;
      }
      if (to && createdDate && createdDate > to) {
        return false;
      }
      return !search || rowSearchText(row).includes(search);
    })
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

function openPickTeamModal(row) {
  state.pendingPick = {
    row,
    teamPicker: makeTeamPicker(row)
  };
  els.pickTeamHolder.innerHTML = "";
  els.pickTeamHolder.appendChild(state.pendingPick.teamPicker);
  els.pickTeamModal.classList.add("open");
}

function closePickTeamModal() {
  state.pendingPick = null;
  els.pickTeamHolder.innerHTML = "";
  els.pickTeamModal.classList.remove("open");
}

function render() {
  const rows = filteredRows();
  const forceClosedView = state.view === "forceclosed";
  els.panelTitle.textContent = `${forceClosedView ? "Force Closed Complaints" : "Complaints"} (${rows.length})`;
  els.statusText.textContent = "";
  els.taskBody.innerHTML = "";
  if (!rows.length) {
    els.taskBody.innerHTML = `<tr><td colspan="12" class="cell-muted">No tasks found</td></tr>`;
    setupTableScrollBars();
    return;
  }

  rows.forEach((row, index) => {
    const currentTask = normalizeTask(row.task);
    const canUnpickMine = isPick(row);
    const canEdit = !forceClosedView && (canUnpickMine || isPendingOrUnpick(row));
    const tr = document.createElement("tr");
    tr.classList.add(`task-row-${currentTask.toLowerCase()}`);

    let taskControl = makeTaskPill(currentTask);
    let teamControl = document.createElement("span");
    teamControl.textContent = renderTeamText(row);
    let saveButton = document.createElement("button");
    saveButton.className = "button secondary";
    saveButton.type = "button";
    saveButton.textContent = "Locked";
    saveButton.addEventListener("click", () => {
      toast("Task is not editable");
    });
    const remarkControl = makeRemarkControl(row, !forceClosedView && isPick(row) && isMine(row));
    const timerControl = makeBreachTimer(row);

    if (canEdit && canUnpickMine) {
      const unpickSelect = makeRunningTaskSelect(breachInfo(row).breached);
      saveButton = document.createElement("span");
      saveButton.className = "cell-muted";
      saveButton.textContent = "-";
      unpickSelect.addEventListener("change", () => {
        const isUnpick = unpickSelect.value === "Unpick";
        unpickSelect.classList.toggle("running-select", !isUnpick);
        unpickSelect.classList.toggle("breached-running", !isUnpick && breachInfo(row).breached);
        if (isUnpick) {
          saveRow(row, unpickSelect, null);
        }
      });
      taskControl = unpickSelect;
    } else if (canEdit) {
      taskControl = makeActionSelect(currentTask, ["Pick"]);
      teamControl = makeTeamPicker(row);
      taskControl.addEventListener("change", () => {
        if (taskControl.value === "Pick") {
          openPickTeamModal(row);
        }
      });
      saveButton = document.createElement("span");
      saveButton.className = "cell-muted";
      saveButton.type = "button";
      saveButton.textContent = "-";
    }

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
      <td class="power-cell">${valueOf(row, "Power", "power", "rxPower")}</td>
      <td></td>
      <td class="date-col">${formatCreatedAt(valueOf(row, "created_at"))}</td>
      <td></td>
      <td></td>
      <td></td>
      <td class="address action-cell"></td>
    `;
    tr.children[11].appendChild(makeInfoButton(row));
    tr.children[8].appendChild(taskControl);
    tr.children[9].appendChild(teamControl);
    tr.children[6].appendChild(timerControl);
    tr.children[10].appendChild(remarkControl);
    els.taskBody.appendChild(tr);
  });
  setupTableScrollBars();
}

async function saveRemark(row, input) {
  const remark = input.value.trim();
  const payload = {
    userremark: remark ? `${remark} (${nowLucknow()})` : ""
  };
  try {
    await updateComplaint(row, payload);
    toast("Remark saved");
    await loadTasks();
  } catch (error) {
    toast(`Remark update failed: ${error.message}`);
  }
}

function getCompletedRows() {
  const from = els.perfFrom.value;
  const to = els.perfTo.value;
  const search = cleanText(els.perfSearch.value).toLowerCase();
  const rows = [];
  for (const client of CLIENTS) {
    for (const row of state.allLogs[client] || []) {
      const action = cleanText(row.action).toLowerCase();
      const task = cleanText(row.task).toLowerCase();
      const closedDate = dateOnlyValue(row.log_timestamp);
      if (action !== "closed" || task !== "pick") {
        continue;
      }
      if (!shouldShowComplaintRow(row)) {
        continue;
      }
      if (!includesEmployee(row.takenby, state.employeeName)) {
        continue;
      }
      if (from && closedDate && closedDate < from) {
        continue;
      }
      if (to && closedDate && closedDate > to) {
        continue;
      }
      if (search && !rowSearchText({ ...row, client }).includes(search)) {
        continue;
      }
      rows.push({ ...row, client });
    }
  }
  return rows.sort((a, b) => dateSortValue(b.log_timestamp) - dateSortValue(a.log_timestamp));
}

function renderPerformance() {
  const rows = getCompletedRows();
  const totalMinutes = rows.reduce((sum, row) => sum + workingMinutesBetween(row.created_at, row.log_timestamp), 0);
  const avgMinutes = rows.length ? Math.round(totalMinutes / rows.length) : 0;
  const breachedCount = rows.filter((row) => breachInfo(row, row.log_timestamp).breached).length;
  els.performanceTitle.textContent = `Completed Tasks (${rows.length})`;
  els.performanceSummary.innerHTML = `
    <span>Total: <strong>${rows.length}</strong></span>
    <span>Avg: <strong>${formatMinutes(avgMinutes)}</strong></span>
    <span>Total Time: <strong>${formatMinutes(totalMinutes)}</strong></span>
    <span>Breached: <strong>${breachedCount}</strong></span>
  `;
  if (!rows.length) {
    els.performanceBody.innerHTML = `<tr><td colspan="10" class="cell-muted">No completed tasks found</td></tr>`;
    setupTableScrollBars();
    return;
  }
  els.performanceBody.innerHTML = rows.map((row, index) => {
    const takenMinutes = workingMinutesBetween(row.created_at, row.log_timestamp);
    const breached = breachInfo(row, row.log_timestamp).breached;
    return `
      <tr>
        <td class="small">${index + 1}</td>
        <td>${row.client}</td>
        <td><span class="user-id-cell">${formatUserId(valueOf(row, "user_id"))}</span></td>
        <td>${valueOf(row, "name")}</td>
        <td class="reason">${valueOf(row, "reason")}</td>
        <td>${slaStatus(row, row.log_timestamp)}</td>
        <td>${formatCreatedAt(valueOf(row, "actiontime"))}</td>
        <td>${valueOf(row, "takenby")}</td>
        <td>${formatCreatedAt(valueOf(row, "log_timestamp"))}</td>
        <td>${formatMinutes(takenMinutes)}</td>
      </tr>
    `;
  }).join("");
  setupTableScrollBars();
}

async function loadTasks() {
  els.panelTitle.textContent = state.view === "forceclosed" ? "Force Closed Complaints" : "Complaints";
  els.statusText.textContent = "Loading...";
  try {
    const results = await Promise.all(CLIENTS.map(async (client) => {
      const response = await fetch(`${API_BASE}/${client}/tasks`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${client} HTTP ${response.status}`);
      }
      const data = await response.json();
      return [client, (data.tables?.complaints?.rows || []).map((row) => ({ ...row, client }))];
    }));
    state.allRows = Object.fromEntries(results.map(([client, rows]) => [client, rows]));
    state.rows = getClientRows().slice().sort(compareRows);
    setupReasonFilter();
    render();
  } catch (error) {
    els.statusText.textContent = "Load failed";
    toast(`Load failed: ${error.message}`);
  }
}

async function loadPerformance() {
  els.performanceTitle.textContent = "Completed Tasks";
  els.performanceSummary.innerHTML = "";
  els.performanceBody.innerHTML = `<tr><td colspan="10" class="cell-muted">Loading...</td></tr>`;
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
    renderPerformance();
  } catch (error) {
    els.performanceBody.innerHTML = `<tr><td colspan="10" class="cell-muted">Performance load failed</td></tr>`;
    toast(`Performance load failed: ${error.message}`);
  }
}

function switchView(view) {
  state.view = view;
  const showPerformance = view === "performance";
  els.tasksPanel.classList.toggle("hidden", showPerformance);
  els.performancePanel.classList.toggle("hidden", !showPerformance);
  els.viewTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  if (showPerformance && !state.performanceLoaded) {
    loadPerformance();
  }
  if (!showPerformance) {
    setupReasonFilter();
    render();
  }
  window.setTimeout(setupTableScrollBars, 0);
}

async function updateComplaint(row, payload) {
  const client = row.client || state.client;
  const response = await fetch(`${API_BASE}/${client}/tasks/complaints/${row.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return data;
}

function saveRow(row, taskControl, teamControl) {
  const task = taskControl.value;
  if (task === "Running") {
    toast("Select Unpick first");
    return;
  }
  if (task === "Unpick") {
    state.pendingUnpick = { row };
    els.unpickRemark.value = "";
    els.unpickModal.classList.add("open");
    els.unpickRemark.focus();
    return;
  }

  const team = teamControl.getValues();
  if (team.length < 1) {
    toast("Select minimum 1 team member");
    return;
  }
  if (team.length > 2) {
    toast("Please contact your manager or select 2 persons!");
    return;
  }
  submitRow(row, task, team, "");
}

async function submitRow(row, task, team, remark) {
  const payload = {
    task,
    actiontime: nowLucknow(),
    unpickremark: remark,
    usermail: state.employeeName,
    takenby: team.join(",")
  };
  try {
    await updateComplaint(row, payload);
    toast("Task allocated !!");
    await loadTasks();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

els.saveNameButton.addEventListener("click", saveEmployeeName);
els.employeeNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveEmployeeName();
  }
});

els.clientSelect.addEventListener("change", () => {
  state.client = els.clientSelect.value;
  state.rows = getClientRows().slice().sort(compareRows);
  setupReasonFilter();
  render();
});

els.reasonSelect.addEventListener("change", () => {
  render();
});

els.taskSearch.addEventListener("input", render);
els.taskFrom.addEventListener("change", render);
els.taskTo.addEventListener("change", render);
els.perfFrom.addEventListener("change", renderPerformance);
els.perfTo.addEventListener("change", renderPerformance);
els.perfSearch.addEventListener("input", renderPerformance);
els.viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

els.closeAddress.addEventListener("click", () => {
  els.addressModal.classList.remove("open");
});

els.addressModal.addEventListener("click", (event) => {
  if (event.target === els.addressModal) {
    els.addressModal.classList.remove("open");
  }
});

els.screenshotButton.addEventListener("click", downloadTablePng);
els.refreshButton.addEventListener("click", () => {
  loadTasks();
});

els.cancelUnpick.addEventListener("click", () => {
  state.pendingUnpick = null;
  els.unpickModal.classList.remove("open");
  render();
});

els.confirmUnpick.addEventListener("click", () => {
  const remark = els.unpickRemark.value.trim();
  if (!remark) {
    toast("Unpick reason is required");
    return;
  }
  const pending = state.pendingUnpick;
  state.pendingUnpick = null;
  els.unpickModal.classList.remove("open");
  submitRow(pending.row, "Unpick", splitNames(pending.row.takenby), remark);
});

els.cancelPickTeam.addEventListener("click", () => {
  closePickTeamModal();
  render();
});

els.confirmPickTeam.addEventListener("click", () => {
  const pending = state.pendingPick;
  if (!pending) {
    return;
  }
  const team = pending.teamPicker.getValues();
  if (team.length < 1) {
    toast("Select minimum 1 team member");
    return;
  }
  if (team.length > 2) {
    toast("Please contact your manager or select 2 persons!");
    return;
  }
  const row = pending.row;
  closePickTeamModal();
  submitRow(row, "Pick", team, "");
});

els.pickTeamModal.addEventListener("click", (event) => {
  if (event.target === els.pickTeamModal) {
    closePickTeamModal();
    render();
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
setupTableScrollBars();
setupMobileDrawer();
window.setInterval(updateBreachTimers, 60000);
loadTeamConfig().finally(requireEmployeeName);

