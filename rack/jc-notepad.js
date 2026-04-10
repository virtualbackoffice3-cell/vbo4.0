(() => {
    const API_BASE_URL = "https://app2.vbo.co.in";
    const coreOptions = [
        "1,Blue",
        "2,Orange",
        "3,Green",
        "4,Brown",
        "5,Slate",
        "6,White",
        "7,Red",
        "8,Black",
        "9,Yellow",
        "10,Purple",
        "11,Pink",
        "12,Light Blue"
    ];
    const colorOptionsHtml = coreOptions.map((option) => `<option value="${option}">${option}</option>`).join("");

    const state = {
        context: null,
        root: null,
        selectedBox: null,
        selectedFiber: null,
        pendingBoxCreation: null,
        pendingWireCreation: null,
        deleteConfirmArmed: false,
        isLoading: false,
        location: null,
        rows: []
    };

    const elements = {};

    function apiUrlFor(client, endpoint) {
        return `${API_BASE_URL}/${encodeURIComponent(client)}/${endpoint}`;
    }

    function requestJson(url, options) {
        return fetch(url, options).then(async (response) => {
            let payload = {};
            try {
                payload = await response.json();
            } catch (error) {
                payload = {};
            }
            if (!response.ok) {
                throw new Error(payload.detail || payload.message || `HTTP ${response.status}`);
            }
            return payload;
        });
    }

    function getDefaultWireData() {
        return {
            recordId: "",
            wireUuid: "",
            jcName: "",
            side: "",
            wireType: "12 Core",
            otdrDistance: "",
            wireDrum: "",
            liveCores: 1,
            coreDetails: [{ coreColor: "", tube: "", power: "", remark: "" }]
        };
    }

    function getDefaultJcData() {
        return {
            recordId: "",
            jcUuid: "",
            jcName: "",
            otdrDistance: "",
            location: null,
            inputWires: [],
            outputWires: []
        };
    }

    function createShell() {
        elements.mount.innerHTML = `
            <div class="jc-note-root">
                <div class="controls">
                    <button id="jcAddBoxBtn" type="button">Add JC</button>
                    <button id="jcDeleteBoxBtn" type="button">Delete JC</button>
                </div>
                <div class="row" id="jcRow">
                    <div class="olt">OLT</div>
                </div>
                <div class="jc-note-inner-modal" id="jcWireModal">
                    <div class="modal-card">
                        <div class="modal-head">
                            <div>
                                <h2 id="jcModalInnerTitle">Wire Details</h2>
                                <div class="modal-sub" id="jcModalInnerSub"></div>
                            </div>
                            <button class="close-btn" id="jcCloseModalBtn">Close</button>
                        </div>
                        <div class="form-grid">
                            <div class="field full" id="jcNameFieldWrap">
                                <input id="jcNameField" type="text" placeholder="JC Name">
                            </div>
                            <div class="field" id="jcLocationModeWrap">
                                <select id="jcLocationMode">
                                    <option value="auto">Auto Location</option>
                                    <option value="manual">Manual Location</option>
                                </select>
                            </div>
                            <div class="field" id="jcManualLatWrap">
                                <input id="jcManualLat" type="text" placeholder="Latitude">
                            </div>
                            <div class="field" id="jcManualLngWrap">
                                <input id="jcManualLng" type="text" placeholder="Longitude">
                            </div>
                            <div class="field">
                                <select id="jcWireType">
                                    <option value="" disabled selected>Wire Type</option>
                                    <option value="1 Core">1 Core</option>
                                    <option value="2 Core">2 Core</option>
                                    <option value="4 Core">4 Core</option>
                                    <option value="12 Core">12 Core</option>
                                    <option value="24 Core">24 Core</option>
                                    <option value="48 Core">48 Core</option>
                                    <option value="98 Core">98 Core</option>
                                </select>
                            </div>
                            <div class="field" id="jcOtdrFieldWrap">
                                <input id="jcOtdrDistance" type="number" min="0" step="1" placeholder="OTDR Distance (m)">
                            </div>
                            <div class="field full">
                                <input id="jcWireDrum" type="text" placeholder="Wire Drum No / Name">
                            </div>
                            <div class="field">
                                <select id="jcLiveCoresCount"></select>
                                <div class="field-error" id="jcLiveCoreError"></div>
                            </div>
                        </div>
                        <div class="cores-wrap">
                            <div class="cores-title">
                                <h3>Live Core Details</h3>
                            </div>
                            <div class="core-list" id="jcCoreList"></div>
                        </div>
                        <div class="modal-actions">
                            <button class="close-btn danger-btn" id="jcDeleteWireBtn">Delete Wire</button>
                            <button class="close-btn" id="jcCancelModalBtn">Cancel</button>
                            <button class="save-btn" id="jcSaveDummyBtn">Save</button>
                        </div>
                    </div>
                </div>
                <div class="jc-note-inner-modal" id="jcConfirmModal">
                    <div class="modal-card jc-confirm-card">
                        <div class="modal-head">
                            <div>
                                <h2 id="jcConfirmTitle">Confirm</h2>
                                <div class="modal-sub" id="jcConfirmMessage"></div>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button class="close-btn" id="jcConfirmCancelBtn">Cancel</button>
                            <button class="close-btn danger-btn confirm" id="jcConfirmOkBtn">Delete</button>
                        </div>
                    </div>
                </div>
                <div class="jc-note-inner-modal" id="jcCoreModal">
                    <div class="modal-card jc-confirm-card">
                        <div class="modal-head">
                            <div>
                                <h2 id="jcCoreTitle">Core Details</h2>
                                <div class="modal-sub" id="jcCoreMessage"></div>
                            </div>
                            <button class="close-btn" id="jcCoreCloseBtn">Close</button>
                        </div>
                        <div id="jcCoreBody"></div>
                    </div>
                </div>
            </div>
        `;

        state.root = elements.mount.querySelector(".jc-note-root");
        elements.row = state.root.querySelector("#jcRow");
        elements.wireModal = state.root.querySelector("#jcWireModal");
        elements.closeModalBtn = state.root.querySelector("#jcCloseModalBtn");
        elements.cancelModalBtn = state.root.querySelector("#jcCancelModalBtn");
        elements.deleteWireBtn = state.root.querySelector("#jcDeleteWireBtn");
        elements.saveDummyBtn = state.root.querySelector("#jcSaveDummyBtn");
        elements.confirmModal = state.root.querySelector("#jcConfirmModal");
        elements.confirmTitle = state.root.querySelector("#jcConfirmTitle");
        elements.confirmMessage = state.root.querySelector("#jcConfirmMessage");
        elements.confirmCancelBtn = state.root.querySelector("#jcConfirmCancelBtn");
        elements.confirmOkBtn = state.root.querySelector("#jcConfirmOkBtn");
        elements.coreModal = state.root.querySelector("#jcCoreModal");
        elements.coreTitle = state.root.querySelector("#jcCoreTitle");
        elements.coreMessage = state.root.querySelector("#jcCoreMessage");
        elements.coreBody = state.root.querySelector("#jcCoreBody");
        elements.coreCloseBtn = state.root.querySelector("#jcCoreCloseBtn");
        elements.wireTypeSelect = state.root.querySelector("#jcWireType");
        elements.liveCoresCountSelect = state.root.querySelector("#jcLiveCoresCount");
        elements.liveCoreError = state.root.querySelector("#jcLiveCoreError");
        elements.coreList = state.root.querySelector("#jcCoreList");
        elements.modalTitle = state.root.querySelector("#jcModalInnerTitle");
        elements.modalSub = state.root.querySelector("#jcModalInnerSub");
        elements.jcNameField = state.root.querySelector("#jcNameField");
        elements.jcNameFieldWrap = state.root.querySelector("#jcNameFieldWrap");
        elements.locationModeWrap = state.root.querySelector("#jcLocationModeWrap");
        elements.locationMode = state.root.querySelector("#jcLocationMode");
        elements.manualLatWrap = state.root.querySelector("#jcManualLatWrap");
        elements.manualLngWrap = state.root.querySelector("#jcManualLngWrap");
        elements.manualLat = state.root.querySelector("#jcManualLat");
        elements.manualLng = state.root.querySelector("#jcManualLng");
        elements.otdrFieldWrap = state.root.querySelector("#jcOtdrFieldWrap");
        elements.otdrDistance = state.root.querySelector("#jcOtdrDistance");
        elements.wireDrum = state.root.querySelector("#jcWireDrum");
        elements.addBoxBtn = state.root.querySelector("#jcAddBoxBtn");
        elements.deleteBoxBtn = state.root.querySelector("#jcDeleteBoxBtn");
    }

    function setBusy(isBusy) {
        state.isLoading = isBusy;
        if (elements.mount) {
            elements.mount.style.pointerEvents = isBusy ? "none" : "";
            elements.mount.style.opacity = isBusy ? "0.7" : "";
        }
    }

    function showError(error) {
        const message = error instanceof Error ? error.message : String(error || "Request failed");
        window.alert(message);
    }

    function parseCoordinate(value) {
        if (value === null || value === undefined || String(value).trim() === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function buildPonSummary() {
        return Object.assign({}, state.context && state.context.ponSummary ? state.context.ponSummary : {});
    }

    function buildPonUsers() {
        return Array.isArray(state.context && state.context.ponUsers) ? state.context.ponUsers.slice() : [];
    }

    function syncLocationMode() {
        const isManual = elements.locationMode && elements.locationMode.value === "manual";
        if (elements.manualLatWrap) elements.manualLatWrap.classList.toggle("hidden", !isManual);
        if (elements.manualLngWrap) elements.manualLngWrap.classList.toggle("hidden", !isManual);
    }

    function getContainerLocation(container) {
        if (!container) return null;
        try {
            return JSON.parse(container.dataset.location || "null");
        } catch (error) {
            return null;
        }
    }

    function getModalLocation() {
        const isManual = elements.locationMode && elements.locationMode.value === "manual";
        if (isManual) {
            const manualLat = parseCoordinate(elements.manualLat ? elements.manualLat.value : "");
            const manualLng = parseCoordinate(elements.manualLng ? elements.manualLng.value : "");
            return {
                lat: manualLat,
                lng: manualLng,
                accuracy: null,
                timestamp: new Date().toISOString(),
                source: "manual"
            };
        }
        const fetched = state.location;
        if (fetched) {
            return {
                lat: fetched.lat,
                lng: fetched.lng,
                accuracy: fetched.accuracy,
                timestamp: fetched.timestamp,
                source: "fetched"
            };
        }
        return {
            lat: null,
            lng: null,
            accuracy: null,
            timestamp: new Date().toISOString(),
            source: "empty"
        };
    }

    function getActiveLocation(container) {
        const stored = getContainerLocation(container);
        if (stored && stored.lat !== null && stored.lng !== null) {
            return stored;
        }
        return {
            lat: null,
            lng: null,
            accuracy: null,
            timestamp: new Date().toISOString(),
            source: "empty"
        };
    }

    function buildExtraPayload(kind, data, location) {
        return {
            kind,
            context: state.context,
            location,
            data
        };
    }

    function askConfirm(title, message) {
        return new Promise((resolve) => {
            elements.confirmTitle.textContent = title;
            elements.confirmMessage.textContent = message;
            elements.confirmModal.classList.add("show");
            elements.confirmCancelBtn.style.display = "";
            elements.confirmOkBtn.textContent = "Delete";

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            const handleBackdrop = (event) => {
                if (event.target === elements.confirmModal) {
                    handleCancel();
                }
            };

            function cleanup() {
                elements.confirmModal.classList.remove("show");
                elements.confirmCancelBtn.removeEventListener("click", handleCancel);
                elements.confirmOkBtn.removeEventListener("click", handleOk);
                elements.confirmModal.removeEventListener("click", handleBackdrop);
            }

            elements.confirmCancelBtn.addEventListener("click", handleCancel);
            elements.confirmOkBtn.addEventListener("click", handleOk);
            elements.confirmModal.addEventListener("click", handleBackdrop);
        });
    }

    function showNotice(title, message) {
        return new Promise((resolve) => {
            elements.confirmTitle.textContent = title;
            elements.confirmMessage.textContent = message;
            elements.confirmModal.classList.add("show");
            elements.confirmCancelBtn.style.display = "none";
            elements.confirmOkBtn.textContent = "OK";

            const handleOk = () => {
                cleanup();
                resolve();
            };

            const handleBackdrop = (event) => {
                if (event.target === elements.confirmModal) {
                    handleOk();
                }
            };

            function cleanup() {
                elements.confirmModal.classList.remove("show");
                elements.confirmCancelBtn.style.display = "";
                elements.confirmOkBtn.textContent = "Delete";
                elements.confirmOkBtn.removeEventListener("click", handleOk);
                elements.confirmModal.removeEventListener("click", handleBackdrop);
            }

            elements.confirmOkBtn.addEventListener("click", handleOk);
            elements.confirmModal.addEventListener("click", handleBackdrop);
        });
    }

    function closeCoreModal() {
        elements.coreModal.classList.remove("show");
    }

    function showCoreDetails(core, index) {
        elements.coreTitle.textContent = `Live Core ${index}`;
        elements.coreMessage.textContent = "Read-only details";
        elements.coreBody.innerHTML = `
            <div class="core-list">
                <div class="core-card">
                    <div class="core-grid">
                        <div class="field"><input type="text" value="${core.coreColor || ""}" placeholder="Core Color and Number" disabled></div>
                        <div class="field"><input type="text" value="${core.tube || ""}" placeholder="Tube" disabled></div>
                        <div class="field"><input type="text" value="${core.power || ""}" placeholder="Power" disabled></div>
                    </div>
                    <div class="field" style="margin-top:8px;">
                        <input type="text" value="${core.remark || ""}" placeholder="Remark" disabled>
                    </div>
                </div>
            </div>
        `;
        elements.coreModal.classList.add("show");
    }

    function setFormDisabled(isDisabled) {
        state.root.querySelectorAll("#jcWireModal input, #jcWireModal select, #jcWireModal .delete-core").forEach((field) => {
            field.disabled = isDisabled;
        });
    }

    function isFiberReadOnly() {
        if (state.pendingBoxCreation || state.pendingWireCreation || !state.selectedFiber) return false;
        const container = state.selectedFiber.closest(".container");
        return !container || container.dataset.editMode !== "true";
    }

    function setBoxEditMode(container, enabled) {
        if (!container) return;
        container.dataset.editMode = enabled ? "true" : "false";
        const wrapper = container.closest(".jc-wrapper");
        const toggleBtn = wrapper ? wrapper.querySelector(".jc-edit-toggle") : null;
        if (toggleBtn) toggleBtn.textContent = enabled ? "Done" : "Edit";
        container.querySelectorAll(".panel .add").forEach((button) => {
            button.disabled = !enabled;
            button.style.opacity = enabled ? "1" : "0.5";
        });
    }

    function getWireTypeCoreCount() {
        return parseInt(elements.wireTypeSelect.value, 10) || 12;
    }

    function syncLiveCoreLimit() {
        const maxCores = getWireTypeCoreCount();
        const currentValue = Math.min(Number(elements.liveCoresCountSelect.value) || 0, maxCores);
        elements.liveCoresCountSelect.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Live Cores Count";
        placeholder.disabled = true;
        elements.liveCoresCountSelect.appendChild(placeholder);
        for (let i = 0; i <= maxCores; i++) {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = i;
            elements.liveCoresCountSelect.appendChild(opt);
        }
        elements.liveCoresCountSelect.value = String(currentValue);
        elements.liveCoreError.textContent = "";
    }

    function getCurrentCoreDataFromForm() {
        return Array.from(elements.coreList.querySelectorAll(".core-card")).map((card) => {
            const selects = card.querySelectorAll("select");
            return {
                coreColor: selects[0] ? selects[0].value : "",
                tube: selects[1] ? selects[1].value : "",
                power: card.querySelector(".core-power") ? card.querySelector(".core-power").value : "",
                remark: card.querySelector(".core-remark") ? card.querySelector(".core-remark").value : ""
            };
        });
    }

    function buildCoreFields(count, coreData) {
        elements.coreList.innerHTML = "";
        const needsTube = getWireTypeCoreCount() > 12;
        for (let i = 1; i <= count; i++) {
            const currentCore = (coreData && coreData[i - 1]) || {};
            const card = document.createElement("div");
            card.className = "core-card";
            card.innerHTML = `
                <div class="title-row">
                    <h4>Live Core ${i}</h4>
                    <div class="panel-controls">
                        <button type="button" class="delete-core">Delete</button>
                    </div>
                </div>
                <div class="core-grid" style="grid-template-columns:${needsTube ? "repeat(4,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))"};">
                    <div class="field">
                        <select class="core-color">
                            <option value="" disabled selected>Core Color and Number</option>
                            ${colorOptionsHtml}
                        </select>
                    </div>
                    ${needsTube ? `<div class="field"><select class="core-tube"><option value="" disabled selected>Tube</option>${colorOptionsHtml}</select></div>` : ""}
                    <div class="field">
                        <input class="core-power" type="text" placeholder="Power">
                    </div>
                    <div class="field">
                        <input class="core-remark" type="text" placeholder="Remark">
                    </div>
                </div>
            `;
            const colorField = card.querySelector(".core-color");
            const tubeField = card.querySelector(".core-tube");
            const powerField = card.querySelector(".core-power");
            const remarkField = card.querySelector(".core-remark");
            if (currentCore.coreColor) colorField.value = currentCore.coreColor;
            if (tubeField && currentCore.tube) tubeField.value = currentCore.tube;
            if (powerField) powerField.value = currentCore.power || "";
            if (remarkField) remarkField.value = currentCore.remark || "";
            card.querySelector(".delete-core").addEventListener("click", (event) => {
                event.stopPropagation();
                const nextData = getCurrentCoreDataFromForm();
                nextData.splice(i - 1, 1);
                elements.liveCoresCountSelect.value = String(Math.max(Number(elements.liveCoresCountSelect.value) - 1, 0));
                if (state.selectedFiber) {
                    state.selectedFiber.dataset.liveCores = elements.liveCoresCountSelect.value;
                    updateFiberLabel(state.selectedFiber);
                }
                buildCoreFields(Number(elements.liveCoresCountSelect.value), nextData);
            });
            card.addEventListener("click", (event) => {
                if (event.target.closest("input,select,button")) return;
                const currentData = getCurrentCoreDataFromForm()[i - 1] || currentCore || {};
                showCoreDetails(currentData, i);
            });
            elements.coreList.appendChild(card);
        }
    }

    function updateFiberLabel(line) {
        if (!line) return;
        const type = line.dataset.wireType || "12 Core";
        const live = line.dataset.liveCores || "0";
        const label = line.querySelector(".fiber-label");
        if (label) label.textContent = `${type} | Live ${live}`;
    }

    function updateBoxMeta(line, data) {
        if (!line || !data || line.dataset.side !== "input") return;
        const wrapper = line.closest(".jc-wrapper");
        if (!wrapper) return;
        const badges = wrapper.querySelectorAll(".jc-badge");
        if (badges[0]) badges[0].textContent = data.jcName || "JC";
        if (badges[1]) badges[1].textContent = data.otdrDistance ? `OTDR ${data.otdrDistance}` : "OTDR -";
    }

    function applyFiberData(line, data) {
        if (!line || !data) return;
        line.dataset.recordId = data.recordId || "";
        line.dataset.wireUuid = data.wireUuid || "";
        line.dataset.jcName = data.jcName || line.dataset.jcName || "";
        line.dataset.side = data.side || line.dataset.side || "";
        line.dataset.wireType = data.wireType || "12 Core";
        line.dataset.otdrDistance = data.otdrDistance || "";
        line.dataset.wireDrum = data.wireDrum || "";
        line.dataset.liveCores = String(Number(data.liveCores) || 0);
        line.dataset.coreDetails = JSON.stringify(data.coreDetails || []);
        updateFiberLabel(line);
        updateBoxMeta(line, data);
    }

    function readFiberData(line) {
        const fallback = getDefaultWireData();
        if (!line) return fallback;
        let coreDetails = fallback.coreDetails;
        try {
            coreDetails = JSON.parse(line.dataset.coreDetails || "[]");
        } catch (error) {
            coreDetails = fallback.coreDetails;
        }
        return {
            recordId: line.dataset.recordId || "",
            wireUuid: line.dataset.wireUuid || "",
            jcName: line.dataset.jcName || "",
            side: line.dataset.side || "",
            wireType: line.dataset.wireType || fallback.wireType,
            otdrDistance: line.dataset.otdrDistance || "",
            wireDrum: line.dataset.wireDrum || "",
            liveCores: Number(line.dataset.liveCores || fallback.liveCores),
            coreDetails: Array.isArray(coreDetails) ? coreDetails : fallback.coreDetails
        };
    }

    function fillWireModal(data) {
        const safeData = data || getDefaultWireData();
        elements.jcNameField.value = safeData.jcName || "";
        elements.wireTypeSelect.value = safeData.wireType || "12 Core";
        elements.otdrDistance.value = safeData.otdrDistance || "";
        elements.wireDrum.value = safeData.wireDrum || "";
        syncLiveCoreLimit();
        elements.liveCoresCountSelect.value = String(Math.min(Math.max(Number(safeData.liveCores || 0), 0), getWireTypeCoreCount()));
        buildCoreFields(Number(elements.liveCoresCountSelect.value), safeData.coreDetails || []);
    }

    function getWireModalData() {
        return {
            recordId: state.selectedFiber ? (state.selectedFiber.dataset.recordId || "") : "",
            wireUuid: state.selectedFiber ? (state.selectedFiber.dataset.wireUuid || "") : "",
            jcName: elements.jcNameField.value.trim(),
            side: state.selectedFiber ? (state.selectedFiber.dataset.side || "") : "",
            wireType: elements.wireTypeSelect.value || "12 Core",
            otdrDistance: elements.otdrDistance.value.trim(),
            wireDrum: elements.wireDrum.value.trim(),
            liveCores: Number(elements.liveCoresCountSelect.value) || 0,
            location: getModalLocation(),
            coreDetails: getCurrentCoreDataFromForm()
        };
    }

    function validateWireModalData(data, requireLiveCore) {
        if (state.pendingBoxCreation && state.pendingBoxCreation.step === "input" && !data.jcName) {
            alert("Enter JC name first");
            return false;
        }
        if (!elements.wireTypeSelect.value) {
            alert("Select wire type first");
            return false;
        }
        if (requireLiveCore && Number(data.liveCores) < 1) {
            elements.liveCoreError.textContent = "At least 1 live core is required.";
            return false;
        }
        if (state.pendingBoxCreation && state.pendingBoxCreation.step === "input") {
            if (elements.locationMode.value === "manual") {
                if (data.location.lat === null || data.location.lng === null) {
                    alert("Enter valid latitude and longitude");
                    return false;
                }
            } else if (data.location.lat === null || data.location.lng === null) {
                alert("Auto location not available yet");
                return false;
            }
        }
        const needsTube = parseInt(data.wireType, 10) > 12;
        for (let i = 0; i < data.liveCores; i++) {
            const item = data.coreDetails[i] || {};
            if (!item.coreColor) {
                alert(`Select core color/number for Live Core ${i + 1}`);
                return false;
            }
            if (needsTube && !item.tube) {
                alert(`Select tube for Live Core ${i + 1}`);
                return false;
            }
        }
        elements.liveCoreError.textContent = "";
        return true;
    }

    function setModalMode() {
        if (state.pendingBoxCreation && state.pendingBoxCreation.step === "input") {
            elements.modalTitle.textContent = "Input Wire Details";
            elements.modalSub.textContent = "JC tab banega jab minimum input wire with 1 live core save ho.";
            elements.saveDummyBtn.textContent = "Next";
            elements.deleteWireBtn.style.display = "none";
            setFormDisabled(false);
            elements.jcNameFieldWrap.classList.remove("hidden");
            elements.locationModeWrap.classList.remove("hidden");
            elements.otdrFieldWrap.classList.remove("hidden");
            syncLocationMode();
            return;
        }
        if (state.pendingBoxCreation && state.pendingBoxCreation.step === "output") {
            elements.modalTitle.textContent = "Output Wire Details";
            elements.modalSub.textContent = "Minimum output wire with 1 live core save karke JC create hoga.";
            elements.saveDummyBtn.textContent = "Create JC";
            elements.deleteWireBtn.style.display = "none";
            setFormDisabled(false);
            elements.jcNameFieldWrap.classList.add("hidden");
            elements.locationModeWrap.classList.add("hidden");
            elements.manualLatWrap.classList.add("hidden");
            elements.manualLngWrap.classList.add("hidden");
            elements.otdrFieldWrap.classList.add("hidden");
            return;
        }
        if (state.pendingWireCreation) {
            elements.modalTitle.textContent = state.pendingWireCreation.side === "input" ? "Input Wire Details" : "Output Wire Details";
            elements.modalSub.textContent = "Wire tabhi add hogi jab details save hongi.";
            elements.saveDummyBtn.textContent = "Add Wire";
            elements.deleteWireBtn.style.display = "none";
            setFormDisabled(false);
            elements.jcNameFieldWrap.classList.add("hidden");
            elements.locationModeWrap.classList.add("hidden");
            elements.manualLatWrap.classList.add("hidden");
            elements.manualLngWrap.classList.add("hidden");
            elements.otdrFieldWrap.classList.add("hidden");
            return;
        }
        const readOnly = isFiberReadOnly();
        elements.modalTitle.textContent = "Wire Details";
        elements.modalSub.textContent = readOnly ? "Read-only. Click Edit on JC to modify." : "";
        elements.saveDummyBtn.textContent = "Save";
        elements.saveDummyBtn.style.display = readOnly ? "none" : "";
        elements.deleteWireBtn.style.display = readOnly ? "none" : "";
        setFormDisabled(readOnly);
        elements.jcNameFieldWrap.classList.add("hidden");
        elements.locationModeWrap.classList.add("hidden");
        elements.manualLatWrap.classList.add("hidden");
        elements.manualLngWrap.classList.add("hidden");
        elements.otdrFieldWrap.classList.add("hidden");
    }

    function openWireModal(line) {
        if (state.selectedFiber) state.selectedFiber.classList.remove("selected");
        state.selectedFiber = line || null;
        if (state.selectedFiber) state.selectedFiber.classList.add("selected");
        fillWireModal(readFiberData(line));
        setModalMode();
        elements.wireModal.classList.add("show");
    }

    function closeWireModal() {
        elements.wireModal.classList.remove("show");
        state.deleteConfirmArmed = false;
        elements.deleteWireBtn.classList.remove("confirm");
        elements.deleteWireBtn.textContent = "Delete Wire";
        state.pendingBoxCreation = null;
        state.pendingWireCreation = null;
        if (state.selectedFiber) {
            state.selectedFiber.classList.remove("selected");
            state.selectedFiber = null;
        }
    }

    function closeBox(container) {
        container.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("show"));
        container.querySelectorAll(".left,.right").forEach((side) => side.classList.remove("open"));
    }

    function toggle(container, side) {
        const sideEl = container.querySelector("." + side);
        const panel = container.querySelector(".panel-" + side);
        sideEl.classList.toggle("open");
        panel.classList.toggle("show");
    }

    function createFiberLine(data) {
        const line = document.createElement("div");
        line.className = "fiber-line";
        line.innerHTML = '<div class="light"></div><span class="fiber-label"></span>';
        applyFiberData(line, data || getDefaultWireData());
        line.addEventListener("click", (event) => {
            event.stopPropagation();
            openWireModal(line);
        });
        return line;
    }

    function createBox(data) {
        const boxData = Object.assign(getDefaultJcData(), data || {});
        const hasLocation = boxData.location && boxData.location.lat !== null && boxData.location.lng !== null;
        const mapLink = hasLocation ? `https://www.google.com/maps?q=${boxData.location.lat},${boxData.location.lng}` : "";
        const wrapper = document.createElement("div");
        wrapper.className = "jc-wrapper";
        wrapper.innerHTML = `
            ${hasLocation ? `<a class="jc-badge" href="${mapLink}" target="_blank" rel="noopener noreferrer">${boxData.jcName || "JC"}</a>` : `<div class="jc-badge">${boxData.jcName || "JC"}</div>`}
            <div class="jc-link"></div>
            <div class="jc-badge">${boxData.otdrDistance ? `OTDR ${boxData.otdrDistance}` : "OTDR -"}</div>
            <button type="button" class="jc-edit-toggle">Edit</button>
        `;
        const link = wrapper.querySelector(".jc-link");
        const wire = document.createElement("div");
        wire.className = "wire";
        wire.innerHTML = '<div class="flow"></div>';
        const container = document.createElement("div");
        container.className = "container";
        container.dataset.recordId = boxData.recordId || "";
        container.dataset.jcUuid = boxData.jcUuid || "";
        container.dataset.location = JSON.stringify(boxData.location || null);
        container.dataset.editMode = "false";
        container.innerHTML = `
            <div class="box">
                <div class="side left"></div>
                <div class="side right"></div>
            </div>
            <div class="panel panel-left">
                <div class="title-row"><div class="title">INPUT</div><div class="panel-controls"><button class="add" type="button">+</button></div></div>
                <div class="fiber-container"></div>
            </div>
            <div class="panel panel-right">
                <div class="title-row"><div class="title">OUTPUT</div><div class="panel-controls"><button class="add" type="button">+</button></div></div>
                <div class="fiber-container"></div>
            </div>
        `;
        const fiberContainers = container.querySelectorAll(".fiber-container");
        (boxData.inputWires || []).forEach((wireData) => fiberContainers[0].appendChild(createFiberLine(Object.assign({}, wireData, { side: "input", jcName: boxData.jcName, otdrDistance: boxData.otdrDistance }))));
        (boxData.outputWires || []).forEach((wireData) => fiberContainers[1].appendChild(createFiberLine(Object.assign({}, wireData, { side: "output", jcName: boxData.jcName, otdrDistance: boxData.otdrDistance }))));
        container.addEventListener("click", (event) => {
            event.stopPropagation();
            if (state.selectedBox && state.selectedBox !== container) {
                closeBox(state.selectedBox);
                state.selectedBox.classList.remove("active");
                state.selectedBox.closest(".jc-wrapper")?.classList.remove("active-box");
            }
            state.selectedBox = container;
            container.classList.add("active");
            wrapper.classList.add("active-box");
        });
        container.querySelector(".left").onclick = (event) => { event.stopPropagation(); toggle(container, "left"); };
        container.querySelector(".right").onclick = (event) => { event.stopPropagation(); toggle(container, "right"); };
        container.querySelectorAll(".panel").forEach((panel) => {
            panel.onclick = (event) => event.stopPropagation();
            panel.querySelector(".add").onclick = (event) => {
                event.stopPropagation();
                if (container.dataset.editMode !== "true") {
                    showNotice("Read-only", "Click Edit on JC to add wires.");
                    return;
                }
                state.pendingWireCreation = {
                    side: panel.classList.contains("panel-left") ? "input" : "output",
                    container
                };
                openWireModal(null);
            };
        });
        wrapper.querySelector(".jc-edit-toggle").addEventListener("click", (event) => {
            event.stopPropagation();
            setBoxEditMode(container, container.dataset.editMode !== "true");
        });
        setBoxEditMode(container, false);
        link.appendChild(wire);
        link.appendChild(container);
        return wrapper;
    }

    function buildWirePayload(data, jcData, container) {
        return {
            record_id: data.recordId || "",
            wire_uuid: data.wireUuid || "",
            jc_uuid: jcData.jcUuid || "",
            side: data.side || "",
            window_name: state.context.windowName,
            olt_name: state.context.oltName,
            pon_number: state.context.ponNumber,
            jc_name: jcData.jcName || "",
            otdr_distance: data.side === "output" ? (jcData.otdrDistance || data.otdrDistance || "") : (data.otdrDistance || jcData.otdrDistance || ""),
            wire_type: data.wireType || "",
            wire_drum: data.wireDrum || "",
            live_cores_count: Number(data.liveCores) || 0,
            pon_summary: buildPonSummary(),
            pon_users: buildPonUsers(),
            location: jcData.location || getActiveLocation(container),
            extra: buildExtraPayload("wire", {
                recordId: data.recordId || "",
                wireUuid: data.wireUuid || "",
                jcData,
                wire: {
                    side: data.side || "",
                    wireType: data.wireType || "",
                    otdrDistance: data.otdrDistance || "",
                    wireDrum: data.wireDrum || "",
                    liveCores: Number(data.liveCores) || 0,
                    coreDetails: data.coreDetails || []
                }
            }, container),
            cores: (data.coreDetails || []).slice(0, Number(data.liveCores) || 0).map((core) => ({
                core_color_number: core.coreColor || "",
                tube: core.tube || "",
                power: core.power || "",
                remark: core.remark || ""
            }))
        };
    }

    function collectBoxSnapshot(container) {
        const wires = Array.from(container.querySelectorAll(".fiber-line")).map((line) => readFiberData(line));
        const inputPrimary = wires.find((item) => item.side === "input") || getDefaultWireData();
        return {
            recordId: container.dataset.recordId || "",
            jcUuid: container.dataset.jcUuid || "",
            jcName: inputPrimary.jcName || "",
            otdrDistance: inputPrimary.otdrDistance || "",
            location: getActiveLocation(container),
            wires
        };
    }

    function mapWireRecord(item, jcRow) {
        const payload = item && item.payload ? item.payload : {};
        const cores = Array.isArray(payload.cores) ? payload.cores : [];
        return {
            recordId: String(item.id || ""),
            wireUuid: item.wire_uuid || item.record_uuid || "",
            jcName: item.jc_name || (jcRow ? jcRow.jc_name : "") || "",
            side: item.side || "",
            wireType: item.wire_type || "12 Core",
            otdrDistance: item.otdr_distance || (jcRow ? jcRow.otdr_distance : "") || "",
            wireDrum: item.wire_drum || "",
            liveCores: Number(item.live_cores_count || cores.length || 0),
            coreDetails: cores.map((core) => ({
                coreColor: core.core_color_number || "",
                tube: core.tube || "",
                power: core.power || "",
                remark: core.remark || ""
            }))
        };
    }

    async function loadData() {
        if (!state.context) return;
        setBusy(true);
        try {
            const params = new URLSearchParams({
                window_name: state.context.windowName,
                olt_name: state.context.oltName,
                pon_number: state.context.ponNumber
            });
            const jcResponse = await requestJson(apiUrlFor(state.context.client, `jcnotepad/jcs?${params.toString()}`));
            const jcRows = Array.isArray(jcResponse.rows) ? jcResponse.rows : [];
            const wireResponses = await Promise.all(jcRows.map((jcRow) =>
                requestJson(apiUrlFor(state.context.client, `jcnotepad/wires?jc_uuid=${encodeURIComponent(jcRow.jc_uuid || "")}`))
                    .catch(() => ({ rows: [] }))
            ));
            state.rows = jcRows.map((jcRow, index) => {
                const wires = Array.isArray(wireResponses[index].rows) ? wireResponses[index].rows : [];
                const mapped = wires.map((wire) => mapWireRecord(wire, jcRow));
                return {
                    recordId: String(jcRow.id || ""),
                    jcUuid: jcRow.jc_uuid || jcRow.record_uuid || "",
                    jcName: jcRow.jc_name || "",
                    otdrDistance: jcRow.otdr_distance || "",
                    location: jcRow.payload && jcRow.payload.location ? jcRow.payload.location : null,
                    inputWires: mapped.filter((wire) => wire.side === "input"),
                    outputWires: mapped.filter((wire) => wire.side === "output")
                };
            });
            state.rows.sort((left, right) => {
                const leftDistance = Number(left.otdrDistance || 0);
                const rightDistance = Number(right.otdrDistance || 0);
                return leftDistance - rightDistance;
            });
            renderRows();
        } finally {
            setBusy(false);
        }
    }

    function renderRows() {
        state.selectedBox = null;
        state.selectedFiber = null;
        Array.from(elements.row.querySelectorAll(".jc-wrapper")).forEach((item) => item.remove());
        state.rows.forEach((row) => {
            elements.row.appendChild(createBox(row));
        });
    }

    async function saveJcBox(inputData, outputData) {
        const jcData = {
            jcUuid: "",
            jcName: inputData.jcName || "",
            otdrDistance: inputData.otdrDistance || "",
            location: inputData.location || null
        };
        const payload = {
            jc_uuid: "",
            window_name: state.context.windowName,
            olt_name: state.context.oltName,
            pon_number: state.context.ponNumber,
            jc_name: jcData.jcName,
            otdr_distance: jcData.otdrDistance,
            pon_summary: buildPonSummary(),
            pon_users: buildPonUsers(),
            location: jcData.location,
            extra: buildExtraPayload("jc", {
                jc: jcData,
                input: inputData,
                output: outputData
            }, jcData.location),
            wires: [
                buildWirePayload(Object.assign({}, inputData, { side: "input" }), jcData, state.pendingBoxCreation && state.pendingBoxCreation.container ? state.pendingBoxCreation.container : null),
                buildWirePayload(Object.assign({}, outputData, { side: "output" }), jcData, state.pendingBoxCreation && state.pendingBoxCreation.container ? state.pendingBoxCreation.container : null)
            ]
        };
        await requestJson(apiUrlFor(state.context.client, "jcnotepad/jcs/save"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    }

    async function saveWire(container, data) {
        const snapshot = collectBoxSnapshot(container);
        const jcData = {
            jcUuid: snapshot.jcUuid,
            jcName: data.side === "input" ? (data.jcName || snapshot.jcName || "") : (snapshot.jcName || ""),
            otdrDistance: data.side === "input" ? (data.otdrDistance || snapshot.otdrDistance || "") : (snapshot.otdrDistance || "")
        };
        const payload = buildWirePayload(data, jcData, container);
        await requestJson(apiUrlFor(state.context.client, "jcnotepad/wires/save"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    }

    async function deleteSelectedBox() {
        if (!state.selectedBox) {
            await showNotice("Delete JC", "Select a JC first");
            return;
        }
        const recordId = state.selectedBox.dataset.recordId || "";
        if (!recordId) {
            await showNotice("Delete JC", "This JC cannot be deleted right now");
            return;
        }
        const confirmed = await askConfirm("Delete JC", "Delete selected box?");
        if (!confirmed) return;
        setBusy(true);
        try {
            await requestJson(apiUrlFor(state.context.client, "jcnotepad/jcs/delete"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ record_id: recordId })
            });
            await loadData();
        } catch (error) {
            showError(error);
        } finally {
            setBusy(false);
        }
    }

    function requestCurrentLocation() {
        if (!navigator.geolocation) {
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date().toISOString()
                };
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    function bindEvents() {
        elements.addBoxBtn.addEventListener("click", () => {
            state.pendingBoxCreation = { step: "input" };
            if (elements.locationMode) elements.locationMode.value = "auto";
            if (elements.manualLat) elements.manualLat.value = "";
            if (elements.manualLng) elements.manualLng.value = "";
            openWireModal(null);
        });
        elements.deleteBoxBtn.addEventListener("click", deleteSelectedBox);
        elements.locationMode.addEventListener("change", syncLocationMode);
        elements.closeModalBtn.addEventListener("click", closeWireModal);
        elements.cancelModalBtn.addEventListener("click", closeWireModal);
        elements.wireModal.addEventListener("click", (event) => {
            if (event.target === elements.wireModal) closeWireModal();
        });
        elements.coreCloseBtn.addEventListener("click", closeCoreModal);
        elements.coreModal.addEventListener("click", (event) => {
            if (event.target === elements.coreModal) closeCoreModal();
        });
        state.root.querySelector(".olt").addEventListener("click", () => {
            if (!state.selectedBox) return;
            closeBox(state.selectedBox);
            state.selectedBox.classList.remove("active");
            state.selectedBox.closest(".jc-wrapper")?.classList.remove("active-box");
            state.selectedBox = null;
        });
        elements.liveCoresCountSelect.addEventListener("change", () => {
            const coreData = getCurrentCoreDataFromForm();
            syncLiveCoreLimit();
            if (state.selectedFiber) {
                state.selectedFiber.dataset.liveCores = elements.liveCoresCountSelect.value;
                updateFiberLabel(state.selectedFiber);
            }
            buildCoreFields(Number(elements.liveCoresCountSelect.value), coreData);
        });
        elements.wireTypeSelect.addEventListener("change", () => {
            const coreData = getCurrentCoreDataFromForm();
            if (state.selectedFiber) {
                state.selectedFiber.dataset.wireType = elements.wireTypeSelect.value;
                updateFiberLabel(state.selectedFiber);
            }
            syncLiveCoreLimit();
            if (state.selectedFiber) {
                state.selectedFiber.dataset.liveCores = elements.liveCoresCountSelect.value;
                updateFiberLabel(state.selectedFiber);
            }
            buildCoreFields(Number(elements.liveCoresCountSelect.value), coreData);
        });
        elements.saveDummyBtn.addEventListener("click", async () => {
            const data = getWireModalData();
            const requireLiveCore = Boolean(state.pendingBoxCreation);
            if (!validateWireModalData(data, requireLiveCore)) return;
            try {
                setBusy(true);
                if (state.pendingBoxCreation && state.pendingBoxCreation.step === "input") {
                    state.pendingBoxCreation.input = data;
                    state.pendingBoxCreation.step = "output";
                    openWireModal(null);
                    return;
                }
                if (state.pendingBoxCreation && state.pendingBoxCreation.step === "output") {
                    data.jcName = state.pendingBoxCreation.input.jcName;
                    data.otdrDistance = state.pendingBoxCreation.input.otdrDistance;
                    await saveJcBox(state.pendingBoxCreation.input, Object.assign({}, data, { side: "output" }));
                    closeWireModal();
                    await loadData();
                    return;
                }
                if (state.pendingWireCreation) {
                    const side = state.pendingWireCreation.side;
                    const container = state.pendingWireCreation.container;
                    const snapshot = collectBoxSnapshot(container);
                    if (side === "output") {
                        data.jcName = snapshot.jcName || "";
                        data.otdrDistance = snapshot.otdrDistance || "";
                    }
                    data.side = side;
                    await saveWire(container, data);
                    closeWireModal();
                    await loadData();
                    return;
                }
                if (state.selectedFiber) {
                    data.side = state.selectedFiber.dataset.side || "";
                    await saveWire(state.selectedFiber.closest(".container"), data);
                    closeWireModal();
                    await loadData();
                }
            } catch (error) {
                showError(error);
            } finally {
                setBusy(false);
            }
        });
        elements.deleteWireBtn.addEventListener("click", async () => {
            if (!state.selectedFiber) return;
            const recordId = state.selectedFiber.dataset.recordId || "";
            if (!recordId) {
                await showNotice("Delete Wire", "This wire cannot be deleted right now");
                return;
            }
            if (Number(state.selectedFiber.dataset.liveCores || 0) > 0) {
                await showNotice("Delete Wire", "Delete live cores first");
                return;
            }
            if (!state.deleteConfirmArmed) {
                state.deleteConfirmArmed = true;
                elements.deleteWireBtn.classList.add("confirm");
                elements.deleteWireBtn.textContent = "Confirm Delete";
                return;
            }
            try {
                setBusy(true);
                await requestJson(apiUrlFor(state.context.client, "jcnotepad/wires/delete"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ record_id: recordId })
                });
                closeWireModal();
                await loadData();
            } catch (error) {
                showError(error);
            } finally {
                setBusy(false);
            }
        });
    }

    function init() {
        elements.modal = document.getElementById("jcNotepadModal");
        elements.mount = document.getElementById("jcNotepadMount");
        elements.title = document.getElementById("jcModalTitle");
        elements.subtitle = document.getElementById("jcModalSubtitle");
        document.getElementById("btnCloseJcModal")?.addEventListener("click", close);
        elements.modal?.addEventListener("click", (event) => {
            if (event.target === elements.modal) close();
        });
    }

    async function open(context) {
        state.context = {
            client: String(context.client || "").trim(),
            windowName: String(context.windowName || "").trim().toUpperCase(),
            oltName: String(context.oltName || "").trim(),
            ponNumber: String(context.ponNumber || "").trim(),
            ponSummary: context.ponSummary || {},
            ponUsers: Array.isArray(context.ponUsers) ? context.ponUsers : []
        };
        elements.title.textContent = "JC Notepad";
        elements.subtitle.textContent = `${state.context.oltName} | PON ${state.context.ponNumber} | ${state.context.windowName}`;
        elements.modal.style.display = "flex";
        createShell();
        bindEvents();
        syncLiveCoreLimit();
        requestCurrentLocation();
        try {
            await loadData();
        } catch (error) {
            showError(error);
        }
    }

    function close() {
        elements.modal.style.display = "none";
        elements.mount.innerHTML = "";
        state.context = null;
        state.root = null;
        state.selectedBox = null;
        state.selectedFiber = null;
        state.pendingBoxCreation = null;
        state.pendingWireCreation = null;
        state.deleteConfirmArmed = false;
        state.isLoading = false;
        state.location = null;
        state.rows = [];
    }

    document.addEventListener("DOMContentLoaded", init);
    window.jcNotepad = {
        open,
        close,
        isOpen: () => elements.modal && elements.modal.style.display === "flex"
    };
})();
