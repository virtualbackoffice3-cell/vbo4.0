(() => {
    const DEMO_MESSAGE = "Demo mode: this action is available for product walkthrough only.";
    const originalFetch = window.fetch.bind(window);
    const maps = {
        window: new Map(),
        username: new Map(),
        password: new Map(),
        group: new Map(),
        title: new Map(),
        message: new Map()
    };
    const WINDOW_LABELS = {
        AMANWIZ: "DEMO-WINDOW-01",
        MEDANTA: "DEMO-WINDOW-02",
        SEVAI: "DEMO-WINDOW-03"
    };

    function nextValue(map, rawValue, prefix, formatter) {
        const key = String(rawValue || "").trim();
        if (!key) return rawValue;
        if (!map.has(key)) {
            const index = map.size + 1;
            map.set(key, formatter ? formatter(index) : `${prefix}${String(index).padStart(3, "0")}`);
        }
        return map.get(key);
    }

    function showDemoStatus(message = DEMO_MESSAGE, type = "success") {
        const status = document.getElementById("statusMessage");
        if (!status) return;
        status.textContent = message;
        status.className = `status-message status-${type}`;
    }

    window.alert = function demoAlert(message) {
        showDemoStatus(message || DEMO_MESSAGE, "success");
    };

    window.confirm = function demoConfirm() {
        showDemoStatus(DEMO_MESSAGE, "success");
        return true;
    };

    function maskWindow(value) {
        const key = String(value || "").trim().toUpperCase();
        return WINDOW_LABELS[key] || nextValue(maps.window, value, "DEMO-WINDOW-");
    }

    function maskConfigValues(payload) {
        if (!payload || typeof payload !== "object") return payload;
        const copy = JSON.parse(JSON.stringify(payload));
        if (copy.values) {
            if (copy.values.DelDesk) {
                copy.values.DelDesk.Username = nextValue(maps.username, copy.values.DelDesk.Username, "demo.user.");
                copy.values.DelDesk.Password = nextValue(maps.password, copy.values.DelDesk.Password, "", (index) => `DemoPass-${String(index).padStart(3, "0")}`);
            }
            if (copy.values.NotifCloser) {
                copy.values.NotifCloser.GroupName = nextValue(maps.group, copy.values.NotifCloser.GroupName, "", (index) => `Demo Complaint Group ${String(index).padStart(2, "0")}`);
            }
            if (copy.values.NotificationBox) {
                copy.values.NotificationBox.ClientTitle = nextValue(maps.title, copy.values.NotificationBox.ClientTitle, "", (index) => `Demo Client ${String(index).padStart(2, "0")}`);
                copy.values.NotificationBox.EmptyMessage = nextValue(maps.message, copy.values.NotificationBox.EmptyMessage, "", (index) => `Demo message ${String(index).padStart(2, "0")}`);
            }
        }
        return copy;
    }

    function isWriteRequest(input, options = {}) {
        const method = String(options.method || input && input.method || "GET").toUpperCase();
        return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    }

    window.fetch = async function demoFetch(input, options = {}) {
        if (isWriteRequest(input, options)) {
            showDemoStatus("Demo configuration saved for walkthrough.", "success");
            let body = {};
            try {
                body = JSON.parse(options.body || "{}");
            } catch (error) {
                body = {};
            }
            return new Response(JSON.stringify(maskConfigValues({ values: body.values || {} })), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        const response = await originalFetch(input, options);
        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.toLowerCase().includes("application/json")) return response;
        try {
            const payload = await response.clone().json();
            const headers = new Headers(response.headers);
            headers.delete("Content-Length");
            headers.delete("Content-Encoding");
            return new Response(JSON.stringify(maskConfigValues(payload)), {
                status: response.status,
                statusText: response.statusText,
                headers
            });
        } catch (error) {
            return response;
        }
    };

    function maskDisplayText(text) {
        let maskedText = String(text || "");
        Object.keys(WINDOW_LABELS).forEach((key) => {
            maskedText = maskedText.replace(new RegExp(key, "gi"), WINDOW_LABELS[key]);
        });
        return maskedText;
    }

    function maskTextNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            const maskedText = maskDisplayText(node.nodeValue);
            if (maskedText !== node.nodeValue) node.nodeValue = maskedText;
        });
    }

    function scheduleDisplayMask() {
        if (scheduleDisplayMask.timer) return;
        scheduleDisplayMask.timer = window.setTimeout(() => {
            scheduleDisplayMask.timer = null;
            maskTextNodes(document.body);
        }, 80);
    }

    window.addEventListener("DOMContentLoaded", () => {
        document.body.classList.add("demo-account");
        scheduleDisplayMask();
        const observer = new MutationObserver((mutations) => {
            if (mutations.some((mutation) => mutation.addedNodes.length || mutation.type === "characterData")) {
                scheduleDisplayMask();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
})();
