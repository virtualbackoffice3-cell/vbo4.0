// ========== CONFIGURATION ==========
const CONFIG = {
    API_BASE: "https://app.vbo.co.in",
    employee_id: "EMP0001",
    employee_name: "Test Employee",
    employee_email: "shahzebinfo2@gmail.com",
    manager_emails: ["manager@gmail.com"],
    owner_emails: ["owner@gmail.com"]
};

// ========== STATE ==========
let isSubmitting = false;
let isLoading = false;
let leaveData = [];

// ========== DOM ELEMENTS ==========
const elements = {
    fromDate: document.getElementById('from_date'),
    toDate: document.getElementById('to_date'),
    reason: document.getElementById('reason'),
    handover: document.getElementById('handover'),
    applyBtn: document.getElementById('applyBtn'),
    charCount: document.getElementById('charCount'),
    tableBody: document.getElementById('leaveTableBody'),
    totalLeaves: document.getElementById('totalLeaves'),
    approvedLeaves: document.getElementById('approvedLeaves'),
    pendingLeaves: document.getElementById('pendingLeaves'),
    leaveCount: document.getElementById('leaveCount'),
    toast: document.getElementById('toast'),
    loading: document.getElementById('loading'),
    empBadge: document.getElementById('empBadge'),
    refreshBtn: document.getElementById('refreshBtn'),
    clearBtn: document.getElementById('clearBtn'),
    topBtn: document.getElementById('topBtn')
};

// ========== SET PAST DATES DISABLED ==========
function setMinDates() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDate = `${yyyy}-${mm}-${dd}`;
    
    elements.fromDate.min = minDate;
    elements.toDate.min = minDate;
    
    // Update tomorrow's min for to_date when from_date changes
    elements.fromDate.addEventListener('change', function() {
        if (this.value) {
            elements.toDate.min = this.value;
        } else {
            elements.toDate.min = minDate;
        }
    });
}

// ========== TOAST ==========
function showToast(msg, type = 'success') {
    elements.toast.textContent = msg;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 2000);
}

// ========== LOADING ==========
function setLoading(show) {
    if (show) {
        elements.loading.classList.add('show');
    } else {
        elements.loading.classList.remove('show');
    }
}

// ========== FORMAT DATE ==========
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

// ========== GET STATUS BADGE ==========
function getStatusBadge(status) {
    status = (status || 'pending').toLowerCase();
    const icons = { approved: '✅', rejected: '❌', pending: '⏳' };
    return `<span class="status-badge ${status}">${icons[status] || '📝'} ${status}</span>`;
}

// ========== RENDER TABLE ==========
function renderLeavesTable() {
    if (!leaveData || leaveData.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <span>📋</span>
                    <p>No leaves</p>
                </td>
            </tr>
        `;
        updateStats();
        return;
    }
    
    let html = '';
    leaveData.forEach((leave, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${formatDate(leave.from_date)}</td>
                <td>${formatDate(leave.to_date)}</td>
                <td>${getStatusBadge(leave.status)}</td>
            </tr>
        `;
    });
    
    elements.tableBody.innerHTML = html;
    updateStats();
}

// ========== UPDATE STATS ==========
function updateStats() {
    const total = leaveData.length;
    const approved = leaveData.filter(l => l.status?.toLowerCase() === 'approved').length;
    const pending = leaveData.filter(l => l.status?.toLowerCase() === 'pending').length;
    
    elements.totalLeaves.textContent = total;
    elements.approvedLeaves.textContent = approved;
    elements.pendingLeaves.textContent = pending;
    elements.leaveCount.textContent = total;
}

// ========== LOAD LEAVES FROM API ==========
async function loadLeaves() {
    if (isLoading) return;
    
    isLoading = true;
    setLoading(true);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/amanwiz/leave/my?employee_id=${CONFIG.employee_id}`);
        const data = await response.json();
        
        leaveData = data.data || [];
        renderLeavesTable();
        
    } catch (error) {
        console.error('Load error:', error);
        showToast('Failed to load', 'error');
        
        // Demo data if API fails
        leaveData = [
            { id: 1, from_date: '2024-03-15', to_date: '2024-03-16', status: 'approved' },
            { id: 2, from_date: '2024-03-20', to_date: '2024-03-22', status: 'pending' }
        ];
        renderLeavesTable();
    } finally {
        isLoading = false;
        setLoading(false);
    }
}

// ========== APPLY LEAVE ==========
async function applyLeave() {
    if (isSubmitting) return;
    if (!validateForm()) return;
    
    isSubmitting = true;
    elements.applyBtn.disabled = true;
    elements.applyBtn.innerHTML = '<span class="btn-spinner"></span> Applying...';
    
    const payload = {
        employee_id: CONFIG.employee_id,
        employee_name: CONFIG.employee_name,
        employee_email: CONFIG.employee_email,
        from_date: elements.fromDate.value,
        to_date: elements.toDate.value,
        reason: elements.reason.value.trim(),
        handover_to: elements.handover.value.trim(),
        manager_emails: CONFIG.manager_emails,
        owner_emails: CONFIG.owner_emails
    };
    
    try {
        const response = await fetch(CONFIG.API_BASE + "/amanwiz/leave/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Applied!', 'success');
            clearForm();
            loadLeaves();
        } else {
            showToast(data.message || 'Failed', 'error');
        }
        
    } catch (error) {
        showToast('Error', 'error');
        
        // Demo success if API fails
        const newLeave = {
            id: Date.now(),
            from_date: elements.fromDate.value,
            to_date: elements.toDate.value,
            status: 'pending'
        };
        leaveData.unshift(newLeave);
        renderLeavesTable();
        clearForm();
        showToast('Applied! (Demo)', 'success');
        
    } finally {
        elements.applyBtn.disabled = false;
        elements.applyBtn.innerHTML = '<span>Apply</span><span class="btn-icon">→</span>';
        isSubmitting = false;
    }
}

// ========== VALIDATE FORM ==========
function validateForm() {
    const fromDate = elements.fromDate.value;
    const toDate = elements.toDate.value;
    const reason = elements.reason.value.trim();
    const handover = elements.handover.value.trim();
    
    if (!fromDate || !toDate || !reason || !handover) {
        showToast('Fill all fields', 'error');
        return false;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (from < today) {
        showToast('Past date not allowed', 'error');
        return false;
    }
    
    if (to < from) {
        showToast('To date after from date', 'error');
        return false;
    }
    
    if (reason.length < 10) {
        showToast('Min 10 characters', 'error');
        return false;
    }
    
    return true;
}

// ========== CLEAR FORM ==========
function clearForm() {
    elements.fromDate.value = '';
    elements.toDate.value = '';
    elements.reason.value = '';
    elements.handover.value = '';
    elements.charCount.textContent = '0';
    showToast('Cleared', 'success');
}

// ========== EVENT LISTENERS ==========

// Character counter
elements.reason.addEventListener('input', function() {
    elements.charCount.textContent = this.value.length;
});

// Set min dates
setMinDates();

// Button listeners
elements.applyBtn.addEventListener('click', applyLeave);
elements.refreshBtn.addEventListener('click', loadLeaves);
elements.clearBtn.addEventListener('click', clearForm);
elements.topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Update badge
elements.empBadge.textContent = CONFIG.employee_id;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLeaves();
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        applyLeave();
    }
    if (e.key === 'Escape') {
        clearForm();
    }
});
