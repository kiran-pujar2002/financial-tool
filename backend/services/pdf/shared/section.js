// services/pdf/shared/section.js
const { COLORS, FONTS, SIZES, MARGINS } = require('./styles');

function sectionHeader(doc, title) {
    doc.fillColor(COLORS.primary)
        .fontSize(SIZES.heading)
        .font(FONTS.heading)
        .text(title);

    doc.moveTo(MARGINS.left, doc.y + 4)
        .lineTo(doc.page.width - MARGINS.right, doc.y + 4)
        .strokeColor(COLORS.gold)
        .lineWidth(2)
        .stroke();

    doc.moveDown(1.2);
    doc.font(FONTS.body);
}

module.exports = { sectionHeader };