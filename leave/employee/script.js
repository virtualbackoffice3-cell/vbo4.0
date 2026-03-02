// ================= CONFIG =================
const CONFIG = {
    API_BASE: "https://app.vbo.co.in",
    employee_id: "EMP0001",
    employee_name: "Test employee",
    employee_email: "shahzebinfo2@gmail.com",
    manager_emails: ["manager@gmail.com"],
    owner_emails: ["owner@gmail.com"]
};

// ================= TOAST FUNCTION =================
function showToast(msg) {
    let t = document.createElement("div");
    t.className = "toast";
    t.innerText = msg;
    document.body.appendChild(t);

    setTimeout(() => t.classList.add("show"), 100);
    setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

// ================= APPLY LEAVE =================
let isSubmitting = false;

async function applyLeave() {
    if (isSubmitting) return;

    // Validation
    const fromDate = document.getElementById("from_date").value;
    const toDate = document.getElementById("to_date").value;
    const reason = document.getElementById("reason").value;
    const handover = document.getElementById("handover").value;

    if (!fromDate || !toDate || !reason || !handover) {
        showToast("Please fill all fields ❌");
        return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
        showToast("To date must be after from date ❌");
        return;
    }

    isSubmitting = true;
    const btn = document.querySelector("button");
    btn.disabled = true;
    btn.innerText = "Submitting...";

    const payload = {
        employee_id: CONFIG.employee_id,
        employee_name: CONFIG.employee_name,
        employee_email: CONFIG.employee_email,
        from_date: fromDate,
        to_date: toDate,
        reason: reason,
        handover_to: handover,
        manager_emails: CONFIG.manager_emails,
        owner_emails: CONFIG.owner_emails
    };

    try {
        const res = await fetch(CONFIG.API_BASE + "/amanwiz/leave/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message || "Leave Applied ✅");
            // Clear form
            document.getElementById("from_date").value = "";
            document.getElementById("to_date").value = "";
            document.getElementById("reason").value = "";
            document.getElementById("handover").value = "";
        } else {
            showToast(data.message || "Error ❌");
        }
        
        loadLeaves();

    } catch (err) {
        showToast("Network Error ❌");
        console.error("Error:", err);
    } finally {
        btn.disabled = false;
        btn.innerText = "Apply";
        isSubmitting = false;
    }
}

// ================= LOAD LEAVES =================
async function loadLeaves() {
    try {
        const res = await fetch(`${CONFIG.API_BASE}/amanwiz/leave/my?employee_id=${CONFIG.employee_id}`);
        const data = await res.json();

        const tbody = document.querySelector("#leaveTable tbody");
        tbody.innerHTML = "";

        if (data.data && data.data.length > 0) {
            (data.data || []).forEach(row => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${row.id || '-'}</td>
                    <td>${row.from_date || '-'}</td>
                    <td>${row.to_date || '-'}</td>
                    <td class="status ${(row.status || '').toLowerCase()}">${row.status || 'Pending'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="4" style="text-align: center;">No leaves found</td>`;
            tbody.appendChild(tr);
        }

    } catch (err) {
        console.error("Error loading leaves:", err);
        showToast("Failed to load leaves ❌");
    }
}

// ================= INIT =================
// Load leaves when page loads
document.addEventListener("DOMContentLoaded", function() {
    loadLeaves();
});
