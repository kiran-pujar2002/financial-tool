// services/pdf/generators/valuation.js
const { COLORS } = require('../shared/styles');
const { sectionHeader } = require('../shared/section');
const { createTable } = require('../shared/table');
const { formatCurrency } = require('../shared/helpers');

function generateValuationContent(doc, report, data) {
    const { valuation, metrics } = data;

    // ============================================================
    // VALUATION SUMMARY
    // ============================================================
    sectionHeader(doc, 'Valuation Summary');

    const mid = Number(valuation.value_mid || 0);
    doc.fillColor(COLORS.accent)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(formatCurrency(mid), 50, doc.y, {
            width: doc.page.width - 100,
            align: 'center',
        });
    doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text('Estimated Business Value', 50, doc.y + 30, {
            width: doc.page.width - 100,
            align: 'center',
        });
    doc.moveDown(3);

    // ============================================================
    // VALUATION DETAILS
    // ============================================================
    const details = [
        ['Valuation Method', (valuation.method || 'sde').toUpperCase()],
        ['Multiple Used', `${valuation.multiple_used || 3.0}x`],
        ['Financial Metric', valuation.method === 'sde' ? 'SDE' : valuation.method === 'ebitda' ? 'EBITDA' : 'Revenue'],
        ['Base Value', formatCurrency(valuation.adjustments?.baseValue || metrics.sde || 0)],
    ];
    createTable(doc, ['Metric', 'Value'], details, [350, 145]);

    // ============================================================
    // VALUATION RANGE
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Valuation Range');

    const min = Number(valuation.value_min || 0);
    const max = Number(valuation.value_max || 0);
    const range = [
        ['Low Case', formatCurrency(min)],
        ['Base Case', formatCurrency(mid)],
        ['High Case', formatCurrency(max)],
    ];
    createTable(doc, ['Scenario', 'Value'], range, [350, 145]);

    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text('Base case represents the midpoint of the industry-typical multiple range applied to normalized earnings.', 50, doc.y, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // ============================================================
    // METHODOLOGY
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Valuation Methodology');

    const methodName = {
        sde: 'SDE Multiple Method',
        ebitda: 'EBITDA Multiple Method',
        revenue: 'Revenue Multiple Method',
    }[valuation.method] || 'SDE Multiple Method';

    doc.fillColor(COLORS.text)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(methodName, 50, doc.y);
    doc.moveDown(0.5);

    const descriptions = {
        sde: 'Seller\'s Discretionary Earnings (SDE) multiples are the most commonly used valuation approach for main-street businesses, as they normalize for owner compensation and discretionary benefits.',
        ebitda: 'Enterprise Value is calculated by applying an industry multiple to EBITDA. This method is commonly used for larger businesses and M&A transactions.',
        revenue: 'Revenue multiples are used for businesses with high growth but low profitability, common in technology and service businesses.',
    };

    doc.fillColor(COLORS.textLight)
        .fontSize(10)
        .font('Helvetica')
        .text(descriptions[valuation.method] || descriptions.sde, 50, doc.y, {
            width: doc.page.width - 100,
            lineGap: 4,
        });
}

module.exports = { generateValuationContent };