// ========== CONFIGURATION ==========
const CONFIG = {
    API_BASE: "https://app.vbo.co.in",
    manager_name: "Manager",
    manager_email: "manager@gmail.com",
    owner_emails: ["owner@gmail.com"]
};

// ========== STATE ==========
let isLoading = false;
let isProcessing = false;
let allLeaves = [];

// Filter state
let filters = {
    employee: '',
    month: '',
    year: '',
    status: 'pending' // Default pending
};

// Month names
const MONTH_NAMES = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
};

// ========== DOM ELEMENTS ==========
const elements = {
    // Stats
    totalLeaves: document.getElementById('totalLeaves'),
    totalApproved: document.getElementById('totalApproved'),
    totalPending: document.getElementById('totalPending'),
    totalRejected: document.getElementById('totalRejected'),
    filteredCount: document.getElementById('filteredCount'),
    
    // Filters
    employeeFilter: document.getElementById('employeeFilter'),
    monthFilter: document.getElementById('monthFilter'),
    yearFilter: document.getElementById('yearFilter'),
    statusFilter: document.getElementById('statusFilter'),
    activeFilters: document.getElementById('activeFilters'),
    filterSummary: document.getElementById('filterSummary'),
    clearFiltersBtn: document.getElementById('clearFilters'),
    
    // Table
    tableBody: document.getElementById('leaveTableBody'),
    
    // Other
    toast: document.getElementById('toast'),
    loading: document.getElementById('loading'),
    refreshBtn: document.getElementById('refreshBtn'),
    pendingBtn: document.getElementById('pendingBtn'),
    topBtn: document.getElementById('topBtn'),
    managerBadge: document.getElementById('managerBadge')
};

// ========== UTILITY FUNCTIONS ==========

// Show Toast
function showToast(msg, type = 'success') {
    elements.toast.textContent = msg;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 2000);
}

// Show/Hide Loading
function setLoading(show) {
    if (show) {
        elements.loading.classList.add('show');
    } else {
        elements.loading.classList.remove('show');
    }
}

// Format Date (Mar 15)
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

// Calculate Days
function calculateDays(fromDate, toDate) {
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

// Get Month from Date
function getMonthFromDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return String(date.getMonth() + 1).padStart(2, '0');
    } catch {
        return '';
    }
}

// Get Year from Date
function getYearFromDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.getFullYear().toString();
    } catch {
        return '';
    }
}

// Get Status Badge
function getStatusBadge(status) {
    status = (status || 'pending').toLowerCase();
    const icons = { approved: '✅', rejected: '❌', pending: '⏳' };
    return `<span class="status-badge ${status}">${icons[status] || '📝'} ${status}</span>`;
}

// ========== FILTER FUNCTIONS ==========

// Update Filter Dropdowns (Dynamic - only from entries)
function updateFilterDropdowns() {
    // Get unique employees
    const employeeMap = new Map(); // Store employee name by ID
    
    allLeaves.forEach(leave => {
        if (leave.employee_id && !employeeMap.has(leave.employee_id)) {
            employeeMap.set(leave.employee_id, leave.employee_name || leave.employee_id);
        }
    });
    
    // Update employee dropdown
    let empOptions = '<option value="">All Employees</option>';
    Array.from(employeeMap.entries()).sort().forEach(([id, name]) => {
        empOptions += `<option value="${id}">${name}</option>`;
    });
    elements.employeeFilter.innerHTML = empOptions;
    
    // Get unique months and years from entries
    const monthSet = new Set();
    const yearSet = new Set();
    
    allLeaves.forEach(leave => {
        const month = getMonthFromDate(leave.from_date);
        const year = getYearFromDate(leave.from_date);
        if (month) monthSet.add(month);
        if (year) yearSet.add(year);
    });
    
    // Update month dropdown
    let monthOptions = '<option value="">All Months</option>';
    Array.from(monthSet).sort().forEach(month => {
        monthOptions += `<option value="${month}">${MONTH_NAMES[month] || month}</option>`;
    });
    elements.monthFilter.innerHTML = monthOptions;
    
    // Update year dropdown (newest first)
    let yearOptions = '<option value="">All Years</option>';
    Array.from(yearSet).sort((a, b) => b - a).forEach(year => {
        yearOptions += `<option value="${year}">${year}</option>`;
    });
    elements.yearFilter.innerHTML = yearOptions;
    
    // Set current month/year as default if available
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentYear = today.getFullYear().toString();
    
    if (monthSet.has(currentMonth)) {
        elements.monthFilter.value = currentMonth;
        filters.month = currentMonth;
    }
    
    if (yearSet.has(currentYear)) {
        elements.yearFilter.value = currentYear;
        filters.year = currentYear;
    }
}

// Apply Filters
function getFilteredLeaves() {
    return allLeaves.filter(leave => {
        // Employee filter
        if (filters.employee && leave.employee_id !== filters.employee) {
            return false;
        }
        
        // Month filter
        if (filters.month && getMonthFromDate(leave.from_date) !== filters.month) {
            return false;
        }
        
        // Year filter
        if (filters.year && getYearFromDate(leave.from_date) !== filters.year) {
            return false;
        }
        
        // Status filter
        if (filters.status && (leave.status || '').toLowerCase() !== filters.status) {
            return false;
        }
        
        return true;
    });
}

// Update Active Filters Display
function updateActiveFilters() {
    // Update summary text
    let filterParts = [];
    if (filters.employee) {
        const empName = Array.from(elements.employeeFilter.options).find(opt => opt.value === filters.employee)?.text || filters.employee;
        filterParts.push(empName);
    }
    if (filters.month) filterParts.push(MONTH_NAMES[filters.month]);
    if (filters.year) filterParts.push(filters.year);
    if (filters.status) {
        const statusMap = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
        filterParts.push(statusMap[filters.status]);
    }
    
    elements.filterSummary.textContent = filterParts.length > 0 
        ? `Showing: ${filterParts.join(' • ')}` 
        : 'Showing all leaves';
    
    // Create filter badges
    let badgesHtml = '';
    if (filters.employee) {
        const empName = Array.from(elements.employeeFilter.options).find(opt => opt.value === filters.employee)?.text || filters.employee;
        badgesHtml += `<span class="filter-badge">👤 ${empName} <button onclick="clearFilter('employee')">✕</button></span>`;
    }
    if (filters.month) {
        badgesHtml += `<span class="filter-badge">📅 ${MONTH_NAMES[filters.month]} <button onclick="clearFilter('month')">✕</button></span>`;
    }
    if (filters.year) {
        badgesHtml += `<span class="filter-badge">📆 ${filters.year} <button onclick="clearFilter('year')">✕</button></span>`;
    }
    if (filters.status) {
        const statusIcon = filters.status === 'pending' ? '⏳' : filters.status === 'approved' ? '✅' : '❌';
        badgesHtml += `<span class="filter-badge">${statusIcon} ${filters.status} <button onclick="clearFilter('status')">✕</button></span>`;
    }
    
    elements.activeFilters.innerHTML = badgesHtml;
}

// Clear specific filter
window.clearFilter = function(filterName) {
    filters[filterName] = '';
    
    // Update dropdown
    if (filterName === 'employee') elements.employeeFilter.value = '';
    if (filterName === 'month') elements.monthFilter.value = '';
    if (filterName === 'year') elements.yearFilter.value = '';
    if (filterName === 'status') {
        elements.statusFilter.value = 'pending'; // Reset to pending
        filters.status = 'pending';
    }
    
    renderLeavesTable();
    updateActiveFilters();
};

// Clear all filters
function clearAllFilters() {
    filters = {
        employee: '',
        month: '',
        year: '',
        status: 'pending' // Keep pending as default
    };
    
    // Reset dropdowns
    elements.employeeFilter.value = '';
    elements.monthFilter.value = '';
    elements.yearFilter.value = '';
    elements.statusFilter.value = 'pending';
    
    renderLeavesTable();
    updateActiveFilters();
    showToast('Filters cleared', 'success');
}

// ========== RENDER FUNCTIONS ==========

// Render Leaves Table
function renderLeavesTable() {
    const filteredLeaves = getFilteredLeaves();
    
    // Update stats
    const total = filteredLeaves.length;
    const approved = filteredLeaves.filter(l => (l.status || '').toLowerCase() === 'approved').length;
    const pending = filteredLeaves.filter(l => (l.status || '').toLowerCase() === 'pending').length;
    const rejected = filteredLeaves.filter(l => (l.status || '').toLowerCase() === 'rejected').length;
    
    elements.totalLeaves.textContent = total;
    elements.totalApproved.textContent = approved;
    elements.totalPending.textContent = pending;
    elements.totalRejected.textContent = rejected;
    elements.filteredCount.textContent = total;
    
    if (filteredLeaves.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <span>📋</span>
                    <p>No leaves match filters</p>
                </td>
            </tr>
        `;
        updateActiveFilters();
        return;
    }
    
    // Sort by date (newest first)
    filteredLeaves.sort((a, b) => new Date(b.from_date) - new Date(a.from_date));
    
    let html = '';
    filteredLeaves.forEach((leave, index) => {
        const days = calculateDays(leave.from_date, leave.to_date);
        const status = (leave.status || '').toLowerCase();
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td class="employee-cell">
                    <div class="employee-info">
                        <span class="emp-name">${leave.employee_name || 'Unknown'}</span>
                        <span class="emp-id">${leave.employee_id || ''}</span>
                    </div>
                </td>
                <td class="dates-cell">
                    <span class="date-range">${formatDate(leave.from_date)} → ${formatDate(leave.to_date)}</span>
                </td>
                <td><span class="days-badge">${days}</span></td>
                <td class="reason-cell">${leave.reason || '-'}</td>
                <td>${getStatusBadge(leave.status)}</td>
                <td>
                    ${status === 'pending' ? `
                        <div class="action-buttons">
                            <button class="action-small approve" onclick="updateLeave(${leave.id}, 'approved', '${leave.employee_email}')" title="Approve">✅</button>
                            <button class="action-small reject" onclick="updateLeave(${leave.id}, 'rejected', '${leave.employee_email}')" title="Reject">❌</button>
                        </div>
                    ` : '<span class="status-text">-</span>'}
                </td>
            </tr>
        `;
    });
    
    elements.tableBody.innerHTML = html;
    updateActiveFilters();
}

// ========== API FUNCTIONS ==========

// Load Leaves from API
async function loadLeaves() {
    if (isLoading) return;
    
    isLoading = true;
    setLoading(true);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/amanwiz/leave/all`);
        const data = await response.json();
        
        allLeaves = data.data || [];
        
        // Update filters with actual data
        updateFilterDropdowns();
        
        // Render table
        renderLeavesTable();
        
        showToast('Data loaded', 'success');
        
    } catch (error) {
        console.error('Load error:', error);
        showToast('Failed to load data', 'error');
        
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <span>❌</span>
                    <p>Failed to load. Tap refresh.</p>
                </td>
            </tr>
        `;
    } finally {
        isLoading = false;
        setLoading(false);
    }
}

// Update Leave Status
window.updateLeave = async function(id, status, employee_email) {
    if (isProcessing) return;
    
    isProcessing = true;
    
    // Show loading on button
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    
    try {
        const response = await fetch(CONFIG.API_BASE + "/amanwiz/leave/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                leave_id: id,
                status: status,
                approved_by: CONFIG.manager_name,
                manager_emails: [CONFIG.manager_email],
                owner_emails: CONFIG.owner_emails,
                employee_email: employee_email
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`Leave ${status}!`, 'success');
            loadLeaves(); // Reload data
        } else {
            showToast(data.message || 'Update failed', 'error');
        }
        
    } catch (error) {
        console.error('Update error:', error);
        showToast('Error updating', 'error');
    } finally {
        isProcessing = false;
        buttons.forEach(btn => btn.disabled = false);
    }
};

// ========== EVENT LISTENERS ==========

// Filter change handlers
elements.employeeFilter.addEventListener('change', (e) => {
    filters.employee = e.target.value;
    renderLeavesTable();
});

elements.monthFilter.addEventListener('change', (e) => {
    filters.month = e.target.value;
    renderLeavesTable();
});

elements.yearFilter.addEventListener('change', (e) => {
    filters.year = e.target.value;
    renderLeavesTable();
});

elements.statusFilter.addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderLeavesTable();
});

// Clear filters
elements.clearFiltersBtn.addEventListener('click', clearAllFilters);

// Quick actions
elements.refreshBtn.addEventListener('click', loadLeaves);
elements.pendingBtn.addEventListener('click', () => {
    filters.status = 'pending';
    elements.statusFilter.value = 'pending';
    renderLeavesTable();
});
elements.topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLeaves();
    elements.managerBadge.textContent = 'Manager';
});
