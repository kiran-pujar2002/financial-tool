// services/pdf/shared/helpers.js

function formatCurrency(n) {
    const num = Number(n) || 0;
    return num.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    });
}

function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date)) return String(d);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function truncate(str, n) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function getReportType(type) {
    const types = {
        qoe: 'Quality of Earnings Report',
        cim: 'Confidential Information Memorandum',
        valuation: 'Business Valuation Report',
        dd: 'Due Diligence Report',
    };
    return types[type] || 'Report';
}

module.exports = {
    formatCurrency,
    formatDate,
    truncate,
    getReportType,
};