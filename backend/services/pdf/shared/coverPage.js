// services/pdf/shared/coverPage.js
const { COLORS, FONTS, SIZES, MARGINS } = require('./styles');
const { formatDate, getReportType } = require('./helpers');

function coverPage(doc, report, branding, type, additionalInfo = {}) {
    const primaryColor = branding?.primary_color || COLORS.primary;
    const firmName = branding?.firm_name || 'Ledger AI';
    const reportType = getReportType(type);

    // Full page background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.lightBg);

    // Top bar
    doc.rect(0, 0, doc.page.width, 6).fill(primaryColor);

    // ✅ Main Title - Large and centered
    doc.fillColor(primaryColor)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(reportType, MARGINS.left, 80, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // ✅ Business Name - Large
    doc.fillColor(COLORS.text)
        .fontSize(24)
        .font('Helvetica')
        .text(report.business_name, MARGINS.left, 130, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // ✅ Subtitle
    let y = 180;
    if (additionalInfo.subtitle) {
        doc.fillColor(COLORS.gray)
            .fontSize(12)
            .font('Helvetica')
            .text(additionalInfo.subtitle, MARGINS.left, y, {
                width: doc.page.width - 100,
                align: 'center',
            });
        y += 30;
    }

    // ✅ Period
    if (additionalInfo.period) {
        doc.fillColor(COLORS.gray)
            .fontSize(10)
            .font('Helvetica')
            .text(additionalInfo.period, MARGINS.left, y, {
                width: doc.page.width - 100,
                align: 'center',
            });
        y += 25;
    }

    // ✅ Prepared date
    doc.fillColor(COLORS.gray)
        .fontSize(10)
        .font('Helvetica')
        .text(`Prepared: ${formatDate(new Date())}`, MARGINS.left, y, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // ✅ Disclaimers section (bottom)
    const bottomY = doc.page.height - 80;
    doc.rect(MARGINS.left, bottomY, doc.page.width - 100, 1).fill(COLORS.border);

    doc.fillColor(COLORS.gray)
        .fontSize(7)
        .font('Helvetica')
        .text('This report was generated with AI-assisted categorization of financial transactions provided by the business owner.', MARGINS.left, bottomY + 10, {
            width: doc.page.width - 100,
            align: 'center',
        });
    doc.text('It has not been audited, reviewed, or compiled in accordance with ICAI or other professional accounting standards.', MARGINS.left, bottomY + 22, {
        width: doc.page.width - 100,
        align: 'center',
    });

    // Firm name at bottom
    if (branding?.firm_name) {
        doc.fillColor(primaryColor)
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(firmName, MARGINS.left, bottomY + 40, {
                width: doc.page.width - 100,
                align: 'center',
            });
    }
}

module.exports = { coverPage };