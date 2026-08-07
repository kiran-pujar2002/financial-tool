// services/pdf/shared/table.js
const { COLORS, FONTS, SIZES, MARGINS } = require('./styles');

function createTable(doc, headers, rows, colWidths, options = {}) {
    const { 
        headerColor = COLORS.primary,
        headerTextColor = COLORS.white,
        alternateRows = true,
        fontSize = SIZES.small,
    } = options;

    // ✅ Start position
    let y = doc.y;
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    const rowHeight = 22;
    const headerHeight = 28;
    const totalRows = rows.length;
    
    // ✅ Calculate if we have enough space
    const spaceNeeded = headerHeight + (totalRows * rowHeight) + 20;
    if (y + spaceNeeded > doc.page.height - 80) {
        doc.addPage();
        y = 50;
        doc.y = y;
    }

    // Header
    doc.rect(MARGINS.left, y, totalWidth, headerHeight).fill(headerColor);
    doc.fillColor(headerTextColor)
        .fontSize(fontSize)
        .font(FONTS.title);

    let x = MARGINS.left;
    headers.forEach((h, i) => {
        doc.text(h, x + 6, y + 9, { width: colWidths[i] - 12 });
        x += colWidths[i];
    });
    y += headerHeight;

    // ✅ Rows - only draw what fits on the page
    let rowCount = 0;
    const maxRows = Math.floor((doc.page.height - y - 50) / rowHeight);
    const rowsToDraw = Math.min(totalRows, maxRows);

    for (let i = 0; i < rowsToDraw; i++) {
        const row = rows[i];
        const bg = alternateRows && i % 2 === 0 ? COLORS.white : COLORS.lightBg;
        
        // Skip empty divider rows
        if (row[0] === '' && row[1] === '') {
            y += 4;
            continue;
        }

        doc.rect(MARGINS.left, y, totalWidth, rowHeight).fill(bg);
        doc.fillColor(COLORS.text)
            .fontSize(fontSize)
            .font(FONTS.body);

        x = MARGINS.left;
        row.forEach((cell, j) => {
            const align = j === row.length - 1 ? 'right' : 'left';
            doc.text(String(cell || ''), x + 6, y + 5, {
                width: colWidths[j] - 12,
                align: align,
            });
            x += colWidths[j];
        });
        y += rowHeight;
        rowCount++;
    }

    // ✅ If there are more rows, add a note
    if (rowsToDraw < totalRows) {
        doc.fillColor(COLORS.gray)
            .fontSize(8)
            .font('Helvetica')
            .text(`... and ${totalRows - rowsToDraw} more rows`, MARGINS.left, y + 5);
        y += 20;
    }

    doc.y = y + 10;
}

module.exports = { createTable };