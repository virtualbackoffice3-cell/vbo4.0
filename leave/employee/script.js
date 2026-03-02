// ========== CONFIGURATION ==========
const CONFIG = {
    API_BASE: "https://app.vbo.co.in",
    employee_id: "EMP0001",
    employee_name: "Test Employee",
    employee_email: "shahzebinfo2@gmail.com",
    manager_emails: ["manager@gmail.com"],
    owner_emails: ["owner@gmail.com"]
};

// ========== STATE MANAGEMENT ==========
let isSubmitting = false;
let isLoading = false;

// ========== DOM ELEMENTS ==========
const elements = {
    // Form elements
    fromDate: document.getElementById('from_date'),
    toDate: document.getElementById('to_date'),
    reason: document.getElementById('reason'),
    handover: document.getElementById('handover'),
    applyBtn: document.getElementById('applyBtn'),
    charCount: document.getElementById('charCount'),
    
    // Table elements
    tableBody: document.getElementById('leaveTableBody'),
    
    // Stats elements
    totalLeaves: document.getElementById('totalLeaves'),
    approvedLeaves: document.getElementById('approvedLeaves'),
    pendingLeaves: document.getElementById('pendingLeaves'),
    
    // UI elements
    toast: document.getElementById('toast'),
    loading: document.getElementById('loadingSpinner'),
    pullRefresh: document.getElementById('pullRefresh'),
    empBadge: document.getElementById('empBadge'),
    
    // Buttons
    refreshBtn: document.getElementById('refreshBtn'),
    clearBtn: document.getElementById('clearBtn'),
    topBtn: document.getElementById('topBtn')
};

// ========== UTILITY FUNCTIONS ==========

// Show Toast Notification
function showToast(msg, type = 'success') {
    elements.toast.textContent = msg;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 2500);
}

// Show/Hide Loading
function setLoading(show) {
    if (show) {
        elements.loading.classList.add('show');
    } else {
        elements.loading.classList.remove('show');
    }
}

// Format Date
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
    } catch {
        return dateStr;
    }
}

// Get Status Icon
function getStatusIcon(status) {
    switch(status?.toLowerCase()) {
        case 'approved': return '✅';
        case 'rejected': return '❌';
        case 'pending': return '⏳';
        default: return '📝';
    }
}

// ========== API CALLS ==========

// Load Leaves from API
async function loadLeaves() {
    if (isLoading) return;
    
    isLoading = true;
    setLoading(true);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/amanwiz/leave/my?employee_id=${CONFIG.employee_id}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            renderLeavesTable(data.data);
            updateStats(data.data);
        } else {
            showEmptyState();
        }
        
        showToast('Data loaded successfully', 'success');
        
    } catch (error) {
        console.error('Load error:', error);
        showToast('Failed to load leaves', 'error');
        showEmptyState();
    } finally {
        isLoading = false;
        setLoading(false);
    }
}

// Apply Leave API
async function applyLeave() {
    if (isSubmitting) return;
    if (!validateForm()) return;
    
    isSubmitting = true;
    elements.applyBtn.disabled = true;
    elements.applyBtn.innerHTML = '<span class="btn-spinner"></span> Submitting...';
    
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
            showToast(data.message || 'Leave applied successfully!', 'success');
            clearForm();
            loadLeaves(); // Reload leaves
        } else {
            showToast(data.message || 'Failed to apply leave', 'error');
        }
        
    } catch (error) {
        console.error('Apply error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        elements.applyBtn.disabled = false;
        elements.applyBtn.innerHTML = '<span class="btn-text">Apply Leave</span><span class="btn-icon">→</span>';
        isSubmitting = false;
    }
}

// ========== UI RENDERING ==========

// Render Leaves Table
function renderLeavesTable(leaves) {
    if (!leaves || leaves.length === 0) {
        showEmptyState();
        return;
    }
    
    let html = '';
    leaves.forEach(leave => {
        html += `
            <tr>
                <td>${leave.id || 'N/A'}</td>
                <td>${formatDate(leave.from_date)}</td>
                <td>${formatDate(leave.to_date)}</td>
                <td>
                    <span class="status-badge ${(leave.status || 'pending').toLowerCase()}">
                        ${getStatusIcon(leave.status)} ${leave.status || 'Pending'}
                    </span>
                </td>
            </tr>
        `;
    });
    
    elements.tableBody.innerHTML = html;
}

// Update Statistics
function updateStats(leaves) {
    const total = leaves.length;
    const approved = leaves.filter(l => l.status?.toLowerCase() === 'approved').length;
    const pending = leaves.filter(l => l.status?.toLowerCase() === 'pending').length;
    
    elements.totalLeaves.textContent = total;
    elements.approvedLeaves.textContent = approved;
    elements.pendingLeaves.textContent = pending;
}

// Show Empty State
function showEmptyState() {
    elements.tableBody.innerHTML = `
        <tr>
            <td colspan="4" class="empty-state">
                <span>📋</span>
                <p>No leaves found</p>
            </td>
        </tr>
    `;
    
    elements.totalLeaves.textContent = '0';
    elements.approvedLeaves.textContent = '0';
    elements.pendingLeaves.textContent = '0';
}

// Clear Form
function clearForm() {
    elements.fromDate.value = '';
    elements.toDate.value = '';
    elements.reason.value = '';
    elements.handover.value = '';
    elements.charCount.textContent = '0';
    
    // Remove filled class
    [elements.fromDate, elements.toDate, elements.handover].forEach(el => {
        el.classList.remove('filled');
    });
    
    showToast('Form cleared', 'success');
}

// ========== VALIDATION ==========

// Validate Form
function validateForm() {
    const fromDate = elements.fromDate.value;
    const toDate = elements.toDate.value;
    const reason = elements.reason.value.trim();
    const handover = elements.handover.value.trim();
    
    if (!fromDate || !toDate || !reason || !handover) {
        showToast('Please fill all fields', 'error');
        return false;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (from < today) {
        showToast('From date cannot be in past', 'error');
        return false;
    }
    
    if (to < from) {
        showToast('To date must be after from date', 'error');
        return false;
    }
    
    if (reason.length < 10) {
        showToast('Reason must be at least 10 characters', 'error');
        return false;
    }
    
    return true;
}

// ========== EVENT LISTENERS ==========

// Character Counter
elements.reason.addEventListener('input', function() {
    elements.charCount.textContent = this.value.length;
});

// Date Validation
elements.fromDate.addEventListener('change', function() {
    elements.toDate.min = this.value;
    if (this.value) this.classList.add('filled');
});

elements.toDate.addEventListener('change', function() {
    if (this.value) this.classList.add('filled');
});

elements.handover.addEventListener('input', function() {
    if (this.value.trim()) {
        this.classList.add('filled');
    } else {
        this.classList.remove('filled');
    }
});

// ========== PULL TO REFRESH ==========

let touchStart = 0;
let touchEnd = 0;

document.addEventListener('touchstart', (e) => {
    touchStart = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (window.scrollY === 0) {
        touchEnd = e.touches[0].clientY;
        const diff = touchEnd - touchStart;
        
        if (diff > 80 && !isLoading) {
            elements.pullRefresh.classList.add('show');
        }
    }
}, { passive: true });

document.addEventListener('touchend', () => {
    if (elements.pullRefresh.classList.contains('show')) {
        elements.pullRefresh.classList.remove('show');
        loadLeaves();
    }
    touchStart = 0;
    touchEnd = 0;
});

// ========== KEYBOARD SHORTCUTS ==========

document.addEventListener('keydown', (e) => {
    // Ctrl+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        applyLeave();
    }
    
    // Escape to clear form
    if (e.key === 'Escape') {
        clearForm();
    }
});

// ========== BUTTON HANDLERS ==========

// Apply Button
elements.applyBtn.addEventListener('click', applyLeave);

// Refresh Button
elements.refreshBtn.addEventListener('click', loadLeaves);

// Clear Button
elements.clearBtn.addEventListener('click', clearForm);

// Top Button
elements.topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Update employee badge
elements.empBadge.textContent = CONFIG.employee_id;

// ========== INITIALIZATION ==========

// Load leaves when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadLeaves();
    console.log('Leave Panel initialized with API ✅');
});

// Check online status
window.addEventListener('online', () => {
    showToast('Back online! 🔌', 'success');
    loadLeaves();
});

window.addEventListener('offline', () => {
    showToast('You are offline 📴', 'error');
});
