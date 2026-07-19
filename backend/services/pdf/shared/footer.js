// services/pdf/shared/footer.js
const { COLORS, MARGINS } = require('./styles');

function addPageNumbers(doc, branding) {
    const range = doc.bufferedPageRange();
    const primaryColor = branding?.primary_color || COLORS.primary;

    if (!range || range.count === 0) return;

    for (let i = 0; i < range.count; i++) {
        try {
            doc.switchToPage(i);
            doc.moveTo(MARGINS.left, doc.page.height - 35)
                .lineTo(doc.page.width - MARGINS.right, doc.page.height - 35)
                .strokeColor(COLORS.border)
                .lineWidth(1)
                .stroke();

            doc.fillColor(primaryColor)
                .fontSize(8)
                .font('Helvetica')
                .text(`Page ${i + 1} of ${range.count}`, MARGINS.left, doc.page.height - 28, {
                    align: 'center',
                    width: doc.page.width - 100,
                });
        } catch (err) {
            // Skip if page doesn't exist
        }
    }
}

module.exports = { addPageNumbers };