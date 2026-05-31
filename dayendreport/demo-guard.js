(() => {
  const DEMO_MESSAGE = "Demo mode: this action is available for product walkthrough only.";
  const CSV_MESSAGE = "CSV export is disabled in the demo workspace.";
  const originalFetch = window.fetch.bind(window);
  const maps = {
    user: new Map(),
    name: new Map(),
    phone: new Map(),
    address: new Map(),
    package: new Map(),
    byUser: new Map(),
    remark: new Map()
  };
  const WINDOW_LABELS = {
    AMANWIZ: "DEMO-WINDOW-01",
    MEDANTA: "DEMO-WINDOW-02",
    SEVAI: "DEMO-WINDOW-03"
  };

  function showDemoToast(message = DEMO_MESSAGE) {
    let toast = document.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = "block";
    window.clearTimeout(showDemoToast.timer);
    showDemoToast.timer = window.setTimeout(() => { toast.style.display = "none"; }, 2400);
  }

  window.alert = function demoAlert(message) {
    showDemoToast(message || DEMO_MESSAGE);
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

  function maskPhone(value) {
    return nextValue(maps.phone, value, "", (index) => `90000${String(index).padStart(5, "0")}`.slice(-10));
  }

  function maskByKey(key, value) {
    const normalizedKey = String(key || "").toLowerCase();
    if (value === null || value === undefined || value === "") return value;
    if (typeof value === "object") return value;

    if (normalizedKey === "_client" || normalizedKey === "client" || normalizedKey === "window") return value;
    if (normalizedKey === "userid" || normalizedKey === "user_id" || key === "username") {
      return nextValue(maps.user, value, "DEMO-USER-");
    }
    if (key === "Username" || normalizedKey === "transactionname" || normalizedKey === "name") {
      return nextValue(maps.name, value, "", (index) => `Demo User ${String(index).padStart(3, "0")}`);
    }
    if (normalizedKey === "phone" || normalizedKey.includes("mobile")) return maskPhone(value);
    if (normalizedKey === "address" || normalizedKey.includes("location")) {
      return nextValue(maps.address, value, "", (index) => `Demo Address ${String(index).padStart(3, "0")}`);
    }
    if (normalizedKey === "packagename" || normalizedKey === "package") {
      return nextValue(maps.package, value, "", (index) => `Demo Package ${String(index).padStart(2, "0")}`);
    }
    if (normalizedKey === "byuser" || normalizedKey === "rechargedby") {
      return nextValue(maps.byUser, value, "", (index) => `Demo Collector ${String(index).padStart(2, "0")}`);
    }
    if (normalizedKey.includes("remark")) {
      return nextValue(maps.remark, value, "", (index) => `Demo remark ${String(index).padStart(3, "0")}`);
    }
    return value;
  }

  function maskPayload(payload, parentKey = "") {
    if (Array.isArray(payload)) return payload.map((item) => maskPayload(item, parentKey));
    if (payload && typeof payload === "object") {
      const copy = {};
      Object.keys(payload).forEach((key) => {
        copy[key] = maskPayload(maskByKey(key, payload[key]), key);
      });
      return copy;
    }
    return maskByKey(parentKey, payload);
  }

  function isWriteRequest(input, options = {}) {
    const method = String(options.method || input && input.method || "GET").toUpperCase();
    return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  }

  window.fetch = async function demoFetch(input, options = {}) {
    if (isWriteRequest(input, options)) {
      showDemoToast("Demo payment status saved for walkthrough.");
      return new Response(JSON.stringify({ ok: true, demo: true, message: DEMO_MESSAGE }), {
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
      return new Response(JSON.stringify(maskPayload(payload)), {
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
    document.addEventListener("click", (event) => {
      const csvButton = event.target && event.target.closest ? event.target.closest("#csvBtn, #detailCsvBtn") : null;
      if (!csvButton) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showDemoToast(CSV_MESSAGE);
    }, true);
    scheduleDisplayMask();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length || mutation.type === "characterData")) {
        scheduleDisplayMask();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
