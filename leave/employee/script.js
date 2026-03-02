/* ========== ADD THESE TO EXISTING CSS ========== */

/* Loading Spinner */
.loading-spinner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px 30px;
    border-radius: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 2000;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
    backdrop-filter: blur(10px);
}

.loading-spinner.show {
    opacity: 1;
}

.spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
}

/* Button Spinner */
.btn-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.6s linear infinite;
    margin-right: 8px;
}

/* Status Badge */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 600;
    background: #edf2f7;
    color: #2d3748;
}

.status-badge.approved {
    background: linear-gradient(135deg, #c6f6d5, #9ae6b4);
    color: #22543d;
}

.status-badge.pending {
    background: linear-gradient(135deg, #feebc8, #fbd38d);
    color: #7b341e;
}

.status-badge.rejected {
    background: linear-gradient(135deg, #fed7d7, #feb2b2);
    color: #742a2a;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 40px 20px !important;
    background: #f7fafc !important;
}

.empty-state span {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
}

.empty-state p {
    font-size: 16px;
    color: #4a5568;
    margin-bottom: 4px;
}

.empty-state small {
    font-size: 14px;
    color: #718096;
}

/* Error State */
.error-state {
    text-align: center;
    padding: 30px 20px !important;
    background: #fff5f5 !important;
}

.error-state span {
    font-size: 36px;
    display: block;
    margin-bottom: 8px;
}

.error-state p {
    color: #c53030;
    margin-bottom: 12px;
}

.retry-btn {
    width: auto;
    padding: 8px 24px;
    margin-top: 8px;
    font-size: 14px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 30px;
    cursor: pointer;
}

/* Pull to Refresh */
.pull-to-refresh {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    text-align: center;
    padding: 15px;
    transform: translateY(-100%);
    transition: transform 0.3s;
    z-index: 1500;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.pull-to-refresh.show {
    transform: translateY(0);
}

/* Input States */
input.filled, textarea.filled {
    border-color: #667eea;
    background-color: #f0f5ff;
}

input.valid {
    border-color: #48bb78;
}

input.invalid {
    border-color: #f56565;
}

/* Table Row Animation */
@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Toast Types */
.toast.success {
    background: linear-gradient(135deg, #48bb78, #38a169);
}

.toast.error {
    background: linear-gradient(135deg, #f56565, #c53030);
}

.toast.info {
    background: linear-gradient(135deg, #4299e1, #3182ce);
}

/* Container Loaded Animation */
.container {
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.4s ease;
}

.container.loaded {
    opacity: 1;
    transform: translateY(0);
}

/* Touch Feedback */
button, .card {
    -webkit-tap-highlight-color: transparent;
}

button:active {
    transform: scale(0.97);
}

/* Better Date Input Styling */
input[type="date"]::-webkit-calendar-picker-indicator {
    opacity: 0.6;
    cursor: pointer;
    padding: 4px;
}

input[type="date"]::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
}
