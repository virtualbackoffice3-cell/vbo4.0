const API_BASE = localStorage.getItem("dayEndApiBase") || "https://app2.vbo.co.in";
const CLIENTS = ["AMANWIZ", "MEDANTA", "SEVAI"];

const state = {
  tab: "report",
  rows: [],
  editing: null,
  detailRows: [],
  detailTitle: "",
};

const els = {
  windowBtn: document.getElementById("windowSelectBtn"),
  windowMenu: document.getElementById("windowMenu"),
  statusBtn: document.getElementById("statusSelectBtn"),
  statusMenu: document.getElementById("statusMenu"),
  search: document.getElementById("searchInput"),
  from: document.getElementById("dateFrom"),
  to: document.getElementById("dateTo"),
  refresh: document.getElementById("refreshBtn"),
  csv: document.getElementById("csvBtn"),
  png: document.getElementById("pngBtn"),
  badges: document.getElementById("statusBadges"),
  settlementSummary: document.getElementById("settlementSummary"),
  tableWrap: document.querySelector(".tableWrap"),
  tbody: document.getElementById("tableBody"),
  empty: document.getElementById("emptyState"),
  summary: document.getElementById("summaryText"),
  toolbar: document.querySelector(".toolbar"),
  modal: document.getElementById("editModal"),
  editMeta: document.getElementById("editMeta"),
  editStatus: document.getElementById("editStatus"),
  editRemarks: document.getElementById("editRemarks"),
  editCallingPhone: document.getElementById("editCallingPhone"),
  saveEdit: document.getElementById("saveEditBtn"),
  cancelEdit: document.getElementById("cancelEditBtn"),
  closeModal: document.getElementById("closeModalBtn"),
  addressModal: document.getElementById("addressModal"),
  addressText: document.getElementById("addressText"),
  closeAddress: document.getElementById("closeAddressBtn"),
  detailModal: document.getElementById("detailModal"),
  detailTitle: document.getElementById("detailTitle"),
  detailContent: document.getElementById("detailContent"),
  detailCsv: document.getElementById("detailCsvBtn"),
  detailPng: document.getElementById("detailPngBtn"),
  closeDetail: document.getElementById("closeDetailBtn"),
  toast: document.getElementById("toast"),
};

function toInputDate(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function setDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 2);
  els.from.value = toInputDate(from);
  els.to.value = toInputDate(to);
}

function money(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-IN");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.style.display = "block";
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.style.display = "none";
  }, 2200);
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(",", "");
}

function rowInputDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : toInputDate(date);
}

function shortAddress(value) {
  const address = String(value || "");
  return address.length > 15 ? `${address.slice(0, 15)}...` : address;
}

function phoneParts(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function displayPhone(row) {
  const phones = [...phoneParts(row.registered_phone || row.Phone), ...phoneParts(row.calling_phone || row["Calling no"])];
  return [...new Set(phones)].join(", ");
}

function isPendingValidation(row) {
  const status = String(row.payment_status || "Pending").trim().toLowerCase();
  return status === "pending" || status === "partial pending";
}

function getCheckedValues(menu) {
  const checked = [...menu.querySelectorAll("input:checked")].map((item) => item.value);
  if (checked.includes("ALL") || checked.length === 0) return ["ALL"];
  return checked;
}

function selectedClients() {
  const values = getCheckedValues(els.windowMenu);
  return values.includes("ALL") ? CLIENTS : values;
}

function selectedStatuses() {
  return getCheckedValues(els.statusMenu);
}

function updateMultiButton(menu, button) {
  const values = getCheckedValues(menu);
  button.textContent = values.includes("ALL") ? "All" : values.join(", ");
}

function setupMultiSelect(menu, button) {
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });

  menu.addEventListener("change", (event) => {
    const changed = event.target;
    const allInput = menu.querySelector('input[value="ALL"]');
    const inputs = [...menu.querySelectorAll('input:not([value="ALL"])')];

    if (changed.value === "ALL" && changed.checked) {
      inputs.forEach((input) => { input.checked = false; });
    } else if (changed.value !== "ALL" && changed.checked) {
      allInput.checked = false;
    }

    if (![...menu.querySelectorAll("input:checked")].length) {
      allInput.checked = true;
    }

    updateMultiButton(menu, button);
    loadRows();
  });
}

document.addEventListener("click", (event) => {
  document.querySelectorAll(".multiSelect").forEach((box) => {
    if (!box.contains(event.target)) {
      const menu = box.querySelector(".multiMenu");
      if (menu) menu.hidden = true;
    }
  });
});

function buildUrl(client) {
  const endpoint = state.tab === "history" ? "log" : "report";
  const url = new URL(`${API_BASE}/${client}/dayendreport/${endpoint}`);
  if (state.tab === "settlement") {
    const today = toInputDate(new Date());
    url.searchParams.set("date_from", today);
    url.searchParams.set("date_to", today);
  } else if (state.tab !== "pending") {
    if (els.from.value) url.searchParams.set("date_from", els.from.value);
    if (els.to.value) url.searchParams.set("date_to", els.to.value);
  }
  if (state.tab === "pending") {
    url.searchParams.set("limit", "10000");
  }
  if (state.tab !== "settlement" && state.tab !== "pending" && els.search.value.trim()) {
    url.searchParams.set("search", els.search.value.trim());
  }
  return url;
}

async function loadRows() {
  els.refresh.disabled = true;
  els.summary.textContent = "Loading...";
  try {
    const responses = await Promise.all(selectedClients().map(async (client) => {
      const response = await fetch(buildUrl(client));
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return (data.rows || []).map((row) => ({ ...row, _client: client }));
    }));
    const statuses = selectedStatuses();
    const today = toInputDate(new Date());
    state.rows = responses.flat().filter((row) => (
      (state.tab !== "settlement" || rowInputDate(row.date) === today)
      && (state.tab !== "pending" || isPendingValidation(row))
      && (state.tab !== "history" || (row.payment_status || "Pending") !== "Pending")
      && (state.tab === "settlement" || state.tab === "pending" || statuses.includes("ALL") || statuses.includes(row.payment_status || "Pending"))
    ));
    render();
  } catch (error) {
    state.rows = [];
    render();
    showToast("Unable to load report");
  } finally {
    els.refresh.disabled = false;
  }
}

function render() {
  const rows = state.rows;
  const isMatrix = state.tab === "settlement" || state.tab === "pending";
  els.tableWrap.hidden = isMatrix;
  els.settlementSummary.hidden = !isMatrix;
  els.toolbar.classList.toggle("matrixMode", isMatrix);
  document.querySelector("table").classList.toggle("historyTable", state.tab === "history");
  els.tbody.innerHTML = rows.map(renderTableRow).join("");
  els.empty.style.display = rows.length ? "none" : "block";
  els.summary.textContent = `${rows.length} ${state.tab === "history" ? "history entries" : isMatrix ? "matrix entries" : "report entries"}`;
  renderBadges(rows);
  renderMatrixSummary(rows);
}

function renderTableRow(row) {
  const status = row.payment_status || "Pending";
  const markCell = state.tab === "history"
    ? `<span class="historyAction">${escapeHtml(row.action || "")}</span>`
    : `<button class="editBtn" type="button" data-edit="${row._client}:${row.id}" aria-label="Mark payment">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20zM16.2 3.6l4.2 4.2 1.1-1.1a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0l-1.1 1.1z"/></svg>
      </button>`;
  return `
    <tr>
      <td>${escapeHtml(row._client)}</td>
      <td>${escapeHtml(row.UserID || row.username)}</td>
      <td>${escapeHtml(row.Username || "")}</td>
      <td>${escapeHtml(formatDate(row.date))}</td>
      <td>${escapeHtml(row.byUser)}</td>
      <td class="num">${money(row.Amount)}</td>
      <td class="markCell">${markCell}</td>
      <td><span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
      <td class="remarksCell">${escapeHtml(row.remarks)}</td>
      <td>${escapeHtml(displayPhone(row))}</td>
      <td>${escapeHtml(row.Packagename)}</td>
      <td>
        <button class="addressBtn" type="button" data-address="${escapeHtml(row.Address)}">
          ${escapeHtml(shortAddress(row.Address))}
        </button>
      </td>
    </tr>
  `;
}

function renderBadges(rows) {
  if (state.tab === "history" || state.tab === "settlement" || state.tab === "pending") {
    els.badges.innerHTML = "";
    els.badges.hidden = true;
    return;
  }
  els.badges.hidden = false;
  const order = ["Pending", "Amanwiz UPI", "Cash", "Partial Pending", "Wave off"];
  const totals = new Map(order.map((status) => [status, { count: 0, amount: 0 }]));
  rows.forEach((row) => {
    const status = row.payment_status || "Pending";
    if (!totals.has(status)) totals.set(status, { count: 0, amount: 0 });
    const item = totals.get(status);
    item.count += 1;
    item.amount += Number(row.Amount || 0);
  });

  els.badges.innerHTML = [...totals.entries()].map(([status, item]) => `
    <button class="summaryBadge ${status.replaceAll(" ", "")}" type="button" data-status-badge="${escapeHtml(status)}">
      <span>${escapeHtml(status)}</span>
      <strong>${item.count}</strong>
      <em>${money(item.amount)}</em>
    </button>
  `).join("");
}

function renderMatrixSummary(rows) {
  if (state.tab !== "settlement" && state.tab !== "pending") {
    els.settlementSummary.innerHTML = "";
    return;
  }

  const title = state.tab === "pending" ? "Pending validation" : "Today`s cash settlemnet";
  const totals = buildMatrix(rows);
  const items = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const clientTotals = new Map(CLIENTS.map((client) => [client, { amount: 0, count: 0, rows: [] }]));
  let grandAmount = 0;
  let grandCount = 0;
  const allRows = [];

  function cellText(item) {
    return item && item.count ? `${money(item.amount)}/${item.count}` : "0/0";
  }

  els.settlementSummary.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <div class="settlementMatrix">
      <div class="settlementHead">Recharged by</div>
      ${CLIENTS.map((client) => `<div class="settlementHead">${escapeHtml(client)}</div>`).join("")}
      <div class="settlementHead">Total</div>
      ${items.map(([byUser, byTotals]) => {
        let rowAmount = 0;
        let rowCount = 0;
        const rowRows = [];
        const cells = CLIENTS.map((client) => {
          const item = byTotals.get(client) || { amount: 0, count: 0, rows: [] };
          const clientTotal = clientTotals.get(client);
          clientTotal.amount += item.amount;
          clientTotal.count += item.count;
          clientTotal.rows.push(...item.rows);
          rowAmount += item.amount;
          rowCount += item.count;
          rowRows.push(...item.rows);
          allRows.push(...item.rows);
          return `<button class="matrixCell" type="button" data-matrix="${escapeHtml(byUser)}|${escapeHtml(client)}">${cellText(item)}</button>`;
        }).join("");
        grandAmount += rowAmount;
        grandCount += rowCount;
        return `
          <div>${escapeHtml(byUser)}</div>
          ${cells}
          <button class="matrixCell matrixStrong" type="button" data-matrix="${escapeHtml(byUser)}|__TOTAL__">${money(rowAmount)}/${rowCount}</button>
        `;
      }).join("")}
      <div class="settlementTotal">Total</div>
      ${CLIENTS.map((client) => `<button class="matrixCell settlementTotal" type="button" data-matrix="__TOTAL__|${escapeHtml(client)}">${cellText(clientTotals.get(client))}</button>`).join("")}
      <button class="matrixCell settlementTotal" type="button" data-matrix="__TOTAL__|__TOTAL__">${money(grandAmount)}/${grandCount}</button>
    </div>
  `;
  els.settlementSummary.dataset.matrixTitle = title;
}

function buildMatrix(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    const byUser = String(row.byUser || "Blank").trim() || "Blank";
    const client = row._client || "";
    const byTotals = totals.get(byUser) || new Map();
    const item = byTotals.get(client) || { amount: 0, count: 0, rows: [] };
    item.amount += Number(row.Amount || 0);
    item.count += 1;
    item.rows.push(row);
    byTotals.set(client, item);
    totals.set(byUser, byTotals);
  });
  return totals;
}

function rowsForMatrixKey(key) {
  const [byUser, client] = key.split("|");
  return state.rows.filter((row) => (
    (byUser === "__TOTAL__" || String(row.byUser || "Blank").trim() === byUser)
    && (client === "__TOTAL__" || row._client === client)
  ));
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function tableHeaders(includeMark = true) {
  return ["Window", "UserID", "Username", "Date", "Recharged by", "Amount", ...(includeMark ? ["Mark"] : []), "Status", "Remarks", "Phone", "Package", "Address"];
}

function rowValues(row, includeMark = true) {
  const values = [
    row._client,
    row.UserID || row.username,
    row.Username || "",
    formatDate(row.date),
    row.byUser,
    money(row.Amount),
  ];
  if (includeMark) values.push(state.tab === "history" ? row.action || "" : "Mark");
  values.push(row.payment_status || "Pending", row.remarks, displayPhone(row), row.Packagename, row.Address);
  return values;
}

function downloadCsv() {
  if (!state.rows.length) {
    showToast("No visible entries");
    return;
  }

  const lines = [tableHeaders(state.tab !== "history").map(csvCell).join(",")];
  state.rows.forEach((row) => {
    lines.push(rowValues(row, state.tab !== "history").map(csvCell).join(","));
  });

  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `day-end-${state.tab}-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadDetailCsv() {
  if (!state.detailRows.length) {
    showToast("No popup entries");
    return;
  }
  const lines = [tableHeaders(false).map(csvCell).join(",")];
  state.detailRows.forEach((row) => {
    lines.push(rowValues(row, false).map(csvCell).join(","));
  });
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `day-end-details-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text ?? "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  return lines.slice(0, 3);
}

function drawPng(title, headers, rows, filename) {
  if (!rows.length) {
    showToast("No entries for PNG");
    return;
  }
  const dense = rows.length > 300;
  const scale = rows.length > 500 ? 1 : 2;
  const colWidths = headers.map((header) => Math.max(95, Math.min(210, String(header).length * 12 + 34)));
  rows.forEach((row) => row.forEach((value, index) => {
    colWidths[index] = Math.max(colWidths[index], Math.min(240, String(value ?? "").length * 7 + 28));
  }));
  const width = Math.max(900, colWidths.reduce((sum, item) => sum + item, 0) + 48);
  const rowHeight = dense ? 28 : 42;
  const height = 86 + rowHeight * (rows.length + 1) + 28;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#102033";
  ctx.font = "700 22px Arial";
  ctx.fillText(title, 24, 36);
  ctx.font = "12px Arial";
  ctx.fillStyle = "#52677c";
  ctx.fillText(new Date().toLocaleString("en-IN"), 24, 58);
  ctx.fillText(`Entries: ${rows.length}`, 220, 58);

  let x = 24;
  let y = 78;
  ctx.font = "700 12px Arial";
  headers.forEach((header, index) => {
    ctx.fillStyle = "#f1f5f3";
    ctx.fillRect(x, y, colWidths[index], rowHeight);
    ctx.strokeStyle = "#dce6e1";
    ctx.strokeRect(x, y, colWidths[index], rowHeight);
    ctx.fillStyle = "#385064";
    ctx.fillText(String(header), x + 8, y + 25);
    x += colWidths[index];
  });

  ctx.font = "13px Arial";
  rows.forEach((row) => {
    x = 24;
    y += rowHeight;
    row.forEach((value, index) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, colWidths[index], rowHeight);
      ctx.strokeStyle = "#e4ece8";
      ctx.strokeRect(x, y, colWidths[index], rowHeight);
      ctx.fillStyle = "#102033";
      const lines = dense ? [String(value ?? "").slice(0, 38)] : wrapText(ctx, value, colWidths[index] - 16);
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + 8, y + (dense ? 18 : 17) + lineIndex * 12);
      });
      x += colWidths[index];
    });
  });

  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, "image/png");
}

function downloadPng() {
  if (state.tab === "settlement" || state.tab === "pending") {
    const matrixRows = [];
    const matrix = buildMatrix(state.rows);
    [...matrix.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([byUser, byTotals]) => {
      let rowAmount = 0;
      let rowCount = 0;
      const row = [byUser];
      CLIENTS.forEach((client) => {
        const item = byTotals.get(client) || { amount: 0, count: 0 };
        row.push(`${money(item.amount)}/${item.count}`);
        rowAmount += item.amount;
        rowCount += item.count;
      });
      row.push(`${money(rowAmount)}/${rowCount}`);
      matrixRows.push(row);
    });
    drawPng(els.settlementSummary.dataset.matrixTitle || state.tab, ["Recharged by", ...CLIENTS, "Total"], matrixRows, `day-end-${state.tab}.png`);
    return;
  }
  drawPng("Day end report", tableHeaders(state.tab !== "history"), state.rows.map((row) => rowValues(row, state.tab !== "history")), `day-end-${state.tab}.png`);
}

function openEdit(key) {
  const [client, rowId] = key.split(":");
  const row = state.rows.find((item) => item._client === client && String(item.id) === String(rowId));
  if (!row) return;
  state.editing = row;
  els.editMeta.innerHTML = `
    <strong>${escapeHtml(row.UserID || row.username || "")}</strong>
    <span>${escapeHtml(row.Username || "")}</span>
    <span>${escapeHtml(row.registered_phone || row.Phone || "")}</span>
    <span>${escapeHtml(row.Packagename || "")}</span>
    <span>Amount: ${money(row.Amount)}</span>
  `;
  const statusValues = [...els.editStatus.options].map((option) => option.value);
  els.editStatus.value = statusValues.includes(row.payment_status) ? row.payment_status : "Pending";
  setDefaultEditRemark();
  els.editCallingPhone.value = "";
  els.modal.hidden = false;
}

function closeEdit() {
  state.editing = null;
  els.modal.hidden = true;
}

function openAddress(address) {
  els.addressText.textContent = address || "";
  els.addressModal.hidden = false;
}

function closeAddress() {
  els.addressModal.hidden = true;
}

function openDetail(title, rows) {
  state.detailRows = rows;
  state.detailTitle = title;
  els.detailTitle.textContent = title;
  els.detailContent.innerHTML = `
    <table class="detailTable">
      <thead><tr>${tableHeaders(true).map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `
        ${renderDetailRow(row)}
      `).join("")}</tbody>
    </table>
  `;
  els.detailModal.hidden = false;
}

function renderDetailRow(row) {
  const values = rowValues(row, false);
  const markIndex = 6;
  const beforeMark = values.slice(0, markIndex).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
  const afterMark = values.slice(markIndex).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
  const markCell = `
    <td class="markCell">
      <button class="editBtn" type="button" data-detail-edit="${escapeHtml(row._client)}:${escapeHtml(row.id)}" aria-label="Mark payment">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20zM16.2 3.6l4.2 4.2 1.1-1.1a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0l-1.1 1.1z"/></svg>
      </button>
    </td>
  `;
  return `<tr>${beforeMark}${markCell}${afterMark}</tr>`;
}

function closeDetail() {
  state.detailRows = [];
  state.detailTitle = "";
  els.detailModal.hidden = true;
}

async function saveEdit() {
  if (!state.editing) return;
  const remarks = els.editRemarks.value.trim();
  const callingPhone = els.editCallingPhone.value.trim();
  const callingPhones = phoneParts(callingPhone);
  if (!remarks) {
    showToast("Remark required");
    els.editRemarks.focus();
    return;
  }
  if (!callingPhone) {
    showToast("Calling no required");
    els.editCallingPhone.focus();
    return;
  }
  if (!callingPhones.length || callingPhones.some((phone) => !/^\d{10}$/.test(phone))) {
    showToast("Enter 10 digit calling no");
    els.editCallingPhone.focus();
    return;
  }

  els.saveEdit.disabled = true;
  try {
    const userId = state.editing.UserID || state.editing.username || "";
    const callingResponse = await fetch(`${API_BASE}/${state.editing._client}/user/calling_phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, calling_phone: callingPhone }),
    });
    const callingResult = await callingResponse.json();
    if (!callingResponse.ok || callingResult.status !== "ok") {
      throw new Error(callingResult.message || "Calling no save failed");
    }

    const response = await fetch(`${API_BASE}/${state.editing._client}/dayendreport/report/${state.editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_status: els.editStatus.value,
        remarks,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    closeEdit();
    showToast("Record saved!");
    await loadRows();
  } catch (error) {
    showToast(error.message || "Update failed");
  } finally {
    els.saveEdit.disabled = false;
  }
}

function setDefaultEditRemark() {
  const defaults = {
    "Amanwiz UPI": "UPI Transaction no - ",
    Cash: "Cash received by - ",
  };
  els.editRemarks.value = defaults[els.editStatus.value] || "";
}

let searchTimer = null;
function scheduleLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadRows, 250);
}

els.tbody.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) openEdit(editButton.dataset.edit);

  const addressButton = event.target.closest("[data-address]");
  if (addressButton) openAddress(addressButton.dataset.address);
});

els.badges.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status-badge]");
  if (!button) return;
  els.statusMenu.querySelectorAll("input").forEach((input) => {
    input.checked = input.value === button.dataset.statusBadge;
  });
  updateMultiButton(els.statusMenu, els.statusBtn);
  loadRows();
});

els.settlementSummary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-matrix]");
  if (!button) return;
  const rows = rowsForMatrixKey(button.dataset.matrix);
  const [byUser, client] = button.dataset.matrix.split("|");
  const title = `${els.settlementSummary.dataset.matrixTitle || "Entries"} - ${byUser === "__TOTAL__" ? "Total" : byUser} / ${client === "__TOTAL__" ? "Total" : client}`;
  openDetail(title, rows);
});

els.detailContent.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-detail-edit]");
  if (!editButton) return;
  closeDetail();
  openEdit(editButton.dataset.detailEdit);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    state.tab = button.dataset.tab;
    loadRows();
  });
});

els.refresh.addEventListener("click", loadRows);
els.csv.addEventListener("click", downloadCsv);
els.png.addEventListener("click", downloadPng);
els.from.addEventListener("change", loadRows);
els.to.addEventListener("change", loadRows);
els.search.addEventListener("input", scheduleLoad);
els.editStatus.addEventListener("change", setDefaultEditRemark);
els.saveEdit.addEventListener("click", saveEdit);
els.cancelEdit.addEventListener("click", closeEdit);
els.closeModal.addEventListener("click", closeEdit);
els.closeAddress.addEventListener("click", closeAddress);
els.closeDetail.addEventListener("click", closeDetail);
els.detailCsv.addEventListener("click", downloadDetailCsv);
els.detailPng.addEventListener("click", () => {
  drawPng(state.detailTitle || "Entries", tableHeaders(false), state.detailRows.map((row) => rowValues(row, false)), "day-end-details.png");
});
els.modal.addEventListener("click", (event) => {
  if (event.target === els.modal) closeEdit();
});
els.addressModal.addEventListener("click", (event) => {
  if (event.target === els.addressModal) closeAddress();
});
els.detailModal.addEventListener("click", (event) => {
  if (event.target === els.detailModal) closeDetail();
});

setupMultiSelect(els.windowMenu, els.windowBtn);
setupMultiSelect(els.statusMenu, els.statusBtn);
setDefaultDates();
loadRows();
