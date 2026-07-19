// services/pdf/shared/coverPage.js
const { COLORS, FONTS, SIZES, MARGINS } = require('./styles');
const { formatDate, getReportType } = require('./helpers');

function coverPage(doc, report, branding, type, additionalInfo = {}) {
    const primaryColor = branding?.primary_color || COLORS.primary;
    const firmName = branding?.firm_name || 'Ledger AI';
    const reportType = getReportType(type);

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.lightBg);

    // Top bar
    doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);

    // CONFIDENTIAL
    doc.fillColor(primaryColor)
        .fontSize(SIZES.small)
        .font(FONTS.title)
        .text('CONFIDENTIAL', MARGINS.left, 60, {
            width: doc.page.width - 100,
            align: 'center',
            characterSpacing: 4,
        });

    // Title
    doc.fillColor(primaryColor)
        .fontSize(SIZES.title)
        .font(FONTS.title)
        .text(reportType, MARGINS.left, 120, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // Decorative line
    doc.moveTo(MARGINS.left, 170)
        .lineTo(doc.page.width - MARGINS.right, 170)
        .strokeColor(COLORS.gold)
        .lineWidth(2)
        .stroke();

    // Business Name
    doc.fillColor(COLORS.text)
        .fontSize(26)
        .font(FONTS.body)
        .text(report.business_name, MARGINS.left, 200, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // Subtitle / Additional info
    let y = 245;
    if (additionalInfo.subtitle) {
        doc.fillColor(COLORS.gray)
            .fontSize(SIZES.subheading)
            .font(FONTS.body)
            .text(additionalInfo.subtitle, MARGINS.left, y, {
                width: doc.page.width - 100,
                align: 'center',
            });
        y += 30;
    }

    if (additionalInfo.period) {
        doc.fillColor(COLORS.gray)
            .fontSize(SIZES.body)
            .text(additionalInfo.period, MARGINS.left, y, {
                width: doc.page.width - 100,
                align: 'center',
            });
        y += 25;
    }

    doc.fillColor(COLORS.gray)
        .fontSize(SIZES.body)
        .text(`Prepared: ${formatDate(new Date())}`, MARGINS.left, y, {
            width: doc.page.width - 100,
            align: 'center',
        });

    // Bottom section
    const bottomY = doc.page.height - 100;
    doc.rect(MARGINS.left, bottomY, doc.page.width - 100, 1).fill(COLORS.border);

    if (branding?.firm_name) {
        doc.fillColor(primaryColor)
            .fontSize(SIZES.body)
            .font(FONTS.title)
            .text(firmName, MARGINS.left, bottomY + 15, {
                width: doc.page.width - 100,
                align: 'center',
            });
    }

    if (branding?.contact_email || branding?.contact_phone) {
        const contact = [branding.contact_email, branding.contact_phone]
            .filter(Boolean)
            .join('  |  ');
        doc.fillColor(COLORS.gray)
            .fontSize(SIZES.small)
            .font(FONTS.body)
            .text(contact, MARGINS.left, bottomY + 35, {
                width: doc.page.width - 100,
                align: 'center',
            });
    }
}

module.exports = { coverPage };