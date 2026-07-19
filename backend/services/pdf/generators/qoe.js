// services/pdf/generators/qoe.js
const { COLORS, FONTS, SIZES } = require('../shared/styles');
const { sectionHeader } = require('../shared/section');
const { createTable } = require('../shared/table');
const { formatCurrency, formatDate } = require('../shared/helpers');

const MARGINS = { left: 50, right: 50 };

function generateQOEContent(doc, report, data) {
    const { metrics, transactions, addbackSchedule, executiveSummary } = data;

    // ============================================================
    // EXECUTIVE SUMMARY
    // ============================================================
    sectionHeader(doc, 'Executive Summary');
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text(executiveSummary || 'Executive summary unavailable.', {
            width: doc.page.width - 100,
            lineGap: 4,
            align: 'justify',
        });
    doc.moveDown(2);

    // Key metrics cards
    const cards = [
        ['Revenue', formatCurrency(metrics.totalRevenue), COLORS.primary],
        ['EBITDA', formatCurrency(metrics.ebitda), COLORS.accent],
        ['SDE', formatCurrency(metrics.sde), COLORS.secondary],
    ];

    let x = MARGINS.left;
    const y = doc.y + 10;
    const cardWidth = 155;
    const cardHeight = 65;

    for (const [label, value, color] of cards) {
        doc.roundedRect(x, y, cardWidth, cardHeight, 8)
            .fillAndStroke(COLORS.lightBg, COLORS.border);
        doc.fillColor(COLORS.gray)
            .fontSize(7)
            .font('Helvetica-Bold')
            .text(label.toUpperCase(), x + 12, y + 12, { width: cardWidth - 24 });
        doc.fillColor(color)
            .fontSize(16)
            .font('Helvetica-Bold')
            .text(value, x + 12, y + 30, { width: cardWidth - 24 });
        x += cardWidth + 15;
    }
    doc.y = y + cardHeight + 30;

    // ============================================================
    // FINANCIAL SUMMARY
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Financial Summary');

    const rows = [
        ['Revenue', formatCurrency(metrics.totalRevenue)],
        ['Total Expenses', formatCurrency(Math.abs(metrics.totalExpenses))],
        ['', ''],
        ['Net Income', formatCurrency(metrics.netIncome)],
        ['Add-backs', formatCurrency(metrics.totalAddbacks)],
        ['EBITDA', formatCurrency(metrics.ebitda)],
        ['SDE', formatCurrency(metrics.sde)],
    ];
    const colWidths = [350, 145];
    createTable(doc, ['Category', 'Amount'], rows, colWidths);

    // ============================================================
    // ADD-BACK SCHEDULE
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Add-Back Schedule');

    if (!addbackSchedule || addbackSchedule.length === 0) {
        doc.fillColor(COLORS.textLight)
            .fontSize(11)
            .text('No add-backs were identified in the source data.');
    } else {
        const headers = ['Add-Back Item', 'Occurrences', 'Amount'];
        const cols = [280, 100, 115];
        const addbackRows = addbackSchedule.map(a => [
            a.label || 'Unnamed',
            String(a.transaction_count || a.count || 1),
            formatCurrency(a.amount),
        ]);
        addbackRows.push(['Total Add-Backs', '', formatCurrency(metrics.totalAddbacks)]);
        createTable(doc, headers, addbackRows, cols);
    }

    // ============================================================
    // TRANSACTIONS
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Transaction Detail');

    if (transactions && transactions.length > 0) {
        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const cols = [70, 210, 115, 100];
        const txnRows = transactions.slice(0, 50).map(t => [
            t.txn_date ? formatDate(t.txn_date) : '—',
            (t.description || '') + (t.is_addback ? ' ★' : ''),
            t.category || 'Uncategorized',
            formatCurrency(t.amount),
        ]);
        createTable(doc, headers, txnRows, cols);
        if (transactions.length > 50) {
            doc.text(`... and ${transactions.length - 50} more transactions`, MARGINS.left, doc.y);
        }
    }
}

module.exports = { generateQOEContent };