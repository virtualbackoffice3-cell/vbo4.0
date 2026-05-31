(() => {
    const DEMO_MESSAGE = "Demo mode: this action is available for product walkthrough only.";
    const SEARCH_MESSAGE = "Search becomes available after your JC tree is created. You can use it to find any branch by JC name, PON number, wire detail, area, remark, or other saved information. The JC tree stays live connected with field data and highlights live fault JCs as they appear.";
    const DOWNLOAD_MESSAGE = "CSV export is disabled in the demo workspace.";
    const DEMO_STORE_KEY = "jc-tree-demo-local-v1";
    const originalFetch = window.fetch.bind(window);
    const maps = {
        user: new Map(),
        name: new Map(),
        phone: new Map(),
        address: new Map(),
        email: new Map(),
        mac: new Map(),
        jc: new Map(),
        pon: new Map(),
        window: new Map(),
        wire: new Map(),
        remark: new Map()
    };
    const WINDOW_LABELS = {
        AMANWIZ: "DEMO-WINDOW-01",
        MEDANTA: "DEMO-WINDOW-02",
        SEVAI: "DEMO-WINDOW-03"
    };
    const LAT_OFFSET = 5.7312;
    const LNG_OFFSET = -7.4825;

    function showDemoToast(message = DEMO_MESSAGE, duration = 3000) {
        let toast = document.getElementById("demoAccountToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "demoAccountToast";
            toast.className = "demo-account-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add("show");
        window.clearTimeout(showDemoToast.timer);
        showDemoToast.timer = window.setTimeout(() => toast.classList.remove("show"), duration);
    }

    function showSearchPopup() {
        let modal = document.getElementById("demoSearchModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "demoSearchModal";
            modal.className = "demo-search-modal";
            modal.innerHTML = `
                <div class="demo-search-card" role="dialog" aria-modal="true" aria-labelledby="demoSearchTitle">
                    <div class="demo-search-icon">Search</div>
                    <h2 id="demoSearchTitle">Branch Search Preview</h2>
                    <p>${SEARCH_MESSAGE}</p>
                    <button id="demoSearchClose" type="button">Got it</button>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener("click", (event) => {
                if (event.target === modal || event.target.id === "demoSearchClose") {
                    modal.classList.remove("show");
                }
            });
        }
        modal.classList.add("show");
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

    function maskEmail(value) {
        return nextValue(maps.email, value, "", (index) => `demo.user${String(index).padStart(3, "0")}@example.com`);
    }

    function maskMac(value) {
        const key = String(value || "").replace(/[^a-fA-F0-9]/g, "").toLowerCase() || String(value || "").trim();
        return nextValue(maps.mac, key, "", (index) => {
            const hex = String(index).padStart(6, "0").slice(-6).match(/.{1,2}/g).join(":");
            return `02:00:00:${hex}`;
        });
    }

    function maskWindow(value) {
        const key = String(value || "").trim().toUpperCase();
        return WINDOW_LABELS[key] || nextValue(maps.window, value, "DEMO-WINDOW-");
    }

    function unmaskWindow(value) {
        const key = String(value || "").trim().toUpperCase();
        const found = Object.keys(WINDOW_LABELS).find((windowName) => WINDOW_LABELS[windowName] === key);
        if (found) return found;
        const numericMatch = key.match(/^DEMO-WINDOW-0*(\d+)$/);
        if (numericMatch) {
            return ["AMANWIZ", "MEDANTA", "SEVAI"][Number(numericMatch[1]) - 1] || value;
        }
        return value;
    }

    function normalizeStoredWindow(item) {
        if (!item || typeof item !== "object") return item;
        return { ...item, window: unmaskWindow(item.window) };
    }

    function normalizeStoredPatchMap(map) {
        return Object.fromEntries(Object.entries(map || {}).map(([key, value]) => [key, normalizeStoredWindow(value)]));
    }


    function maskJc(value) {
        const cleanValue = String(value || "").trim();
        if (cleanValue.toUpperCase() === "OLT/RACK") return cleanValue;
        return nextValue(maps.jc, value, "", (index) => `Demo JC ${String(index).padStart(3, "0")}`);
    }

    function maskPon(value) {
        return nextValue(maps.pon, value, "DEMO-PON-");
    }

    function maskWire(value) {
        return nextValue(maps.wire, value, "", (index) => `Demo Wire ${String(index).padStart(3, "0")}`);
    }

    function shiftCoordinate(value, offset, min, max) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return value;
        const shiftedValue = numberValue + offset;
        if (shiftedValue < min || shiftedValue > max) return value;
        return typeof value === "number" ? shiftedValue : String(shiftedValue);
    }

    function maskByKey(key, value) {
        const normalizedKey = String(key || "").toLowerCase();
        if (value === null || value === undefined || value === "") return value;
        if (typeof value === "object") return value;

        if (normalizedKey === "lat" || normalizedKey === "latitude") {
            return shiftCoordinate(value, LAT_OFFSET, -90, 90);
        }
        if (normalizedKey === "lng" || normalizedKey === "longitude") {
            return shiftCoordinate(value, LNG_OFFSET, -180, 180);
        }
        if (normalizedKey === "window" || normalizedKey === "windowname" || normalizedKey === "window_name") {
            return value;
        }
        if (normalizedKey === "jcname" || normalizedKey === "jc_name" || normalizedKey === "previousjc" || normalizedKey === "jc_previousjc") {
            return maskJc(value);
        }
        if (normalizedKey.includes("pon")) {
            return maskPon(value);
        }
        if (normalizedKey === "drum" || normalizedKey === "wire_drum" || normalizedKey === "wiredrum" || normalizedKey === "otdr" || normalizedKey === "otdrdistance") {
            return maskWire(value);
        }
        if (normalizedKey.includes("remark")) {
            return nextValue(maps.remark, value, "", (index) => `Demo remark ${String(index).padStart(3, "0")}`);
        }
        if (normalizedKey.includes("mac")) {
            return maskMac(value);
        }
        if (normalizedKey.includes("email") || normalizedKey.includes("mail")) {
            return maskEmail(value);
        }
        if (normalizedKey.includes("phone") || normalizedKey.includes("mobile")) {
            return maskPhone(value);
        }
        if (normalizedKey === "user_id" || normalizedKey === "userid" || normalizedKey === "username") {
            return nextValue(maps.user, value, "DEMO-USER-");
        }
        if (normalizedKey === "name" || normalizedKey === "user_name" || normalizedKey === "username_text") {
            return nextValue(maps.name, value, "", (index) => `Demo User ${String(index).padStart(3, "0")}`);
        }
        if (normalizedKey.includes("address")) {
            return nextValue(maps.address, value, "", (index) => `Demo Address ${String(index).padStart(3, "0")}`);
        }
        return value;
    }

    function maskPayload(payload, parentKey = "") {
        if (Array.isArray(payload)) {
            return payload.map((item) => maskPayload(item, parentKey));
        }
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
        return Object.keys(WINDOW_LABELS).reduce((result, key) => {
            return result.replace(new RegExp(key, "gi"), WINDOW_LABELS[key]);
        }, String(text || ""));
    }

    function maskTextNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        nodes.forEach((node) => {
            const maskedText = maskDisplayText(node.nodeValue);
            if (maskedText !== node.nodeValue) {
                node.nodeValue = maskedText;
            }
        });
    }

    function eventHitsElement(event, element) {
        if (!event || !element || typeof element.getBoundingClientRect !== "function") return false;
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left
            && event.clientX <= rect.right
            && event.clientY >= rect.top
            && event.clientY <= rect.bottom;
    }

    function getRequestUrl(input) {
        const rawUrl = input && input.url ? input.url : String(input || "");
        try {
            return new URL(rawUrl, window.location.href);
        } catch (error) {
            return null;
        }
    }

    function translateDemoUrl(input) {
        const url = getRequestUrl(input);
        if (!url) return input;
        const parts = url.pathname.split("/").filter(Boolean);
        if (!parts.length) return input;
        const realWindow = unmaskWindow(parts[0]);
        if (realWindow === parts[0]) return input;
        parts[0] = realWindow;
        url.pathname = `/${parts.join("/")}`;
        return url.toString();
    }

    function readDemoStore() {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(DEMO_STORE_KEY) || "{}");
            return {
                jcs: Array.isArray(parsed.jcs) ? parsed.jcs.map(normalizeStoredWindow) : [],
                deletedJcs: Array.isArray(parsed.deletedJcs) ? parsed.deletedJcs : [],
                updatedJcs: parsed.updatedJcs && typeof parsed.updatedJcs === "object" ? normalizeStoredPatchMap(parsed.updatedJcs) : {},
                wires: Array.isArray(parsed.wires) ? parsed.wires : [],
                deletedWires: Array.isArray(parsed.deletedWires) ? parsed.deletedWires : [],
                updatedWires: parsed.updatedWires && typeof parsed.updatedWires === "object" ? parsed.updatedWires : {},
                cores: Array.isArray(parsed.cores) ? parsed.cores : [],
                deletedCores: Array.isArray(parsed.deletedCores) ? parsed.deletedCores : [],
                updatedCores: parsed.updatedCores && typeof parsed.updatedCores === "object" ? parsed.updatedCores : {}
            };
        } catch (error) {
            return {
                jcs: [],
                deletedJcs: [],
                updatedJcs: {},
                wires: [],
                deletedWires: [],
                updatedWires: {},
                cores: [],
                deletedCores: [],
                updatedCores: {}
            };
        }
    }

    function writeDemoStore(store) {
        window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
    }

    function parseJsonBody(options = {}) {
        try {
            return options.body ? JSON.parse(options.body) : {};
        } catch (error) {
            return {};
        }
    }

    function makeDemoJc(payload, juid) {
        return {
            JUID: juid,
            jcname: payload.jcname || "Demo JC",
            previousjc: payload.previousjc || "OLT/RACK",
            lat: payload.lat,
            lng: payload.lng,
            otdr: payload.otdr || "",
            remark: payload.remark || "",
            window: unmaskWindow(payload.window || ""),
            timestamp: new Date().toISOString(),
            children: []
        };
    }

    function makeDemoJcPatch(payload) {
        return {
            jcname: payload.jcname || "Demo JC",
            previousjc: payload.previousjc || "OLT/RACK",
            lat: payload.lat,
            lng: payload.lng,
            otdr: payload.otdr || "",
            remark: payload.remark || "",
            window: unmaskWindow(payload.window || ""),
            timestamp: new Date().toISOString()
        };
    }

    function makeDemoWire(payload, wuid) {
        return {
            type: "wire",
            WUID: wuid,
            JUID: payload.JUID || payload.juid || "",
            drum: payload.drum || "",
            otdrdistance: payload.otdrdistance || "",
            inout: payload.inout || "input",
            wiretype: payload.wiretype || "12 Core",
            livecores: payload.livecores || 0,
            remark: payload.remark || "",
            children: []
        };
    }

    function makeDemoWirePatch(payload) {
        return {
            drum: payload.drum || "",
            otdrdistance: payload.otdrdistance || "",
            inout: payload.inout || "input",
            wiretype: payload.wiretype || "12 Core",
            livecores: payload.livecores || 0,
            remark: payload.remark || ""
        };
    }

    function makeDemoCore(payload, cuid) {
        return {
            type: "core",
            CUID: cuid,
            WUID: payload.WUID || payload.wuid || "",
            JUID: payload.JUID || payload.juid || "",
            corecolorandnumber: payload.corecolorandnumber || "",
            joint: payload.joint || "",
            tube: payload.tube || "",
            pon_mode: payload.pon_mode || "full",
            oltpon: payload.oltpon || "",
            partialpon: payload.partialpon || "",
            power: payload.power || "",
            remark: payload.remark || ""
        };
    }

    function makeDemoCorePatch(payload) {
        return {
            corecolorandnumber: payload.corecolorandnumber || "",
            joint: payload.joint || "",
            tube: payload.tube || "",
            pon_mode: payload.pon_mode || "full",
            oltpon: payload.oltpon || "",
            partialpon: payload.partialpon || "",
            power: payload.power || "",
            remark: payload.remark || ""
        };
    }

    function removeJcFromNodes(nodes, juid) {
        return (nodes || [])
            .filter((node) => String(node && (node.JUID || node.juid || node.id) || "") !== String(juid))
            .map((node) => ({
                ...node,
                children: removeJcFromNodes(Array.isArray(node && node.children) ? node.children : [], juid)
            }));
    }

    function updateJcInNodes(nodes, juid, patch) {
        return (nodes || []).map((node) => {
            const nodeId = String(node && (node.JUID || node.juid || node.id) || "");
            const nextNode = nodeId === String(juid)
                ? { ...node, ...patch }
                : { ...node };
            if (Array.isArray(node && node.children)) {
                nextNode.children = updateJcInNodes(node.children, juid, patch);
            }
            return nextNode;
        });
    }

    function removeWireFromNodes(nodes, wuid) {
        return (nodes || []).map((node) => {
            const nextNode = { ...node };
            if (Array.isArray(node && node.children)) {
                nextNode.children = removeWireFromNodes(
                    node.children.filter((child) => String(child && (child.WUID || child.wuid || child.id) || "") !== String(wuid)),
                    wuid
                );
            }
            return nextNode;
        });
    }

    function updateWireInNodes(nodes, wuid, patch) {
        return (nodes || []).map((node) => {
            const nodeId = String(node && (node.WUID || node.wuid || node.id) || "");
            const nextNode = nodeId === String(wuid) ? { ...node, ...patch } : { ...node };
            if (Array.isArray(node && node.children)) {
                nextNode.children = updateWireInNodes(node.children, wuid, patch);
            }
            return nextNode;
        });
    }

    function removeCoreFromNodes(nodes, cuid) {
        return (nodes || []).map((node) => {
            const nextNode = { ...node };
            if (Array.isArray(node && node.children)) {
                nextNode.children = removeCoreFromNodes(
                    node.children.filter((child) => String(child && (child.CUID || child.cuid || child.id) || "") !== String(cuid)),
                    cuid
                );
            }
            return nextNode;
        });
    }

    function updateCoreInNodes(nodes, cuid, patch) {
        return (nodes || []).map((node) => {
            const nodeId = String(node && (node.CUID || node.cuid || node.id) || "");
            const nextNode = nodeId === String(cuid) ? { ...node, ...patch } : { ...node };
            if (Array.isArray(node && node.children)) {
                nextNode.children = updateCoreInNodes(node.children, cuid, patch);
            }
            return nextNode;
        });
    }

    function findJcNode(nodes, jcname) {
        for (const node of nodes || []) {
            if (String(node && node.jcname || "") === String(jcname || "")) return node;
            const found = findJcNode(Array.isArray(node && node.children) ? node.children : [], jcname);
            if (found) return found;
        }
        return null;
    }

    function findJcNodeById(nodes, juid) {
        for (const node of nodes || []) {
            if (String(node && (node.JUID || node.juid || node.id) || "") === String(juid)) return node;
            const found = findJcNodeById(Array.isArray(node && node.children) ? node.children : [], juid);
            if (found) return found;
        }
        return null;
    }

    function findWireNodeById(nodes, wuid) {
        for (const node of nodes || []) {
            if (String(node && (node.WUID || node.wuid || node.id) || "") === String(wuid)) return node;
            const found = findWireNodeById(Array.isArray(node && node.children) ? node.children : [], wuid);
            if (found) return found;
        }
        return null;
    }

    function appendDemoJc(nodes, jc) {
        if ((nodes || []).some((node) => String(node && node.JUID || "") === String(jc.JUID))) return;
        const previousJc = String(jc.previousjc || "").trim();
        if (!previousJc || previousJc.toUpperCase() === "OLT/RACK") {
            nodes.push(jc);
            return;
        }
        const parent = findJcNode(nodes, previousJc);
        if (!parent) {
            nodes.push(jc);
            return;
        }
        if (!Array.isArray(parent.children)) parent.children = [];
        parent.children.push(jc);
    }

    function appendDemoWire(nodes, wire) {
        const parent = findJcNodeById(nodes, wire.JUID);
        if (!parent) return;
        if (!Array.isArray(parent.children)) parent.children = [];
        if (parent.children.some((child) => String(child && child.WUID || "") === String(wire.WUID))) return;
        parent.children.push(wire);
    }

    function appendDemoCore(nodes, core) {
        const parent = findWireNodeById(nodes, core.WUID);
        if (!parent) return;
        if (!Array.isArray(parent.children)) parent.children = [];
        if (parent.children.some((child) => String(child && child.CUID || "") === String(core.CUID))) return;
        parent.children.push(core);
    }

    function applyDemoTreeChanges(payload) {
        if (!payload || !Array.isArray(payload.tree)) return payload;
        const store = readDemoStore();
        let tree = payload.tree;
        store.deletedJcs.forEach((juid) => {
            tree = removeJcFromNodes(tree, juid);
        });
        Object.keys(store.updatedJcs).forEach((juid) => {
            tree = updateJcInNodes(tree, juid, store.updatedJcs[juid]);
        });
        store.deletedWires.forEach((wuid) => {
            tree = removeWireFromNodes(tree, wuid);
        });
        Object.keys(store.updatedWires).forEach((wuid) => {
            tree = updateWireInNodes(tree, wuid, store.updatedWires[wuid]);
        });
        store.deletedCores.forEach((cuid) => {
            tree = removeCoreFromNodes(tree, cuid);
        });
        Object.keys(store.updatedCores).forEach((cuid) => {
            tree = updateCoreInNodes(tree, cuid, store.updatedCores[cuid]);
        });
        store.jcs.forEach((jc) => appendDemoJc(tree, { ...jc, children: Array.isArray(jc.children) ? jc.children : [] }));
        store.wires.forEach((wire) => appendDemoWire(tree, { ...wire, children: Array.isArray(wire.children) ? wire.children : [] }));
        store.cores.forEach((core) => appendDemoCore(tree, { ...core }));
        return { ...payload, tree };
    }

    function handleDemoWrite(input, options = {}) {
        const url = getRequestUrl(input);
        const method = String(options.method || input && input.method || "GET").toUpperCase();
        const path = url ? url.pathname : "";
        const payload = parseJsonBody(options);
        const store = readDemoStore();

        if (method === "POST" && /\/jc\/create$/i.test(path)) {
            const juid = `DEMO-JC-${Date.now()}`;
            store.jcs.push(makeDemoJc(payload, juid));
            writeDemoStore(store);
            showDemoToast("Demo JC record saved for walkthrough.");
            return { JUID: juid };
        }

        const jcMatch = path.match(/\/jc\/([^/]+)$/i);
        if (jcMatch && method === "PUT") {
            const juid = decodeURIComponent(jcMatch[1]);
            const patch = makeDemoJcPatch(payload);
            const localIndex = store.jcs.findIndex((jc) => String(jc.JUID) === String(juid));
            if (localIndex >= 0) {
                store.jcs[localIndex] = { ...store.jcs[localIndex], ...patch };
            } else {
                store.updatedJcs[juid] = patch;
            }
            writeDemoStore(store);
            showDemoToast("Demo JC record updated for walkthrough.");
            return { ok: true, demo: true };
        }

        if (jcMatch && method === "DELETE") {
            const juid = decodeURIComponent(jcMatch[1]);
            store.jcs = removeJcFromNodes(store.jcs, juid);
            if (!store.deletedJcs.includes(juid)) store.deletedJcs.push(juid);
            delete store.updatedJcs[juid];
            writeDemoStore(store);
            showDemoToast("Demo JC record removed from this walkthrough.");
            return { ok: true, demo: true };
        }

        if (method === "POST" && /\/wire\/create$/i.test(path)) {
            const wuid = `DEMO-WIRE-${Date.now()}`;
            store.wires.push(makeDemoWire(payload, wuid));
            writeDemoStore(store);
            showDemoToast("Demo wire record saved for walkthrough.");
            return { WUID: wuid };
        }

        const wireMatch = path.match(/\/wire\/([^/]+)$/i);
        if (wireMatch && method === "PUT") {
            const wuid = decodeURIComponent(wireMatch[1]);
            const patch = makeDemoWirePatch(payload);
            const localIndex = store.wires.findIndex((wire) => String(wire.WUID) === String(wuid));
            if (localIndex >= 0) {
                store.wires[localIndex] = { ...store.wires[localIndex], ...patch };
            } else {
                store.updatedWires[wuid] = patch;
            }
            writeDemoStore(store);
            showDemoToast("Demo wire record updated for walkthrough.");
            return { ok: true, demo: true };
        }

        if (wireMatch && method === "DELETE") {
            const wuid = decodeURIComponent(wireMatch[1]);
            store.wires = store.wires.filter((wire) => String(wire.WUID) !== String(wuid));
            store.cores = store.cores.filter((core) => String(core.WUID) !== String(wuid));
            if (!store.deletedWires.includes(wuid)) store.deletedWires.push(wuid);
            delete store.updatedWires[wuid];
            writeDemoStore(store);
            showDemoToast("Demo wire record removed from this walkthrough.");
            return { ok: true, demo: true };
        }

        if (method === "POST" && /\/core\/create$/i.test(path)) {
            const cuid = `DEMO-CORE-${Date.now()}`;
            store.cores.push(makeDemoCore(payload, cuid));
            writeDemoStore(store);
            showDemoToast("Demo core/PON record saved for walkthrough.");
            return { CUID: cuid };
        }

        const coreMatch = path.match(/\/core\/([^/]+)$/i);
        if (coreMatch && method === "PUT") {
            const cuid = decodeURIComponent(coreMatch[1]);
            const patch = makeDemoCorePatch(payload);
            const localIndex = store.cores.findIndex((core) => String(core.CUID) === String(cuid));
            if (localIndex >= 0) {
                store.cores[localIndex] = { ...store.cores[localIndex], ...patch };
            } else {
                store.updatedCores[cuid] = patch;
            }
            writeDemoStore(store);
            showDemoToast("Demo core/PON record updated for walkthrough.");
            return { ok: true, demo: true };
        }

        if (coreMatch && method === "DELETE") {
            const cuid = decodeURIComponent(coreMatch[1]);
            store.cores = store.cores.filter((core) => String(core.CUID) !== String(cuid));
            if (!store.deletedCores.includes(cuid)) store.deletedCores.push(cuid);
            delete store.updatedCores[cuid];
            writeDemoStore(store);
            showDemoToast("Demo core/PON record removed from this walkthrough.");
            return { ok: true, demo: true };
        }

        showDemoToast();
        return {
            demo: true,
            message: DEMO_MESSAGE,
            JUID: `DEMO-JC-${Date.now()}`,
            WUID: `DEMO-WIRE-${Date.now()}`,
            CUID: `DEMO-CORE-${Date.now()}`
        };
    }

    function isWriteRequest(input, options = {}) {
        const method = String(options.method || input && input.method || "GET").toUpperCase();
        return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    }

    window.fetch = async function demoFetch(input, options = {}) {
        if (isWriteRequest(input, options)) {
            return new Response(JSON.stringify(handleDemoWrite(input, options)), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        const response = await originalFetch(translateDemoUrl(input), options);
        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
            return response;
        }

        try {
            const payload = await response.clone().json();
            const maskedPayload = maskPayload(applyDemoTreeChanges(payload));
            const headers = new Headers(response.headers);
            headers.delete("Content-Length");
            headers.delete("Content-Encoding");
            return new Response(JSON.stringify(maskedPayload), {
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
        document.addEventListener("click", (event) => {
            const downloadButton = event.target && event.target.closest ? event.target.closest("#jcDownloadCsvBtn") : null;
            if (!downloadButton) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            showDemoToast(DOWNLOAD_MESSAGE);
        }, true);
        document.addEventListener("pointerdown", (event) => {
            const searchInput = document.getElementById("jcSearchInput");
            const targetSearchInput = event.target && event.target.closest ? event.target.closest("#jcSearchInput") : null;
            if (!targetSearchInput && !eventHitsElement(event, searchInput)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            showSearchPopup();
        }, true);
        document.addEventListener("input", (event) => {
            if (!event.target || event.target.id !== "jcSearchInput") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            event.target.value = "";
            showSearchPopup();
        }, true);
        maskTextNodes(document.body);
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.nodeValue = maskDisplayText(node.nodeValue);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        maskTextNodes(node);
                    }
                });
                if (mutation.type === "characterData") {
                    const maskedText = maskDisplayText(mutation.target.nodeValue);
                    if (maskedText !== mutation.target.nodeValue) {
                        mutation.target.nodeValue = maskedText;
                    }
                }
            });
            setupDemoControls();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        setupDemoControls();
    });

    function setupDemoControls() {
        const searchInput = document.getElementById("jcSearchInput");
        if (searchInput) {
            searchInput.value = "";
            searchInput.readOnly = true;
            searchInput.disabled = true;
            searchInput.classList.add("demo-disabled-control");
            searchInput.setAttribute("aria-disabled", "true");
            searchInput.setAttribute("title", SEARCH_MESSAGE);
            searchInput.placeholder = "Search disabled in demo";
        }

        const downloadButton = document.getElementById("jcDownloadCsvBtn");
        if (downloadButton) {
            downloadButton.classList.add("demo-disabled-control");
            downloadButton.setAttribute("aria-disabled", "true");
            downloadButton.setAttribute("title", DOWNLOAD_MESSAGE);
        }
    }
})();
