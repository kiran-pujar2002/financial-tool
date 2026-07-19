// services/pdf/generators/cim.js
const { COLORS } = require('../shared/styles');
const { sectionHeader } = require('../shared/section');
const { createTable } = require('../shared/table');
const { formatCurrency } = require('../shared/helpers');

const MARGINS = { left: 50, right: 50 };

function generateCIMContent(doc, report, data) {
    const { metrics, addbackSchedule } = data;

    // ============================================================
    // EXECUTIVE SUMMARY
    // ============================================================
    sectionHeader(doc, 'Executive Summary');
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .text(`This Confidential Information Memorandum ("CIM") has been prepared to provide prospective buyers with an overview of ${report.business_name}.`, {
            width: doc.page.width - 100,
            lineGap: 4,
        });
    doc.moveDown(1);

    const cards = [
        ['Revenue', formatCurrency(metrics.totalRevenue), COLORS.primary],
        ['EBITDA', formatCurrency(metrics.ebitda), COLORS.accent],
        ['SDE', formatCurrency(metrics.sde), COLORS.secondary],
    ];
    let x = MARGINS.left;
    const y = doc.y + 10;
    const cardWidth = 155;
    const cardHeight = 60;
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
    // BUSINESS OVERVIEW
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Business Overview');
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .text(`${report.business_name} is a ${report.industry || 'business'} operating in the ${report.industry || 'industry'} sector. The business has demonstrated consistent performance and maintains a strong market position.`, {
            width: doc.page.width - 100,
            lineGap: 4,
        });

    // ============================================================
    // FINANCIAL PERFORMANCE
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Financial Performance');
    const rows = [
        ['Revenue', formatCurrency(metrics.totalRevenue)],
        ['EBITDA', formatCurrency(metrics.ebitda)],
        ['SDE', formatCurrency(metrics.sde)],
        ['Total Add-backs', formatCurrency(metrics.totalAddbacks)],
    ];
    createTable(doc, ['Metric', 'Amount'], rows, [350, 145]);

    // ============================================================
    // KEY SELLING POINTS
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Why Buy This Business?');
    const points = [
        'Established business with proven financial performance',
        'Strong market position with growth opportunities',
        'Owner can transition with a structured handover',
        'Potential for expansion into new markets',
        'Attractive valuation based on normalized earnings',
    ];
    for (let i = 0; i < points.length; i++) {
        const y = doc.y;
        doc.rect(MARGINS.left, y, doc.page.width - 100, 35)
            .fill(y % 70 === 50 ? COLORS.lightBg : COLORS.white);
        doc.fillColor(COLORS.primary)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(`${i + 1}`, MARGINS.left + 10, y + 8);
        doc.fillColor(COLORS.text)
            .fontSize(10)
            .font('Helvetica')
            .text(points[i], MARGINS.left + 35, y + 8, { width: doc.page.width - 145 });
        doc.y = y + 35;
    }

    // ============================================================
    // VALUATION GUIDANCE
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Valuation Guidance');
    const estimatedValue = (metrics.sde || metrics.ebitda || 0) * 3.0;
    doc.fillColor(COLORS.accent)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(formatCurrency(estimatedValue), MARGINS.left, doc.y, {
            width: doc.page.width - 100,
            align: 'center',
        });
    doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text('Estimated Business Value', MARGINS.left, doc.y + 30, {
            width: doc.page.width - 100,
            align: 'center',
        });
}

module.exports = { generateCIMContent };