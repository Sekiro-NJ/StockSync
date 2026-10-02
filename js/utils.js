/**
 * @file utils.js
 * @description Core utility functions for the FMCG Stock Tracking System.
 * WHY IT EXISTS: Centralizes common operations like formatting, ID generation, and UI feedback
 * to ensure consistency across the application and avoid code duplication.
 */

/**
 * Generates a UUID-like string.
 * Engineering Decision: Uses crypto.randomUUID if available for true randomness,
 * falls back to a timestamp-based pseudo-random string for older browser support.
 * @returns {string} Unique identifier
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Formats a Date object to 'DD-MMM-YYYY'.
 * @param {Date|string|number} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * Formats a Date object to 'HH:MM' 24hr format.
 * @param {Date|string|number} date - The date to format
 * @returns {string} Formatted time string
 */
export function formatTime(date) {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Formats a Date object to 'DD-MMM-YYYY HH:MM'.
 * @param {Date|string|number} date - The date to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Formats a number with commas for thousands.
 * @param {number} n - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(n) {
    return Number(n).toLocaleString('en-IN');
}

/**
 * Displays a toast notification on the screen.
 * Engineering Decision: Decouples UI feedback from business logic. Auto-cleans up DOM elements
 * to prevent memory leaks.
 * @param {string} message - The message to display
 * @param {string} [type='info'] - The type of toast ('info', 'success', 'warning', 'error')
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    // Basic styling for the toast, colors based on type
    let bgColor = '#333';
    if (type === 'success') bgColor = '#4CAF50';
    else if (type === 'warning') bgColor = '#FF9800';
    else if (type === 'error') bgColor = '#F44336';
    else if (type === 'info') bgColor = '#2196F3';

    toast.style.cssText = `background: ${bgColor}; color: white; padding: 12px 24px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); opacity: 0; transition: opacity 0.3s ease; font-family: sans-serif;`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger reflow for transition
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, 3000);
}

/**
 * Standard debounce function to limit the rate at which a function is executed.
 * Engineering Decision: Crucial for performance, especially for search inputs and window resize events.
 * @param {Function} fn - The function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Returns today's date as an ISO string (YYYY-MM-DD).
 * @returns {string} Today's date
 */
export function today() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}
