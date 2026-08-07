// services/pdf/generators/qoe.js
const { COLORS, FONTS, SIZES } = require('../shared/styles');
const { sectionHeader } = require('../shared/section');
const { createTable } = require('../shared/table');
const { formatCurrency, formatDate } = require('../shared/helpers');

const MARGINS = { left: 50, right: 50 };

function generateQOEContent(doc, report, data) {
    const { metrics, transactions, addbackSchedule, executiveSummary } = data;

    // ============================================================
    // DISCLAIMERS
    // ============================================================
    doc.fillColor(COLORS.primary)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Disclaimers', MARGINS.left, 50);
    doc.moveDown(0.5);

    const disclaimers = [
        'This report was generated with AI-assisted categorization of financial transactions provided by the business owner. It has not been audited, reviewed, or compiled in accordance with ICAI or other professional accounting standards.',
        'Add-back determinations reflect a good-faith interpretation of the source data and are subject to review by the business owner, buyer, and their advisors.',
        'EBITDA and Seller\'s Discretionary Earnings (SDE) are calculated using standard main-street business brokerage conventions.',
        'This report does not constitute investment, legal, or tax advice. Recipients should engage a licensed CA before relying on this report for a transaction or financing decision.'
    ];

    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .font('Helvetica');
    for (const d of disclaimers) {
        doc.text('• ' + d, MARGINS.left, doc.y, {
            width: doc.page.width - 100,
            lineGap: 2,
            align: 'justify',
        });
        doc.moveDown(0.3);
    }
    doc.moveDown(1);

    // ============================================================
    // EXECUTIVE SUMMARY
    // ============================================================
    sectionHeader(doc, 'Executive Summary');

    const summaryText = executiveSummary || 
        `${report.business_name} generated normalized revenue of ${formatCurrency(metrics.totalRevenue)} for the period, with EBITDA of ${formatCurrency(metrics.ebitda)} and Seller's Discretionary Earnings (SDE) of ${formatCurrency(metrics.sde)} after applying ${formatCurrency(metrics.totalAddbacks)} in identified add-backs.`;

    doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text(summaryText, {
            width: doc.page.width - 100,
            lineGap: 4,
            align: 'justify',
        });
    doc.moveDown(1);

    // ✅ Summary Cards - Clean and simple
    const cards = [
        ['REVENUE', formatCurrency(metrics.totalRevenue)],
        ['NET INCOME', formatCurrency(metrics.netIncome)],
        ['EBITDA', formatCurrency(metrics.ebitda)],
        ['SDE', formatCurrency(metrics.sde)],
    ];

    let x = MARGINS.left;
    const y = doc.y + 10;
    const cardWidth = 115;
    const cardHeight = 55;

    for (const [label, value] of cards) {
        doc.roundedRect(x, y, cardWidth, cardHeight, 6)
            .fillAndStroke(COLORS.lightBg, COLORS.border);
        doc.fillColor(COLORS.gray)
            .fontSize(6)
            .font('Helvetica-Bold')
            .text(label, x + 10, y + 8, { width: cardWidth - 20, align: 'center' });
        doc.fillColor(COLORS.primary)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(value, x + 10, y + 25, { width: cardWidth - 20, align: 'center' });
        x += cardWidth + 8;
    }
    doc.y = y + cardHeight + 20;

    // ============================================================
    // NORMALIZED P&L STATEMENT
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Normalized Profit & Loss Statement');

    const pnlRows = [
        ['Revenue', formatCurrency(metrics.totalRevenue)],
        ['Cost of Goods Sold', formatCurrency(-Math.abs(metrics.totalExpenses))],
        ['', ''],
        ['Net Income', formatCurrency(metrics.netIncome)],
        ['Add-backs', formatCurrency(metrics.totalAddbacks)],
        ['EBITDA', formatCurrency(metrics.ebitda)],
        ['SDE', formatCurrency(metrics.sde)],
    ];
    createTable(doc, ['Category', 'Amount'], pnlRows, [350, 145]);

    // ============================================================
    // ADD-BACK SCHEDULE
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Add-Back Schedule');

    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .font('Helvetica')
        .text('The following items were identified as personal, discretionary, or non-recurring expenses added back to EBITDA to calculate SDE. Each should be independently confirmed by the business owner.', {
            width: doc.page.width - 100,
        });
    doc.moveDown(1);

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
    // KEY RATIOS
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Key Ratios & Margins');

    const totalRevenue = Number(metrics.totalRevenue) || 1;
    const netIncome = Number(metrics.netIncome) || 0;
    const ebitda = Number(metrics.ebitda) || 0;
    const sde = Number(metrics.sde) || 0;
    const totalAddbacks = Number(metrics.totalAddbacks) || 0;

    const ratios = [
        ['Net Income Margin', `${((netIncome / totalRevenue) * 100).toFixed(1)}%`],
        ['EBITDA Margin', `${((ebitda / totalRevenue) * 100).toFixed(1)}%`],
        ['SDE Margin', `${((sde / totalRevenue) * 100).toFixed(1)}%`],
        ['Add-Backs as % of Revenue', `${((totalAddbacks / totalRevenue) * 100).toFixed(1)}%`],
    ];

    createTable(doc, ['Metric', 'Value'], ratios, [350, 145]);

    doc.fillColor(COLORS.gray)
        .fontSize(7)
        .font('Helvetica')
        .text('Margins are calculated against total normalized revenue. Ratios should be compared against industry benchmarks by a qualified advisor.', {
            width: doc.page.width - 100,
            align: 'center',
        });

    // ============================================================
    // TRANSACTIONS - Compact table
    // ============================================================
    if (transactions && transactions.length > 0) {
        doc.addPage();
        sectionHeader(doc, 'Transaction Detail');

        doc.fillColor(COLORS.gray)
            .fontSize(8)
            .font('Helvetica')
            .text(`${transactions.length} transactions were processed and categorized below. Add-back items are marked with ★.`, {
                width: doc.page.width - 100,
            });
        doc.moveDown(0.5);

        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const cols = [70, 200, 120, 100];

        const txnRows = transactions.slice(0, 40).map(t => [
            t.txn_date ? formatDate(t.txn_date) : '—',
            (t.description || '').length > 35 ? (t.description || '').substring(0, 33) + '…' : (t.description || ''),
            t.category || 'Uncategorized',
            formatCurrency(t.amount),
        ]);

        createTable(doc, headers, txnRows, cols);

        if (transactions.length > 40) {
            doc.fillColor(COLORS.gray)
                .fontSize(8)
                .font('Helvetica')
                .text(`... and ${transactions.length - 40} more transactions.`, MARGINS.left, doc.y + 5);
        }
    }
}

module.exports = { generateQOEContent };