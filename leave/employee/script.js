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

// Month names for display
const MONTH_NAMES = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
};

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
    
    // Stats elements (DAYS COUNT)
    totalDaysCount: document.getElementById('totalDaysCount'),
    approvedDays: document.getElementById('approvedDays'),
    pendingDays: document.getElementById('pendingDays'),
    rejectedDays: document.getElementById('rejectedDays'),
    totalDaysAll: document.getElementById('totalDaysAll'),
    monthTotalDays: document.getElementById('monthTotalDays'),
    
    // Filter elements
    monthSelector: document.getElementById('monthSelector'),
    yearSelector: document.getElementById('yearSelector'),
    
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
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return mm;
    } catch {
        return '';
    }
}

// ========== GET YEAR FROM DATE ==========
function getYearFromDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.getFullYear().toString();
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

// ========== UPDATE FILTER DROPDOWNS ==========
function updateFilterDropdowns() {
    // Get unique months and years from leaves
    const monthSet = new Set();
    const yearSet = new Set();
    
    allLeaves.forEach(leave => {
        const month = getMonthFromDate(leave.from_date);
        const year = getYearFromDate(leave.from_date);
        if (month) monthSet.add(month);
        if (year) yearSet.add(year);
    });
    
    // Sort months (01 to 12)
    const months = Array.from(monthSet).sort();
    
    // Sort years (descending - newest first)
    const years = Array.from(yearSet).sort((a, b) => b - a);
    
    // Update month dropdown
    let monthOptions = '<option value="">All Months</option>';
    months.forEach(month => {
        monthOptions += `<option value="${month}">${MONTH_NAMES[month] || month}</option>`;
    });
    elements.monthSelector.innerHTML = monthOptions;
    
    // Update year dropdown
    let yearOptions = '<option value="">All Years</option>';
    years.forEach(year => {
        yearOptions += `<option value="${year}">${year}</option>`;
    });
    elements.yearSelector.innerHTML = yearOptions;
    
    // If there are months and years, select the most recent one
    if (months.length > 0 && years.length > 0) {
        // Select most recent year
        elements.yearSelector.value = years[0];
        
        // For that year, find months that exist
        const monthsInSelectedYear = allLeaves
            .filter(leave => getYearFromDate(leave.from_date) === years[0])
            .map(leave => getMonthFromDate(leave.from_date));
        
        if (monthsInSelectedYear.length > 0) {
            // Sort months and select the most recent one
            const latestMonth = monthsInSelectedYear.sort().pop();
            elements.monthSelector.value = latestMonth;
        }
    }
}

// ========== FILTER LEAVES BY MONTH & YEAR ==========
function getFilteredLeaves() {
    const selectedMonth = elements.monthSelector.value;
    const selectedYear = elements.yearSelector.value;
    
    return allLeaves.filter(leave => {
        const leaveMonth = getMonthFromDate(leave.from_date);
        const leaveYear = getYearFromDate(leave.from_date);
        
        if (selectedMonth && selectedYear) {
            return leaveMonth === selectedMonth && leaveYear === selectedYear;
        } else if (selectedMonth) {
            return leaveMonth === selectedMonth;
        } else if (selectedYear) {
            return leaveYear === selectedYear;
        } else {
            return true; // Show all if no filter selected
        }
    });
}

// ========== UPDATE STATS WITH DAYS COUNT ==========
function updateStats() {
    const filteredLeaves = getFilteredLeaves();
    
    // Calculate days by status
    let totalDays = 0;
    let approvedDays = 0;
    let pendingDays = 0;
    let rejectedDays = 0;
    
    filteredLeaves.forEach(leave => {
        const days = calculateLeaveDays(leave.from_date, leave.to_date);
        totalDays += days;
        
        switch(leave.status?.toLowerCase()) {
            case 'approved':
                approvedDays += days;
                break;
            case 'pending':
                pendingDays += days;
                break;
            case 'rejected':
                rejectedDays += days;
                break;
        }
    });
    
    // Update stats display
    elements.totalDaysCount.textContent = totalDays;
    elements.approvedDays.textContent = approvedDays;
    elements.pendingDays.textContent = pendingDays;
    elements.rejectedDays.textContent = rejectedDays;
    elements.monthTotalDays.textContent = totalDays;
    
    // Calculate total days all time
    const allTimeDays = allLeaves.reduce((sum, leave) => {
        return sum + calculateLeaveDays(leave.from_date, leave.to_date);
    }, 0);
    elements.totalDaysAll.textContent = allTimeDays;
}

// ========== RENDER TABLE ==========
function renderLeavesTable() {
    const filteredLeaves = getFilteredLeaves();
    
    if (!filteredLeaves || filteredLeaves.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <span>📋</span>
                    <p>No leaves for selected period</p>
                </td>
            </tr>
        `;
        updateStats();
        return;
    }
    
    // Sort by date (newest first)
    filteredLeaves.sort((a, b) => new Date(b.from_date) - new Date(a.from_date));
    
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
    updateStats();
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
        updateFilterDropdowns();
        renderLeavesTable();
        
    } catch (error) {
        console.error('Load error:', error);
        
        // Demo data with multiple months
        allLeaves = [
            // March 2024
            { id: 1, from_date: '2024-03-15', to_date: '2024-03-16', status: 'approved' },
            { id: 2, from_date: '2024-03-18', to_date: '2024-03-20', status: 'pending' },
            { id: 3, from_date: '2024-03-10', to_date: '2024-03-13', status: 'approved' },
            { id: 8, from_date: '2024-03-25', to_date: '2024-03-26', status: 'pending' },
            { id: 9, from_date: '2024-03-05', to_date: '2024-03-07', status: 'approved' },
            
            // February 2024
            { id: 4, from_date: '2024-02-05', to_date: '2024-02-06', status: 'rejected' },
            { id: 5, from_date: '2024-02-15', to_date: '2024-02-17', status: 'approved' },
            { id: 10, from_date: '2024-02-20', to_date: '2024-02-22', status: 'pending' },
            
            // January 2024
            { id: 7, from_date: '2024-01-10', to_date: '2024-01-12', status: 'approved' },
            { id: 11, from_date: '2024-01-15', to_date: '2024-01-16', status: 'rejected' },
            
            // December 2023
            { id: 12, from_date: '2023-12-10', to_date: '2023-12-12', status: 'approved' },
            { id: 13, from_date: '2023-12-20', to_date: '2023-12-22', status: 'pending' }
        ];
        
        updateFilterDropdowns();
        renderLeavesTable();
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
        updateFilterDropdowns();
        renderLeavesTable();
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

// Filter change events
elements.monthSelector.addEventListener('change', renderLeavesTable);
elements.yearSelector.addEventListener('change', renderLeavesTable);

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
