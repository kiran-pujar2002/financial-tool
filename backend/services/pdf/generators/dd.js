// services/pdf/generators/dd.js
const { COLORS } = require('../shared/styles');
const { sectionHeader } = require('../shared/section');
const { createTable } = require('../shared/table');

function generateDDContent(doc, report, data) {
    const { items, stats } = data;

    // ============================================================
    // DUE DILIGENCE SUMMARY
    // ============================================================
    sectionHeader(doc, 'Due Diligence Summary');

    const cards = [
        ['Total', stats.total, COLORS.primary],
        ['Completed', stats.completed, COLORS.secondary],
        ['In Progress', stats.inProgress, COLORS.accent],
        ['Blocked', stats.blocked, COLORS.red],
    ];
    let x = 50;
    const y = doc.y + 10;
    const cardWidth = 115;
    const cardHeight = 60;
    for (const [label, value, color] of cards) {
        doc.roundedRect(x, y, cardWidth, cardHeight, 8)
            .fillAndStroke(COLORS.lightBg, COLORS.border);
        doc.fillColor(COLORS.gray)
            .fontSize(7)
            .font('Helvetica-Bold')
            .text(label.toUpperCase(), x + 10, y + 12, { width: cardWidth - 20 });
        doc.fillColor(color)
            .fontSize(18)
            .font('Helvetica-Bold')
            .text(String(value), x + 10, y + 30, { width: cardWidth - 20, align: 'center' });
        x += cardWidth + 10;
    }
    doc.y = y + cardHeight + 30;

    // ============================================================
    // PROGRESS BAR
    // ============================================================
    doc.addPage();
    sectionHeader(doc, 'Progress Overview');

    const progress = stats.progressPercentage || 0;
    const barWidth = 400;
    const barHeight = 30;
    const barX = 70;
    const barY = doc.y + 20;
    doc.fillColor(COLORS.text)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`Overall Progress: ${progress}%`, 50, doc.y);
    doc.roundedRect(barX, barY, barWidth, barHeight, 6).fill(COLORS.border);
    if (progress > 0) {
        doc.roundedRect(barX, barY, (barWidth * progress) / 100, barHeight, 6)
            .fill(COLORS.purple);
    }
    doc.fillColor(COLORS.white)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${progress}%`, barX + barWidth / 2 - 15, barY + 8);
    doc.y = barY + barHeight + 30;

    // ============================================================
    // ITEMS BY CATEGORY
    // ============================================================
    const categories = {};
    items.forEach(item => {
        if (!categories[item.category]) categories[item.category] = [];
        categories[item.category].push(item);
    });

    Object.keys(categories).forEach(category => {
        doc.addPage();
        sectionHeader(doc, category);
        const headers = ['Item', 'Status', 'Priority'];
        const cols = [300, 100, 95];
        const rows = categories[category].map(item => [
            item.title,
            item.status || 'pending',
            item.priority || item.default_priority || 'medium',
        ]);
        createTable(doc, headers, rows, cols);
    });
}

module.exports = { generateDDContent };