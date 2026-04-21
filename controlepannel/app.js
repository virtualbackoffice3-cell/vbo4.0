const fieldMap = {
    delDeskUsername: ["DelDesk", "Username"],
    delDeskPassword: ["DelDesk", "Password"],
    groupName: ["NotifCloser", "GroupName"],
    powerMin: ["Complaints", "PowerMin"],
    powerMax: ["Complaints", "PowerMax"],
    repeatHours: ["Complaints", "RepeatHours"],
    clientTitle: ["NotificationBox", "ClientTitle"],
    emptyMessage: ["NotificationBox", "EmptyMessage"],
    workStartHour: ["NotificationBox", "WorkStartHour"],
    workEndHour: ["NotificationBox", "WorkEndHour"],
};

const API_BASE_META = document.querySelector('meta[name="api-base"]');
const API_BASE = API_BASE_META ? API_BASE_META.content.trim().replace(/\/+$/, "") : "";
const windowSelect = document.getElementById("windowSelect");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");
const saveButtonSticky = document.getElementById("saveButtonSticky");
const resetButtonSticky = document.getElementById("resetButtonSticky");
const statusMessage = document.getElementById("statusMessage");
const summaryWindowName = document.getElementById("summaryWindowName");
const stickyWindowName = document.getElementById("stickyWindowName");

let currentValues = {};

function setStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
}

function setBusy(isBusy) {
    saveButton.disabled = isBusy;
    resetButton.disabled = isBusy;
    saveButtonSticky.disabled = isBusy;
    resetButtonSticky.disabled = isBusy;
    windowSelect.disabled = isBusy;
}

function getWindowName() {
    return windowSelect.value;
}

function endpoint(path) {
    return `${API_BASE}${path}`;
}

function prettyValue(value) {
    if (value === undefined || value === null || value === "") {
        return "-";
    }
    const text = String(value).trim();
    return text === "" ? "-" : text;
}

function updateCurrentBadges(values) {
    Object.entries(fieldMap).forEach(([elementId, [section, key]]) => {
        const currentBadge = document.getElementById(`current-${elementId}`);
        if (currentBadge) {
            currentBadge.textContent = `Current: ${prettyValue(values?.[section]?.[key])}`;
            currentBadge.title = prettyValue(values?.[section]?.[key]);
        }
    });
}

function updateSummary(values) {
    summaryWindowName.textContent = getWindowName();
    stickyWindowName.textContent = getWindowName();
    document.getElementById("summaryUsername").textContent = prettyValue(values?.DelDesk?.Username);
    document.getElementById("summaryGroupName").textContent = prettyValue(values?.NotifCloser?.GroupName);
    document.getElementById("summaryPowerRange").textContent = `${prettyValue(values?.Complaints?.PowerMin)} to ${prettyValue(values?.Complaints?.PowerMax)}`;
    document.getElementById("summaryRepeatHours").textContent = prettyValue(values?.Complaints?.RepeatHours);
    document.getElementById("summaryClientTitle").textContent = prettyValue(values?.NotificationBox?.ClientTitle);
    document.getElementById("summaryWorkWindow").textContent = `${prettyValue(values?.NotificationBox?.WorkStartHour)} to ${prettyValue(values?.NotificationBox?.WorkEndHour)}`;
}

function applyValues(values) {
    Object.entries(fieldMap).forEach(([elementId, [section, key]]) => {
        const element = document.getElementById(elementId);
        element.value = values?.[section]?.[key] ?? "";
    });
    currentValues = values || {};
    updateCurrentBadges(currentValues);
    updateSummary(currentValues);
}

function collectPayload() {
    const values = {};

    Object.entries(fieldMap).forEach(([elementId, [section, key]]) => {
        if (!values[section]) {
            values[section] = {};
        }
        values[section][key] = document.getElementById(elementId).value;
    });

    return { values };
}

async function parseJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail || "Request failed");
    }
    return data;
}

async function loadConfig() {
    setBusy(true);
    setStatus(`Loading ${getWindowName()} values...`, "loading");

    try {
        const response = await fetch(endpoint(`/controlepannel/${getWindowName()}`));
        const data = await parseJson(response);
        applyValues(data.values || {});
        setStatus(`${getWindowName()} values loaded.`, "success");
    } catch (error) {
        setStatus(`Load failed: ${error.message}`, "error");
    } finally {
        setBusy(false);
    }
}

async function saveConfig() {
    setBusy(true);
    setStatus(`Saving ${getWindowName()} values...`, "loading");

    try {
        const response = await fetch(endpoint(`/controlepannel/${getWindowName()}`), {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(collectPayload()),
        });
        const data = await parseJson(response);
        applyValues(data.values || {});
        setStatus(`${getWindowName()} config updated successfully.`, "success");
    } catch (error) {
        setStatus(`Save failed: ${error.message}`, "error");
    } finally {
        setBusy(false);
    }
}

async function resetConfig() {
    const confirmed = window.confirm(`Reset ${getWindowName()} values to default?`);
    if (!confirmed) {
        return;
    }

    setBusy(true);
    setStatus(`Resetting ${getWindowName()} values...`, "loading");

    try {
        const response = await fetch(endpoint(`/controlepannel/${getWindowName()}/reset`), {
            method: "POST",
        });
        const data = await parseJson(response);
        applyValues(data.values || {});
        setStatus(`${getWindowName()} config reset successfully.`, "success");
    } catch (error) {
        setStatus(`Reset failed: ${error.message}`, "error");
    } finally {
        setBusy(false);
    }
}

saveButton.addEventListener("click", saveConfig);
resetButton.addEventListener("click", resetConfig);
saveButtonSticky.addEventListener("click", saveConfig);
resetButtonSticky.addEventListener("click", resetConfig);
windowSelect.addEventListener("change", loadConfig);

loadConfig();
