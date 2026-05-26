const API_BASE = localStorage.getItem("dayEndApiBase") || "https://app2.vbo.co.in";
const CLIENTS = ["AMANWIZ", "MEDANTA", "SEVAI"];

const state = {
  tab: "report",
  rows: [],
  editing: null,
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
  badges: document.getElementById("statusBadges"),
  settlementSummary: document.getElementById("settlementSummary"),
  tableWrap: document.querySelector(".tableWrap"),
  tbody: document.getElementById("tableBody"),
  empty: document.getElementById("emptyState"),
  summary: document.getElementById("summaryText"),
  modal: document.getElementById("editModal"),
  editMeta: document.getElementById("editMeta"),
  editStatus: document.getElementById("editStatus"),
  editRemarks: document.getElementById("editRemarks"),
  saveEdit: document.getElementById("saveEditBtn"),
  cancelEdit: document.getElementById("cancelEditBtn"),
  closeModal: document.getElementById("closeModalBtn"),
  addressModal: document.getElementById("addressModal"),
  addressText: document.getElementById("addressText"),
  closeAddress: document.getElementById("closeAddressBtn"),
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
  } else {
    if (els.from.value) url.searchParams.set("date_from", els.from.value);
    if (els.to.value) url.searchParams.set("date_to", els.to.value);
  }
  if (els.search.value.trim()) url.searchParams.set("search", els.search.value.trim());
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
      && (state.tab !== "history" || (row.payment_status || "Pending") !== "Pending")
      && (state.tab === "settlement" || statuses.includes("ALL") || statuses.includes(row.payment_status || "Pending"))
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
  const isSettlement = state.tab === "settlement";
  els.tableWrap.hidden = isSettlement;
  els.settlementSummary.hidden = !isSettlement;
  document.querySelector("table").classList.toggle("historyTable", state.tab === "history");
  els.tbody.innerHTML = rows.map((row) => {
    const status = row.payment_status || "Pending";
    const markCell = state.tab === "history"
      ? `<span class="historyAction">${escapeHtml(row.action || "")}</span>`
      : `<button class="editBtn" type="button" data-edit="${row._client}:${row.id}" aria-label="Mark payment">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20zM16.2 3.6l4.2 4.2 1.1-1.1a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0l-1.1 1.1z"/></svg>
        </button>`;
    return `
      <tr>
        <td>${escapeHtml(row._client)}</td>
        <td>${escapeHtml(row.username)}</td>
        <td>${escapeHtml(row.TransactionName)}</td>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${escapeHtml(row.Phone)}</td>
        <td>${escapeHtml(row.Packagename)}</td>
        <td>${escapeHtml(row.byUser)}</td>
        <td>
          <button class="addressBtn" type="button" data-address="${escapeHtml(row.Address)}">
            ${escapeHtml(shortAddress(row.Address))}
          </button>
        </td>
        <td class="num">${money(row.Amount)}</td>
        <td><span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
        <td class="markCell">${markCell}</td>
        <td class="remarksCell">${escapeHtml(row.remarks)}</td>
      </tr>
    `;
  }).join("");
  els.empty.style.display = rows.length ? "none" : "block";
  els.summary.textContent = `${rows.length} ${state.tab === "history" ? "history entries" : isSettlement ? "settlement entries" : "report entries"}`;
  renderBadges(rows);
  renderSettlementSummary(rows);
}

function renderBadges(rows) {
  if (state.tab === "history" || state.tab === "settlement") {
    els.badges.innerHTML = "";
    els.badges.hidden = true;
    return;
  }
  els.badges.hidden = false;
  const order = ["Pending", "Due", "Done", "Balance"];
  const totals = new Map(order.map((status) => [status, { count: 0, amount: 0 }]));
  rows.forEach((row) => {
    const status = row.payment_status || "Pending";
    if (!totals.has(status)) totals.set(status, { count: 0, amount: 0 });
    const item = totals.get(status);
    item.count += 1;
    item.amount += Number(row.Amount || 0);
  });

  els.badges.innerHTML = order.map((status) => {
    const item = totals.get(status);
    return `
      <button class="summaryBadge ${status}" type="button" data-status-badge="${status}">
        <span>${status}</span>
        <strong>${item.count}</strong>
        <em>${money(item.amount)}</em>
      </button>
    `;
  }).join("");
}

function renderSettlementSummary(rows) {
  if (state.tab !== "settlement") {
    els.settlementSummary.innerHTML = "";
    return;
  }

  const totals = new Map();
  rows.forEach((row) => {
    const byUser = String(row.byUser || "Blank").trim() || "Blank";
    const client = row._client || "";
    const byTotals = totals.get(byUser) || new Map();
    const item = byTotals.get(client) || { amount: 0, count: 0 };
    item.amount += Number(row.Amount || 0);
    item.count += 1;
    byTotals.set(client, item);
    totals.set(byUser, byTotals);
  });

  const items = [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const clientTotals = new Map(CLIENTS.map((client) => [client, { amount: 0, count: 0 }]));
  let grandAmount = 0;
  let grandCount = 0;

  function cellText(item) {
    return item && item.count ? `${money(item.amount)}/${item.count}` : "0/0";
  }

  els.settlementSummary.innerHTML = `
    <h2>Today\`s cash settlemnet</h2>
    <div class="settlementMatrix">
      <div class="settlementHead">By</div>
      ${CLIENTS.map((client) => `<div class="settlementHead">${escapeHtml(client)}</div>`).join("")}
      <div class="settlementHead">Total</div>
      ${items.map(([byUser, byTotals]) => {
        let rowAmount = 0;
        let rowCount = 0;
        const cells = CLIENTS.map((client) => {
          const item = byTotals.get(client) || { amount: 0, count: 0 };
          const clientTotal = clientTotals.get(client);
          clientTotal.amount += item.amount;
          clientTotal.count += item.count;
          rowAmount += item.amount;
          rowCount += item.count;
          return `<div>${cellText(item)}</div>`;
        }).join("");
        grandAmount += rowAmount;
        grandCount += rowCount;
        return `
          <div>${escapeHtml(byUser)}</div>
          ${cells}
          <div><strong>${money(rowAmount)}/${rowCount}</strong></div>
        `;
      }).join("")}
      <div class="settlementTotal">Total</div>
      ${CLIENTS.map((client) => `<div class="settlementTotal">${cellText(clientTotals.get(client))}</div>`).join("")}
      <div class="settlementTotal">${money(grandAmount)}/${grandCount}</div>
    </div>
  `;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  if (!state.rows.length) {
    showToast("No visible entries");
    return;
  }

  const headers = ["Window", "Username", "Transaction", "Date", "Phone", "Package", "By", "Address", "Amount", "Status", "Remarks"];
  if (state.tab !== "history") {
    headers.splice(10, 0, "Mark");
  }

  const lines = [headers.map(csvCell).join(",")];
  state.rows.forEach((row) => {
    const values = [
      row._client,
      row.username,
      row.TransactionName,
      formatDate(row.date),
      row.Phone,
      row.Packagename,
      row.byUser,
      row.Address,
      money(row.Amount),
      row.payment_status || "Pending",
    ];
    if (state.tab !== "history") {
      values.push("Mark");
    }
    values.push(row.remarks);
    lines.push(values.map(csvCell).join(","));
  });

  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `day-end-${state.tab}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openEdit(key) {
  const [client, rowId] = key.split(":");
  const row = state.rows.find((item) => item._client === client && String(item.id) === String(rowId));
  if (!row) return;
  state.editing = row;
  els.editMeta.innerHTML = `
    <strong>${escapeHtml(row.username || "")}</strong>
    <span>${escapeHtml(row.Phone || "")}</span>
    <span>${escapeHtml(row.Packagename || "")}</span>
    <span>Amount: ${money(row.Amount)}</span>
  `;
  const statusValues = [...els.editStatus.options].map((option) => option.value);
  els.editStatus.value = statusValues.includes(row.payment_status) ? row.payment_status : "Pending";
  setDefaultEditRemark();
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

async function saveEdit() {
  if (!state.editing) return;
  const remarks = els.editRemarks.value.trim();
  if (!remarks) {
    showToast("Remark required");
    els.editRemarks.focus();
    return;
  }

  els.saveEdit.disabled = true;
  try {
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
    showToast("Report marked");
    await loadRows();
  } catch (error) {
    showToast("Update failed");
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
els.from.addEventListener("change", loadRows);
els.to.addEventListener("change", loadRows);
els.search.addEventListener("input", scheduleLoad);
els.editStatus.addEventListener("change", setDefaultEditRemark);
els.saveEdit.addEventListener("click", saveEdit);
els.cancelEdit.addEventListener("click", closeEdit);
els.closeModal.addEventListener("click", closeEdit);
els.closeAddress.addEventListener("click", closeAddress);
els.modal.addEventListener("click", (event) => {
  if (event.target === els.modal) closeEdit();
});
els.addressModal.addEventListener("click", (event) => {
  if (event.target === els.addressModal) closeAddress();
});

setupMultiSelect(els.windowMenu, els.windowBtn);
setupMultiSelect(els.statusMenu, els.statusBtn);
setDefaultDates();
loadRows();
