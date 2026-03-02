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
let allLeaves = []; // Store all leaves
let filteredLeaves = []; // Store filtered leaves

// ========== DOM ELEMENTS ==========
const elements = {
    fromDate: document.getElementById('from_date'),
    toDate: document.getElementById('to_date'),
    reason: document.getElementById('reason'),
    handover: document.getElementById('handover'),
    applyBtn: document.getElementById('applyBtn'),
    charCount: document.getElementById('charCount'),
    totalDays: document.getElementById('totalDays'),
    tableBody: document.getElementById('leaveTableBody'),
    totalLeaves: document.getElementById('totalLeaves'),
    approvedLeaves: document.getElementById('approvedLeaves'),
    pendingLeaves: document.getElementById('pendingLeaves'),
    rejectedLeaves: document.getElementById('rejectedLeaves'),
    leaveCount: document.getElementById('leaveCount'),
    monthTotalDays: document.getElementById('monthTotalDays'),
    monthFilter: document.getElementById('monthFilter'),
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
    
    elements.fromDate.addEventListener('change', function() {
        if (this.value) {
            elements.toDate.min = this.value;
            calculateDays();
        } else {
            elements.toDate.min = minDate;
        }
    });
    
    elements.toDate.addEventListener('change', calculateDays);
}

// ========== CALCULATE DAYS ==========
function calculateDays() {
    const fromDate = elements.fromDate.value;
    const toDate = elements.toDate.value;
    
    if (!fromDate || !toDate) {
        elements.totalDays.textContent = '0';
        return;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (to < from) {
        elements.totalDays.textContent = '0';
        return;
    }
    
    const diffTime = to - from;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    elements.totalDays.textContent = diffDays;
}

// ========== FORMAT DATE (Mar 15) ==========
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short',
            day: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

// ========== GET MONTH FROM DATE ==========
function getMonthFromDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    } catch {
        return '';
    }
}

// ========== CALCULATE LEAVE DAYS ==========
function calculateLeaveDays(fromDate, toDate) {
    if (!fromDate || !toDate) return 0;
    try {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        const diffTime = to - from;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } catch {
        return 0;
    }
}

// ========== GET STATUS BADGE ==========
function getStatusBadge(status) {
    status = (status || 'pending').toLowerCase();
    const icons = { approved: '✅', rejected: '❌', pending: '⏳' };
    return `<span class="status-badge ${status}">${icons[status] || '📝'} ${status}</span>`;
}

// ========== FILTER LEAVES BY MONTH ==========
function filterLeavesByMonth() {
    const selectedMonth = elements.monthFilter.value;
    
    if (!selectedMonth) {
        filteredLeaves = [...allLeaves];
    } else {
        filteredLeaves = allLeaves.filter(leave => {
            const leaveMonth = getMonthFromDate(leave.from_date);
            return leaveMonth === selectedMonth;
        });
    }
    
    renderLeavesTable();
    updateStats();
    updateMonthTotalDays();
}

// ========== UPDATE MONTH TOTAL DAYS ==========
function updateMonthTotalDays() {
    const totalDays = filteredLeaves.reduce((sum, leave) => {
        return sum + calculateLeaveDays(leave.from_date, leave.to_date);
    }, 0);
    
    elements.monthTotalDays.textContent = `${totalDays} days`;
}

// ========== RENDER TABLE ==========
function renderLeavesTable() {
    if (!filteredLeaves || filteredLeaves.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <span>📋</span>
                    <p>No leaves for this month</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    filteredLeaves.forEach((leave, index) => {
        const days = calculateLeaveDays(leave.from_date, leave.to_date);
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${formatDate(leave.from_date)}</td>
                <td>${formatDate(leave.to_date)}</td>
                <td><span class="days-badge">${days}</span></td>
                <td>${getStatusBadge(leave.status)}</td>
            </tr>
        `;
    });
    
    elements.tableBody.innerHTML = html;
}

// ========== UPDATE STATS ==========
function updateStats() {
    const total = filteredLeaves.length;
    const approved = filteredLeaves.filter(l => l.status?.toLowerCase() === 'approved').length;
    const pending = filteredLeaves.filter(l => l.status?.toLowerCase() === 'pending').length;
    const rejected = filteredLeaves.filter(l => l.status?.toLowerCase() === 'rejected').length;
    
    elements.totalLeaves.textContent = total;
    elements.approvedLeaves.textContent = approved;
    elements.pendingLeaves.textContent = pending;
    elements.rejectedLeaves.textContent = rejected;
    elements.leaveCount.textContent = allLeaves.length; // Show total in badge
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

// ========== LOAD LEAVES FROM API ==========
async function loadLeaves() {
    if (isLoading) return;
    
    isLoading = true;
    setLoading(true);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/amanwiz/leave/my?employee_id=${CONFIG.employee_id}`);
        const data = await response.json();
        
        allLeaves = data.data || [];
        
        // Set current month as default (March 2024)
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        elements.monthFilter.value = currentMonth;
        
        filterLeavesByMonth();
        
    } catch (error) {
        console.error('Load error:', error);
        
        // Demo data with rejected leaves
        allLeaves = [
            { id: 1, from_date: '2024-03-15', to_date: '2024-03-16', status: 'approved' },
            { id: 2, from_date: '2024-03-18', to_date: '2024-03-20', status: 'pending' },
            { id: 3, from_date: '2024-03-10', to_date: '2024-03-13', status: 'approved' },
            { id: 4, from_date: '2024-02-05', to_date: '2024-02-06', status: 'rejected' },
            { id: 5, from_date: '2024-02-15', to_date: '2024-02-17', status: 'approved' },
            { id: 6, from_date: '2024-03-22', to_date: '2024-03-23', status: 'rejected' },
            { id: 7, from_date: '2024-01-10', to_date: '2024-01-12', status: 'approved' }
        ];
        
        // Set current month as default
        elements.monthFilter.value = '2024-03';
        filterLeavesByMonth();
        showToast('Demo data loaded', 'success');
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
            showToast(`Applied for ${elements.totalDays.textContent} days!`, 'success');
            clearForm();
            loadLeaves();
        } else {
            showToast(data.message || 'Failed', 'error');
        }
        
    } catch (error) {
        // Demo success if API fails
        const newLeave = {
            id: Date.now(),
            from_date: elements.fromDate.value,
            to_date: elements.toDate.value,
            status: 'pending'
        };
        allLeaves.unshift(newLeave);
        filterLeavesByMonth();
        clearForm();
        showToast(`Applied for ${elements.totalDays.textContent} days! (Demo)`, 'success');
        
    } finally {
        elements.applyBtn.disabled = false;
        elements.applyBtn.innerHTML = '<span>Apply Leave</span><span class="btn-icon">→</span>';
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
    elements.totalDays.textContent = '0';
    showToast('Form cleared', 'success');
}

// ========== EVENT LISTENERS ==========

// Character counter
elements.reason.addEventListener('input', function() {
    elements.charCount.textContent = this.value.length;
});

// Set min dates
setMinDates();

// Month filter change
elements.monthFilter.addEventListener('change', filterLeavesByMonth);

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
