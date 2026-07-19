// services/pdf/shared/table.js
const { COLORS, FONTS, SIZES, MARGINS } = require('./styles');

function createTable(doc, headers, rows, colWidths, options = {}) {
    const { 
        headerColor = COLORS.primary,
        headerTextColor = COLORS.white,
        alternateRows = true,
        fontSize = SIZES.small,
    } = options;

    let y = doc.y;
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    // Header
    doc.rect(MARGINS.left, y, totalWidth, 28).fill(headerColor);
    doc.fillColor(headerTextColor)
        .fontSize(fontSize)
        .font(FONTS.title);

    let x = MARGINS.left;
    headers.forEach((h, i) => {
        doc.text(h, x + 6, y + 9, { width: colWidths[i] - 12 });
        x += colWidths[i];
    });
    y += 28;

    // Rows
    rows.forEach((row, i) => {
        const bg = alternateRows && i % 2 === 0 ? COLORS.white : COLORS.lightBg;
        doc.rect(MARGINS.left, y, totalWidth, 22).fill(bg);
        doc.fillColor(COLORS.text)
            .fontSize(fontSize)
            .font(FONTS.body);

        x = MARGINS.left;
        row.forEach((cell, j) => {
            const align = j === row.length - 1 ? 'right' : 'left';
            doc.text(String(cell), x + 6, y + 5, {
                width: colWidths[j] - 12,
                align: align,
            });
            x += colWidths[j];
        });
        y += 22;
    });

    doc.y = y + 20;
}

module.exports = { createTable };