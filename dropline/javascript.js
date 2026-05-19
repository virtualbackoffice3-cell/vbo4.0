const API_BASE_URL = "https://app2.vbo.co.in";

const tableConfig = {
  drop_users: {
    emptyText: "No drop users found.",
    columns: [
      ["serial_no", "#"],
      ["source_window", "Window"],
      ["user_id", "User ID"],
      ["name", "Name"],
      ["phone_pon", "Phone / PON"],
      ["event_type", "Event / Type"],
      ["down_time", "Last down time"],
      ["address", "Address"],
      ["complaint_action", "Complaint"]
    ]
  }
};

const state = {
  activeTable: "drop_users",
  data: {
    complaint_users: [],
    drop_users: []
  },
  openComplaintUsers: new Set(),
  openComplaintMap: new Map(),
  downTimeSortDirection: ""
};

const windowInput = document.getElementById("windowInput");
const dropCount = document.getElementById("dropCount");
const lastUpdated = document.getElementById("lastUpdated");
const searchInput = document.getElementById("searchInput");
const ponFilter = document.getElementById("ponFilter");
const eventFilter = document.getElementById("eventFilter");
const message = document.getElementById("message");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const screenshotButton = document.getElementById("screenshotButton");
const csvButton = document.getElementById("csvButton");
const complaintModal = document.getElementById("complaintModal");
const complaintClose = document.getElementById("complaintClose");
const complaintSummary = document.getElementById("complaintSummary");
const complaintReason = document.getElementById("complaintReason");
const complaintCallingPhone = document.getElementById("complaintCallingPhone");
const complaintDetail = document.getElementById("complaintDetail");
const complaintTeam = document.getElementById("complaintTeam");
const complaintMode = document.getElementById("complaintMode");
const complaintSubmit = document.getElementById("complaintSubmit");
const confirmModal = document.getElementById("confirmModal");
const confirmCancel = document.getElementById("confirmCancel");
const confirmOk = document.getElementById("confirmOk");
const WINDOW_STORAGE_KEY = "lidownusers.windowSelection";
const EVENT_STORAGE_KEY = "lidownusers.eventSelection";
const REMARK_OPTIONS = [
  "Red light",
  "Bad power no net",
  "Frequent speed problem",
  "Device change",
  "Shifting request",
  "Device recovery",
  "Other problem"
];
const TEAM_OPTIONS = ["TeamAmanwiz", "TeamMedanta", "TeamSevai"];
let activeComplaintRow = null;

function getInitialWindow() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("window") || "AMANWIZ").trim().toUpperCase();
}

function getStorageKey(filterElement) {
  if (filterElement === windowInput) {
    return WINDOW_STORAGE_KEY;
  }
  if (filterElement === eventFilter) {
    return EVENT_STORAGE_KEY;
  }
  return "";
}

function getStoredFilterValues(filterElement) {
  const storageKey = getStorageKey(filterElement);
  if (!storageKey) {
    return [];
  }
  try {
    const values = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(values) ? values.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function setStoredFilterValues(filterElement, values) {
  const storageKey = getStorageKey(filterElement);
  if (!storageKey) {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(values));
}

function getSelectedValues(filterElement) {
  return [...filterElement.querySelectorAll('.filter-options input[type="checkbox"]:checked')]
    .map((input) => input.value)
    .filter(Boolean);
}

function getAppliedValues(filterElement) {
  if (!filterElement.dataset.appliedValues) {
    return getSelectedValues(filterElement);
  }
  try {
    const values = JSON.parse(filterElement.dataset.appliedValues);
    const allValues = new Set(getAllFilterValues(filterElement));
    if (!Array.isArray(values)) {
      return [];
    }
    return allValues.size ? values.filter((value) => allValues.has(value)) : values.filter(Boolean);
  } catch (error) {
    return getSelectedValues(filterElement);
  }
}

function commitFilterSelection(filterElement) {
  const selectedValues = getSelectedValues(filterElement);
  filterElement.dataset.appliedValues = JSON.stringify(selectedValues);
  setStoredFilterValues(filterElement, selectedValues);
  updateFilterLabel(filterElement);
}

function restoreFilterSelection(filterElement) {
  setSelectedValues(filterElement, getAppliedValues(filterElement));
}

function setSelectedValues(filterElement, values) {
  const selectedSet = new Set(values);
  [...filterElement.querySelectorAll('.filter-options input[type="checkbox"]')].forEach((input) => {
    input.checked = selectedSet.has(input.value);
  });
  updateFilterLabel(filterElement);
}

function getAllFilterValues(filterElement) {
  return [...filterElement.querySelectorAll('.filter-options input[type="checkbox"]')]
    .map((input) => input.value)
    .filter(Boolean);
}

function updateFilterLabel(filterElement) {
  const label = filterElement.querySelector(".filter-value");
  const selectedValues = getSelectedValues(filterElement);
  const allValues = getAllFilterValues(filterElement);

  if (!label) {
    return;
  }
  if (!selectedValues.length) {
    label.textContent = filterElement.dataset.emptyLabel || "All";
    return;
  }
  if (allValues.length && selectedValues.length === allValues.length) {
    label.textContent = filterElement.dataset.allLabel || "All";
    return;
  }
  if (selectedValues.length <= 2) {
    label.textContent = selectedValues.join(", ");
    return;
  }
  label.textContent = `${selectedValues.length} selected`;
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function cleanValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function formatDisplayDate(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue || rawValue === "-") {
    return "-";
  }

  const date = new Date(rawValue.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `${day} ${month} ${time}`;
}

function escapeHtml(value) {
  return cleanValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPhone(row) {
  return row.Phone || row.primary_phone || "-";
}

function getRegisteredPhone(row) {
  const phone = getPhone(row);
  return phone === "-" ? "" : phone;
}

function getComplaintReason(row) {
  const eventText = cleanValue(row.downEvent || row.downEventType).toLowerCase();
  if (eventText.includes("red")) {
    return "Red light";
  }
  return "Bad power no net";
}

function getDefaultTeam(windowName) {
  if (windowName === "AMANWIZ") return "TeamAmanwiz";
  if (windowName === "MEDANTA") return "TeamMedanta";
  if (windowName === "SEVAI") return "TeamSevai";
  return TEAM_OPTIONS[0];
}

function syncComplaintDetail() {
  const isOther = complaintReason.value === "Other";
  complaintDetail.disabled = !isOther;
  if (!isOther) {
    complaintDetail.value = "";
  }
}

function setupComplaintControls() {
  complaintReason.innerHTML = REMARK_OPTIONS.map((reason) => {
    const value = reason === "Other problem" ? "Other" : reason;
    return `<option value="${escapeHtml(value)}">${escapeHtml(reason)}</option>`;
  }).join("");
  complaintTeam.innerHTML = TEAM_OPTIONS.map((team) => `<option>${escapeHtml(team)}</option>`).join("");
  complaintReason.addEventListener("change", syncComplaintDetail);
}

function openComplaintModal(row) {
  activeComplaintRow = row;
  const windowName = cleanValue(row.source_window || getInitialWindow()).toUpperCase();
  const complaintKey = `${windowName}|${cleanValue(row.user_id).toLowerCase()}`;
  const openComplaint = state.openComplaintMap.get(complaintKey);
  const openReason = cleanValue(openComplaint?.additional_detail) && cleanValue(openComplaint?.reason).toLowerCase() === "other"
    ? openComplaint.additional_detail
    : openComplaint?.reason;

  complaintSummary.innerHTML = `
    <div><b>${escapeHtml(row.name)}</b></div>
    <div>User ID: ${escapeHtml(row.user_id)}</div>
    <div>Registered no: ${escapeHtml(getPhone(row))}</div>
    <div>PON: ${escapeHtml(row.pon)}</div>
    <div>${escapeHtml(row.address)}</div>
    ${openComplaint ? `
      <div class="open-complaint-detail">
        <b>Complaint already open</b>
        <span>Remark: ${escapeHtml(openReason || "")}</span>
        <span>Team: ${escapeHtml(openComplaint.Team || "")}</span>
        <span>Mode: ${escapeHtml(openComplaint.Mode || "")}</span>
        <span>Created: ${escapeHtml(openComplaint.created_at || "")}</span>
      </div>
    ` : ""}
  `;
  complaintCallingPhone.value = row.calling_phone || "";
  complaintReason.value = getComplaintReason(row);
  complaintTeam.value = getDefaultTeam(windowName);
  complaintMode.value = "Auto";
  syncComplaintDetail();
  complaintSubmit.disabled = Boolean(openComplaint);
  complaintSubmit.textContent = openComplaint ? "Already Open" : "Mark Complaint";
  complaintModal.classList.add("open");
}

function closeComplaintModal() {
  activeComplaintRow = null;
  complaintSubmit.disabled = false;
  complaintSubmit.textContent = "Mark Complaint";
  complaintModal.classList.remove("open");
}

async function hasOpenComplaint(row) {
  const windowName = cleanValue(row.source_window).toUpperCase();
  const userId = cleanValue(row.user_id);
  if (!windowName || !userId) {
    return false;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(windowName)}/heroesocr_user_complaints/${encodeURIComponent(userId)}`);
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return (data.current_complaints || []).some((item) => String(item.status || "").toLowerCase() === "open");
  } catch (error) {
    return false;
  }
}

function confirmMarkComplaint() {
  return new Promise((resolve) => {
    const cleanup = (value) => {
      confirmModal.classList.remove("open");
      confirmOk.onclick = null;
      confirmCancel.onclick = null;
      confirmModal.onclick = null;
      resolve(value);
    };

    confirmOk.onclick = () => cleanup(true);
    confirmCancel.onclick = () => cleanup(false);
    confirmModal.onclick = (event) => {
      if (event.target === confirmModal) {
        cleanup(false);
      }
    };
    confirmModal.classList.add("open");
  });
}

async function submitComplaint() {
  if (!activeComplaintRow || complaintSubmit.disabled) {
    return;
  }

  const row = activeComplaintRow;
  const windowName = cleanValue(row.source_window).toUpperCase();
  if (!windowName || !row.user_id) {
    setMessage("Window or user id missing.", "error");
    return;
  }

  complaintSubmit.disabled = true;
  complaintSubmit.textContent = "Marking...";
  try {
    const confirmed = await confirmMarkComplaint();
    if (!confirmed) {
      return;
    }

    if (await hasOpenComplaint(row)) {
      const proceed = window.confirm("Complaint already open for this user. Continue?");
      if (!proceed) {
        return;
      }
    }

    const payload = {
      user_id: row.user_id || "",
      name: row.name || "",
      address: row.address || "",
      reason: complaintReason.value || "",
      additional_detail: complaintReason.value === "Other" ? complaintDetail.value.trim() : "",
      Mode: complaintMode.value,
      Phone: complaintCallingPhone.value.trim() || getRegisteredPhone(row),
      registered_phone: getRegisteredPhone(row),
      calling_phone: complaintCallingPhone.value.trim(),
      Team: complaintTeam.value,
      pon: row.pon || "",
      statusUpDown: "DOWN",
      CreatedBy: "User"
    };

    const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(windowName)}/mark_complain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || result.status === "error") {
      throw new Error(result.message || "Complaint mark failed");
    }

    closeComplaintModal();
    setMessage("Complaint marked !!", "success");
  } catch (error) {
    setMessage(error.message || "Complaint mark failed.", "error");
  } finally {
    complaintSubmit.disabled = false;
    complaintSubmit.textContent = "Mark Complaint";
  }
}

function renderCell(row, key) {
  if (key === "serial_no") {
    return escapeHtml(row.serial_no);
  }
  if (key === "phone_pon") {
    return `
      <div class="stack-cell">
        <span>PON ${escapeHtml(row.pon)}</span>
        <strong>${escapeHtml(getPhone(row))}</strong>
      </div>
    `;
  }
  if (key === "event_type") {
    return `
      <div class="stack-cell">
        <strong>${escapeHtml(row.downEvent)}</strong>
        <span>${escapeHtml(row.downEventType)}</span>
      </div>
    `;
  }
  if (key === "source_window") {
    return `<span class="data-pill">${escapeHtml(row[key])}</span>`;
  }
  if (key === "down_time") {
    return escapeHtml(formatDisplayDate(row[key]));
  }
  if (key === "complaint_action") {
    const complaintKey = `${cleanValue(row.source_window).toUpperCase()}|${cleanValue(row.user_id).toLowerCase()}`;
    const openClass = state.openComplaintUsers.has(complaintKey) ? " has-open-complaint" : "";
    return `<button class="complaint-button${openClass}" type="button" data-complaint-index="${row._display_index}" title="Create complaint" aria-label="Create complaint">!</button>`;
  }
  return escapeHtml(row[key]);
}

function rowMatchesSearch(row, searchText) {
  if (!searchText) {
    return true;
  }
  return Object.values(row).some((value) =>
    String(value || "").toLowerCase().includes(searchText)
  );
}

function rowMatchesPon(row, selectedPonList) {
  if (!selectedPonList.length) {
    return true;
  }
  return selectedPonList.includes(String(row.pon || "").trim().toUpperCase());
}

function rowMatchesEvent(row, selectedEventList) {
  if (!selectedEventList.length) {
    return true;
  }
  return selectedEventList.includes(String(row.downEvent || "").trim());
}

function getSortedRows(rows) {
  if (!state.downTimeSortDirection) {
    return rows;
  }
  return [...rows].sort((left, right) => {
    const leftValue = String(left.down_time || "");
    const rightValue = String(right.down_time || "");
    if (!leftValue && !rightValue) {
      return 0;
    }
    if (!leftValue) {
      return 1;
    }
    if (!rightValue) {
      return -1;
    }
    const result = leftValue.localeCompare(rightValue);
    return state.downTimeSortDirection === "asc" ? result : -result;
  });
}

function getDisplayRows() {
  return getSortedRows(getFilteredRows()).map((row, index) => ({
    ...row,
    _display_index: index,
    serial_no: index + 1
  }));
}

function getColumnText(row, key) {
  if (key === "serial_no") {
    return String(row.serial_no);
  }
  if (key === "phone_pon") {
    return `PON ${cleanValue(row.pon)}\n${cleanValue(getPhone(row))}`;
  }
  if (key === "event_type") {
    return `${cleanValue(row.downEvent)}\n${cleanValue(row.downEventType)}`;
  }
  if (key === "source_window") {
    return cleanValue(row[key]);
  }
  if (key === "down_time") {
    return formatDisplayDate(row[key]);
  }
  if (key === "complaint_action") {
    return "";
  }
  return cleanValue(row[key]);
}

function downloadBlob(filename, blob) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getExportFilename(extension) {
  const activeWindows = getAppliedValues(windowInput);
  const windowName = activeWindows.length ? activeWindows.join("-").toLowerCase() : "lidownusers";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${windowName}-${state.activeTable}-${stamp}.${extension}`;
}

function downloadCsv() {
  const config = tableConfig[state.activeTable];
  const rows = getDisplayRows();
  const csvRows = [
    config.columns.map(([, label]) => `"${String(label).replaceAll('"', '""')}"`).join(",")
  ];

  rows.forEach((row) => {
    const line = config.columns
      .map(([key]) => `"${getColumnText(row, key).replaceAll('"', '""')}"`)
      .join(",");
    csvRows.push(line);
  });

  downloadBlob(
    getExportFilename("csv"),
    new Blob([csvRows.join("\r\n")], { type: "text/csv;charset=utf-8" })
  );
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  String(text || "")
    .split("\n")
    .forEach((block) => {
      const words = block.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        return;
      }
      let currentLine = words[0];
      for (let index = 1; index < words.length; index += 1) {
        const nextLine = `${currentLine} ${words[index]}`;
        if (context.measureText(nextLine).width <= maxWidth) {
          currentLine = nextLine;
        } else {
          lines.push(currentLine);
          currentLine = words[index];
        }
      }
      lines.push(currentLine);
    });
  return lines.length ? lines : [""];
}

function exportTableScreenshot() {
  const config = tableConfig[state.activeTable];
  const rows = getDisplayRows();
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const padding = 12;
  const lineHeight = 18;
  const headerHeight = 42;
  const cellPaddingY = 10;
  const cellPaddingX = 10;
  const columnWidths = {
    serial_no: 42,
    source_window: 98,
    user_id: 145,
    name: 180,
    phone_pon: 165,
    event_type: 170,
    down_time: 160,
    address: 300
  };

  const canvasMeasure = document.createElement("canvas");
  const measureContext = canvasMeasure.getContext("2d");
  measureContext.font = "14px Arial";

  const resolvedWidths = config.columns.map(([key]) => columnWidths[key] || 150);
  const contentWidth = resolvedWidths.reduce((sum, width) => sum + width, 0);
  const rowHeights = rows.map((row) => {
    let maxLines = 1;
    config.columns.forEach(([key], columnIndex) => {
      const textLines = wrapCanvasText(
        measureContext,
        getColumnText(row, key),
        resolvedWidths[columnIndex] - cellPaddingX * 2
      );
      maxLines = Math.max(maxLines, textLines.length);
    });
    return Math.max(34, cellPaddingY * 2 + maxLines * lineHeight);
  });

  const titleHeight = 56;
  const footerHeight = 0;
  const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const totalWidth = contentWidth + padding * 2;
  const totalHeight = titleHeight + headerHeight + contentHeight + footerHeight + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth * scale;
  canvas.height = totalHeight * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, totalWidth, totalHeight);

  context.fillStyle = "#17202a";
  context.font = "700 22px Arial";
  context.fillText("User line down reasons", padding, padding + 24);
  context.font = "12px Arial";
  context.fillStyle = "#647181";
  context.fillText(`${rows.length} users`, padding, padding + 42);

  let currentX = padding;
  let currentY = padding + titleHeight;

  context.fillStyle = "#e8eef5";
  context.fillRect(padding, currentY, contentWidth, headerHeight);
  context.strokeStyle = "#d8e0ea";
  context.lineWidth = 1;
  context.strokeRect(padding, currentY, contentWidth, headerHeight);

  context.font = "700 12px Arial";
  context.fillStyle = "#354052";
  config.columns.forEach(([, label], columnIndex) => {
    context.fillText(String(label).toUpperCase(), currentX + cellPaddingX, currentY + 25);
    context.beginPath();
    context.moveTo(currentX + resolvedWidths[columnIndex], currentY);
    context.lineTo(currentX + resolvedWidths[columnIndex], currentY + headerHeight);
    context.stroke();
    currentX += resolvedWidths[columnIndex];
  });

  currentY += headerHeight;
  context.font = "14px Arial";

  rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    currentX = padding;
    context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f9fbfd";
    context.fillRect(padding, currentY, contentWidth, rowHeight);
    context.strokeStyle = "#d8e0ea";
    context.strokeRect(padding, currentY, contentWidth, rowHeight);

    config.columns.forEach(([key], columnIndex) => {
      const textLines = wrapCanvasText(
        context,
        getColumnText(row, key),
        resolvedWidths[columnIndex] - cellPaddingX * 2
      );
      context.fillStyle = "#17202a";
      textLines.forEach((line, lineIndex) => {
        context.fillText(
          line,
          currentX + cellPaddingX,
          currentY + cellPaddingY + 14 + lineIndex * lineHeight
        );
      });
      context.beginPath();
      context.moveTo(currentX + resolvedWidths[columnIndex], currentY);
      context.lineTo(currentX + resolvedWidths[columnIndex], currentY + rowHeight);
      context.stroke();
      currentX += resolvedWidths[columnIndex];
    });

    currentY += rowHeight;
  });

  canvas.toBlob((blob) => {
    if (!blob) {
      setMessage("Unable to create screenshot.", "error");
      return;
    }
    downloadBlob(getExportFilename("png"), blob);
  }, "image/png");
}

function getFilteredRows(excludeFilter = "") {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedPonList = excludeFilter === "pon" ? [] : getAppliedValues(ponFilter);
  const selectedEventList = excludeFilter === "event" ? [] : getAppliedValues(eventFilter);

  return state.data[state.activeTable].filter((row) =>
    rowMatchesSearch(row, searchText) &&
    rowMatchesPon(row, selectedPonList) &&
    rowMatchesEvent(row, selectedEventList)
  );
}

function buildCountMap(rows, keyGetter) {
  return rows.reduce((counts, row) => {
    const key = keyGetter(row);
    if (key) {
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, {});
}

function updateFilterCounts(filterElement, counts) {
  filterElement.querySelectorAll(".filter-options label").forEach((label) => {
    const input = label.querySelector('input[type="checkbox"]');
    const text = label.querySelector(".option-text");
    if (!input || !text) {
      return;
    }
    const count = counts[input.value] || 0;
    label.dataset.count = String(count);
    text.textContent = `${input.value} (${count})`;
    label.style.display = count === 0 ? "none" : "";
  });
}

function updateVisibleFilterCounts(rows) {
  updateFilterCounts(
    ponFilter,
    buildCountMap(rows, (row) => String(row.pon || "").trim().toUpperCase())
  );
  updateFilterCounts(
    eventFilter,
    buildCountMap(rows, (row) => String(row.downEvent || "").trim())
  );
}

function updateMultiFilter(filterElement, values) {
  const currentValues = getAppliedValues(filterElement);
  const options = filterElement.querySelector(".filter-options");
  options.innerHTML = values
    .map((value) => `
      <label>
        <input type="checkbox" value="${escapeHtml(value)}">
        <span class="option-text">${escapeHtml(value)} (0)</span>
      </label>
    `)
    .join("");
  setSelectedValues(
    filterElement,
    currentValues.filter((value) => values.includes(value))
  );
  commitFilterSelection(filterElement);
}

function selectAll(filterElement) {
  filterElement.querySelectorAll(".filter-options label").forEach((label) => {
    const input = label.querySelector('input[type="checkbox"]');
    if (input) {
      input.checked = label.style.display !== "none";
    }
  });
  updateFilterLabel(filterElement);
}

function clearAll(filterElement) {
  filterElement.querySelectorAll('.filter-options input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  updateFilterLabel(filterElement);
}

function closeFilterMenus(exceptElement = null) {
  document.querySelectorAll(".filter-menu.open").forEach((filterElement) => {
    if (filterElement !== exceptElement) {
      restoreFilterSelection(filterElement);
      filterElement.classList.remove("open");
    }
  });
}

function filterOptions(filterElement, searchText) {
  const query = searchText.trim().toLowerCase();
  filterElement.querySelectorAll(".filter-options label").forEach((label) => {
    const count = Number(label.dataset.count || "1");
    const shouldHide = count === 0 || (query && !label.textContent.toLowerCase().includes(query));
    label.style.display = shouldHide ? "none" : "";
  });
}

function setupFilterMenu(filterElement, onChange = null) {
  filterElement.addEventListener("click", (event) => {
    const trigger = event.target.closest(".filter-trigger");
    const action = event.target.dataset.action;

    if (trigger) {
      const isOpen = filterElement.classList.contains("open");
      closeFilterMenus(filterElement);
      filterElement.classList.toggle("open", !isOpen);
      if (!isOpen) {
        restoreFilterSelection(filterElement);
      }
      const search = filterElement.querySelector(".filter-search");
      if (!isOpen && search) {
        search.focus();
      }
      return;
    }

    if (action === "all") {
      selectAll(filterElement);
      return;
    }

    if (action === "clear") {
      clearAll(filterElement);
      commitFilterSelection(filterElement);
      filterElement.classList.remove("open");
      if (onChange) {
        onChange();
      }
      return;
    }

    if (action === "apply") {
      commitFilterSelection(filterElement);
      filterElement.classList.remove("open");
      if (onChange) {
        onChange();
      }
    }
  });

  filterElement.addEventListener("change", () => {
    updateFilterLabel(filterElement);
  });

  filterElement.addEventListener("input", (event) => {
    if (event.target.classList.contains("filter-search")) {
      filterOptions(filterElement, event.target.value);
    }
  });
}

function updatePonFilter() {
  const ponSet = new Set();
  state.data.drop_users.forEach((row) => {
    const pon = String(row.pon || "").trim().toUpperCase();
    if (pon) {
      ponSet.add(pon);
    }
  });
  updateMultiFilter(ponFilter, [...ponSet].sort());
}

function updateEventFilter() {
  const eventSet = new Set();
  state.data.drop_users.forEach((row) => {
    const eventName = String(row.downEvent || "").trim();
    if (eventName) {
      eventSet.add(eventName);
    }
  });
  updateMultiFilter(eventFilter, [...eventSet].sort());
}

function renderTable() {
  const config = tableConfig[state.activeTable];
  const rows = getDisplayRows();

  tableHead.innerHTML = `
    <tr>
      ${config.columns.map((column) => `<th class="cell-${column[0]}"${column[0] === "down_time" ? ' data-sort-key="down_time"' : ""}>${column[1]}${column[0] === "down_time" && state.downTimeSortDirection ? ` ${state.downTimeSortDirection === "asc" ? "▲" : "▼"}` : ""}</th>`).join("")}
    </tr>
  `;

  const downTimeHeader = tableHead.querySelector('th[data-sort-key="down_time"]');
  if (downTimeHeader) {
    downTimeHeader.innerHTML = `<button type="button" class="sort-button" data-sort-key="down_time">Last down time${state.downTimeSortDirection ? ` <span class="sort-arrow">${state.downTimeSortDirection === "asc" ? "&#9652;" : "&#9662;"}</span>` : ""}</button>`;
  }

  tableBody.innerHTML = rows
    .map((row) => `
      <tr>
        ${config.columns
          .map(([key, label]) => `<td data-label="${label}" class="cell-${key}">${renderCell(row, key)}</td>`)
          .join("")}
      </tr>
    `)
    .join("");

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="${config.columns.length}">
          ${searchInput.value.trim() ? "No matching users found." : config.emptyText}
        </td>
      </tr>
    `;
  }

  updateVisibleFilterCounts(rows);
  setMessage(`${rows.length} filtered users showing.`, rows.length ? "success" : "");
}

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-complaint-index]");
  if (!button) {
    return;
  }
  const rows = getDisplayRows();
  const row = rows[Number(button.dataset.complaintIndex)];
  if (row) {
    openComplaintModal(row);
  }
});

complaintClose.addEventListener("click", closeComplaintModal);
complaintSubmit.addEventListener("click", submitComplaint);
complaintModal.addEventListener("click", (event) => {
  if (event.target === complaintModal) {
    closeComplaintModal();
  }
});

function latestTimestamp(payloads) {
  const timestamps = payloads
    .map((payload) => payload.last_updated)
    .filter(Boolean)
    .sort();
  return timestamps[timestamps.length - 1] || "-";
}

function updateCounts(payloads, activeWindows) {
  dropCount.textContent = state.data.drop_users.length;
  lastUpdated.textContent = formatDisplayDate(latestTimestamp(payloads));
}

async function fetchWindowData(activeWindow) {
  const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(activeWindow)}/lidownusers`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || `Unable to load ${activeWindow}.`);
  }

  return payload;
}

async function loadOpenComplaintUsers(activeWindows) {
  const entries = await Promise.all(activeWindows.map(async (activeWindow) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(activeWindow)}/heroesocr_latest?limit=5000`, { cache: "no-store" });
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      return (payload.rows || [])
        .filter((row) => String(row.status || "Open").toLowerCase() === "open")
        .map((row) => ({
          key: `${activeWindow}|${cleanValue(row.user_id).toLowerCase()}`,
          row
        }));
    } catch (error) {
      return [];
    }
  }));
  const flatEntries = entries.flat();
  state.openComplaintUsers = new Set(flatEntries.map((entry) => entry.key));
  state.openComplaintMap = new Map(flatEntries.map((entry) => [entry.key, entry.row]));
}

async function loadUsers() {
  const activeWindows = getAppliedValues(windowInput);
  if (!activeWindows.length) {
    state.data.complaint_users = [];
    state.data.drop_users = [];
    updateCounts([], []);
    updatePonFilter();
    updateEventFilter();
    renderTable();
    setMessage("Please select at least one window.", "error");
    return;
  }

  setMessage(`Loading ${activeWindows.join(", ")} users...`);

  try {
    const [payloads] = await Promise.all([
      Promise.all(activeWindows.map(fetchWindowData)),
      loadOpenComplaintUsers(activeWindows)
    ]);
    state.data.complaint_users = [];
    state.data.drop_users = payloads.flatMap((payload) =>
      (Array.isArray(payload.drop_users) ? payload.drop_users : []).map((row) => ({
        ...row,
        source_window: payload.window_name || payload.client || ""
      }))
    );

    updateCounts(payloads, activeWindows);
    updatePonFilter();
    updateEventFilter();
    renderTable();
  } catch (error) {
    state.data.complaint_users = [];
    state.data.drop_users = [];
    updateCounts([], activeWindows);
    updatePonFilter();
    updateEventFilter();
    renderTable();
    setMessage(error.message, "error");
  }
}

searchInput.addEventListener("input", renderTable);
setupFilterMenu(windowInput, loadUsers);
setupFilterMenu(ponFilter, renderTable);
setupFilterMenu(eventFilter, renderTable);
screenshotButton.addEventListener("click", exportTableScreenshot);
csvButton.addEventListener("click", downloadCsv);
tableHead.addEventListener("click", (event) => {
  const th = event.target.closest('th[data-sort-key="down_time"]');
  if (!th) {
    return;
  }
  if (!state.downTimeSortDirection) {
    state.downTimeSortDirection = "desc";
  } else {
    state.downTimeSortDirection = state.downTimeSortDirection === "desc" ? "asc" : "desc";
  }
  renderTable();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".filter-menu")) {
    closeFilterMenus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFilterMenus();
  }
});

const initialWindowValues = getStoredFilterValues(windowInput);
setSelectedValues(windowInput, initialWindowValues.length ? initialWindowValues : [getInitialWindow()]);
commitFilterSelection(windowInput);
eventFilter.dataset.appliedValues = JSON.stringify(getStoredFilterValues(eventFilter));
setupComplaintControls();
loadUsers();
