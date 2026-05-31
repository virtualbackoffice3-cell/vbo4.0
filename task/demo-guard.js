(() => {
  const DEMO_MESSAGE = "Demo mode: this action is available for product walkthrough only.";
  const CSV_MESSAGE = "CSV export is disabled in the demo workspace.";
  const originalFetch = window.fetch.bind(window);
  const maps = {
    user: new Map(),
    name: new Map(),
    phone: new Map(),
    address: new Map(),
    pon: new Map(),
    team: new Map(),
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
    toast.classList.add("show");
    window.clearTimeout(showDemoToast.timer);
    showDemoToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
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

  function maskPon(value) {
    return String(value || "").replace(/\b([A-Z0-9]+)P(\d{1,2})\b/g, (match, olt, ponNumber) => {
      if (!maps.pon.has(match)) {
        maps.pon.set(match, `DEMOOLT${String(maps.pon.size + 1).padStart(2, "0")}P${ponNumber}`);
      }
      return maps.pon.get(match);
    });
  }

  function maskTeamName(value) {
    return String(value || "").split(",").map((name) => {
      const clean = name.trim();
      if (!clean) return clean;
      return nextValue(maps.team, clean, "", (index) => `Demo Team Member ${String(index).padStart(2, "0")}`);
    }).join(", ");
  }

  function maskByKey(key, value) {
    const normalizedKey = String(key || "").toLowerCase();
    if (value === null || value === undefined || value === "") return value;
    if (typeof value === "object") return value;

    if (normalizedKey === "client" || normalizedKey === "default_window" || normalizedKey === "window") return value;
    if (normalizedKey === "pon" || normalizedKey === "pon_no" || normalizedKey === "ponnumber") return maskPon(value);
    if (normalizedKey === "user_id" || normalizedKey === "userid" || normalizedKey === "users") {
      return nextValue(maps.user, value, "DEMO-USER-");
    }
    if (normalizedKey === "name") {
      return nextValue(maps.name, value, "", (index) => `Demo User ${String(index).padStart(3, "0")}`);
    }
    if (normalizedKey.includes("phone") || normalizedKey.includes("mobile")) return maskPhone(value);
    if (normalizedKey.includes("address") || normalizedKey === "location") {
      return nextValue(maps.address, value, "", (index) => `Demo Address ${String(index).padStart(3, "0")}`);
    }
    if (normalizedKey === "takenby" || normalizedKey.includes("team") || normalizedKey === "usermail") return maskTeamName(value);
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

  function maskDisplayText(text) {
    let maskedText = String(text || "");
    Object.keys(WINDOW_LABELS).sort((left, right) => right.length - left.length).forEach((key) => {
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

  function isWriteRequest(input, options = {}) {
    const method = String(options.method || input && input.method || "GET").toUpperCase();
    return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  }

  window.fetch = async function demoFetch(input, options = {}) {
    if (isWriteRequest(input, options)) {
      showDemoToast("Demo record saved for walkthrough.");
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

  window.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("demo-account");
    const title = document.querySelector(".title h1");
    if (title && !title.querySelector(".demo-account-badge")) {
      const badge = document.createElement("span");
      badge.className = "demo-account-badge";
      badge.textContent = "Demo account";
      title.appendChild(badge);
    }
    document.addEventListener("click", (event) => {
      const csvButton = event.target && event.target.closest ? event.target.closest("#csvButton") : null;
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
