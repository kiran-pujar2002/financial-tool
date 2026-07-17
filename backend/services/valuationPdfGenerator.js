// services/valuationPdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COLORS = {
    primary: '#1a3a5c',
    secondary: '#2e7d32',
    accent: '#4F46E5',
    gold: '#c9a84c',
    text: '#1a202c',
    textLight: '#4a5568',
    gray: '#718096',
    lightBg: '#f7fafc',
    border: '#e2e8f0',
    white: '#ffffff',
    red: '#e53e3e',
};

async function generateValuationReport({ report, valuation, branding, user }) {
    const outputDir = path.join(__dirname, '../reports/valuations');
    fs.mkdirSync(outputDir, { recursive: true });
    
    const filename = `valuation-${report.id}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            size: 'A4', 
            margin: 50,
            info: {
                Title: `Valuation Report - ${report.business_name}`,
                Author: branding?.firm_name || 'Ledger AI',
                Subject: 'Business Valuation Report'
            }
        });
        
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // ========== COVER PAGE ==========
        coverPage(doc, report, branding, valuation);
        doc.addPage();

        // ========== VALUATION SUMMARY ==========
        valuationSummaryPage(doc, report, valuation);
        doc.addPage();

        // ========== VALUATION METHODOLOGY ==========
        methodologyPage(doc, valuation);
        doc.addPage();

        // ========== RISK ADJUSTMENTS ==========
        riskAdjustmentsPage(doc, valuation);
        doc.addPage();

        // ========== COMPARABLES ==========
        comparablesPage(doc, report);
        doc.addPage();

        // ========== FINANCIAL SUMMARY ==========
        financialSummaryPage(doc, report);
        doc.addPage();

        // ========== DISCLAIMER ==========
        disclaimerPage(doc, branding);

        // Add page numbers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);
            doc.fillColor(COLORS.gray)
                .fontSize(8)
                .font('Helvetica')
                .text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 30, { 
                    align: 'center', 
                    width: 495 
                });
        }

        doc.end();
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
}

// ============================================================
// COVER PAGE
// ============================================================
function coverPage(doc, report, branding, valuation) {
    const primaryColor = branding?.primary_color || COLORS.primary;
    
    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.lightBg);
    
    // Top bar
    doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
    
    // Logo / Branding
    if (branding?.firm_name) {
        doc.fillColor(primaryColor)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(branding.firm_name, 50, 60);
    }
    
    // Title
    doc.fillColor(primaryColor)
        .fontSize(32)
        .font('Helvetica-Bold')
        .text('Business Valuation Report', 50, 120, { width: 495, align: 'center' });
    
    doc.moveTo(50, 170)
        .lineTo(545, 170)
        .strokeColor(COLORS.gold)
        .lineWidth(2)
        .stroke();
    
    // Business Name
    doc.fillColor(COLORS.text)
        .fontSize(24)
        .font('Helvetica')
        .text(report.business_name, 50, 195, { width: 495, align: 'center' });
    
    // Valuation Value
    const valueStr = Number(valuation.selected_value || valuation.value_mid || 0)
        .toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    
    doc.fillColor(COLORS.accent)
        .fontSize(36)
        .font('Helvetica-Bold')
        .text(valueStr, 50, 250, { width: 495, align: 'center' });
    
    doc.fillColor(COLORS.gray)
        .fontSize(12)
        .font('Helvetica')
        .text('Estimated Business Value', 50, 300, { width: 495, align: 'center' });
    
    // Range
    const minStr = Number(valuation.value_min || 0)
        .toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    const maxStr = Number(valuation.value_max || 0)
        .toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    
    doc.fillColor(COLORS.gray)
        .fontSize(10)
        .font('Helvetica')
        .text(`Valuation Range: ${minStr} – ${maxStr}`, 50, 330, { width: 495, align: 'center' });
    
    // Footer
    const bottomY = doc.page.height - 80;
    doc.rect(50, bottomY, 495, 1).fill(COLORS.border);
    
    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .font('Helvetica')
        .text(`Prepared: ${new Date().toLocaleDateString()}`, 50, bottomY + 15);
    
    if (branding?.contact_email || branding?.contact_phone) {
        const contact = [branding.contact_email, branding.contact_phone].filter(Boolean).join('  |  ');
        doc.text(contact, 50, bottomY + 30);
    }
}

// ============================================================
// VALUATION SUMMARY
// ============================================================
function valuationSummaryPage(doc, report, valuation) {
    sectionHeader(doc, 'Valuation Summary');
    
    const mid = Number(valuation.value_mid || 0);
    const min = Number(valuation.value_min || 0);
    const max = Number(valuation.value_max || 0);
    
    // Main valuation box
    doc.roundedRect(50, doc.y, 495, 60, 8)
        .fill(COLORS.lightBg)
        .stroke(COLORS.border);
    
    doc.fillColor(COLORS.accent)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(
            mid.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }),
            70, doc.y + 15
        );
    
    doc.fillColor(COLORS.gray)
        .fontSize(10)
        .font('Helvetica')
        .text('Estimated Business Value', 70, doc.y + 42);
    
    doc.y += 80;
    
    // Valuation details
    const details = [
        ['Valuation Method', valuation.method.toUpperCase()],
        ['Multiple Used', `${valuation.multiple_used}x`],
        ['Financial Metric', valuation.method === 'sde' ? 'SDE' : valuation.method === 'ebitda' ? 'EBITDA' : 'Revenue'],
        ['Base Value', Number(valuation.adjustments?.baseValue || 0)
            .toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })],
        ['Risk Adjustment Factor', `${((1 - (valuation.adjustments?.adjustmentFactor || 1)) * 100).toFixed(0)}%`],
    ];
    
    for (const [label, value] of details) {
        doc.rect(50, doc.y, 495, 28).fill(doc.y % 56 === 50 ? COLORS.lightBg : COLORS.white);
        doc.fillColor(COLORS.text)
            .fontSize(10)
            .font('Helvetica')
            .text(label, 60, doc.y + 8, { width: 200 });
        doc.text(value, 300, doc.y + 8, { width: 200, align: 'right' });
        doc.y += 28;
    }
    
    doc.y += 20;
    
    // Valuation Range
    doc.fillColor(COLORS.text)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Valuation Range', 50, doc.y);
    
    doc.y += 20;
    
    // Range bars
    const barY = doc.y;
    const barWidth = 400;
    const barX = 70;
    
    doc.roundedRect(barX, barY, barWidth, 20, 4).fill(COLORS.border);
    
    const minPct = 0;
    const midPct = ((mid - min) / (max - min || 1)) * 100;
    const maxPct = 100;
    
    // Low range
    doc.roundedRect(barX, barY, barWidth * (midPct / 100), 20, 4).fill('#fbbf24');
    // Mid range
    doc.roundedRect(barX + barWidth * (midPct / 100) - 2, barY, 4, 20, 2).fill(COLORS.accent);
    
    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .font('Helvetica')
        .text('Low', barX, barY + 25)
        .text('Mid', barX + (barWidth / 2) - 10, barY + 25)
        .text('High', barX + barWidth - 25, barY + 25);
}

// ============================================================
// METHODOLOGY PAGE
// ============================================================
function methodologyPage(doc, valuation) {
    sectionHeader(doc, 'Valuation Methodology');
    
    const methods = {
        sde: {
            name: 'SDE Multiple Method',
            description: 'Seller\'s Discretionary Earnings (SDE) is the most common valuation method for main-street businesses. It adds back owner benefits to EBITDA to reflect the true earning capacity for a new owner.',
            formula: 'SDE × Industry Multiple = Business Value'
        },
        ebitda: {
            name: 'EBITDA Multiple Method',
            description: 'Enterprise Value is calculated by applying an industry multiple to EBITDA. This method is commonly used for larger businesses and M&A transactions.',
            formula: 'EBITDA × Industry Multiple = Enterprise Value'
        },
        revenue: {
            name: 'Revenue Multiple Method',
            description: 'Revenue multiples are used for businesses with high growth but low profitability. This is common in technology and service businesses.',
            formula: 'Revenue × Industry Multiple = Business Value'
        }
    };
    
    const method = methods[valuation.method] || methods.sde;
    
    doc.fillColor(COLORS.text)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(method.name, 50, doc.y);
    
    doc.y += 20;
    doc.fillColor(COLORS.textLight)
        .fontSize(10)
        .font('Helvetica')
        .text(method.description, 50, doc.y, { width: 495 });
    
    doc.y += 20;
    doc.roundedRect(50, doc.y, 495, 30, 4).fill(COLORS.lightBg);
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text('Formula:', 60, doc.y + 8)
        .text(method.formula, 140, doc.y + 8);
    
    doc.y += 50;
}

// ============================================================
// RISK ADJUSTMENTS
// ============================================================
function riskAdjustmentsPage(doc, valuation) {
    sectionHeader(doc, 'Risk Adjustments Applied');
    
    const adjustments = valuation.adjustments?.adjustments || [];
    const factor = valuation.adjustments?.adjustmentFactor || 1;
    
    doc.fillColor(COLORS.textLight)
        .fontSize(9)
        .font('Helvetica')
        .text(`Total adjustment factor: ${((1 - factor) * 100).toFixed(0)}% reduction`, 50, doc.y);
    
    doc.y += 20;
    
    if (adjustments.length === 0) {
        doc.fillColor(COLORS.gray)
            .fontSize(10)
            .text('No risk adjustments applied.', 50, doc.y);
        return;
    }
    
    for (const risk of adjustments) {
        doc.rect(50, doc.y, 495, 35).fill(doc.y % 70 === 50 ? COLORS.lightBg : COLORS.white);
        doc.fillColor(COLORS.text)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(risk.name, 60, doc.y + 6);
        doc.fillColor(COLORS.textLight)
            .fontSize(8)
            .font('Helvetica')
            .text(risk.description || '', 60, doc.y + 22);
        doc.fillColor(COLORS.red)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`-${(risk.factor * 100).toFixed(0)}%`, 450, doc.y + 6);
        doc.y += 35;
    }
}

// ============================================================
// COMPARABLES PAGE
// ============================================================
function comparablesPage(doc, report) {
    sectionHeader(doc, 'Comparable Transactions');
    
    doc.fillColor(COLORS.textLight)
        .fontSize(9)
        .font('Helvetica')
        .text('Comparable transaction data is limited. Multiples are based on industry averages.', 50, doc.y);
    
    doc.y += 20;
    
    // Industry multiples table
    const headers = ['Metric', 'Multiple', 'Range'];
    const data = [
        ['SDE Multiple', '3.0x', '2.0x – 4.5x'],
        ['EBITDA Multiple', '4.0x', '3.0x – 6.0x'],
        ['Revenue Multiple', '1.0x', '0.5x – 2.0x'],
    ];
    
    table(doc, headers, data);
}

// ============================================================
// FINANCIAL SUMMARY
// ============================================================
function financialSummaryPage(doc, report) {
    sectionHeader(doc, 'Financial Summary');
    
    const metrics = [
        ['Revenue', report.total_revenue],
        ['EBITDA', report.ebitda],
        ['SDE', report.sde],
        ['Total Add-backs', report.total_addbacks],
    ];
    
    let y = doc.y + 10;
    for (const [label, value] of metrics) {
        doc.rect(50, y, 495, 28).fill(y % 56 === 50 ? COLORS.lightBg : COLORS.white);
        doc.fillColor(COLORS.text)
            .fontSize(10)
            .font('Helvetica')
            .text(label, 60, y + 8);
        doc.fillColor(COLORS.text)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(
                Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }),
                450, y + 8,
                { align: 'right' }
            );
        y += 28;
    }
}

// ============================================================
// DISCLAIMER
// ============================================================
function disclaimerPage(doc, branding) {
    sectionHeader(doc, 'Disclaimer');
    
    const text = branding?.disclaimer_text || 
        `This valuation report is provided for informational purposes only and does not constitute financial, investment, or legal advice. The valuation is based on the financial data provided and industry averages, which may not reflect current market conditions.

        This report should not be the sole basis for any transaction decision. We recommend consulting with qualified financial advisors, attorneys, and tax professionals before making any business decisions.

        The valuation is estimated based on the methodology selected and is not guaranteed. Actual sale prices may vary based on market conditions, buyer interest, and other factors.`;
    
    doc.fillColor(COLORS.textLight)
        .fontSize(9)
        .font('Helvetica')
        .text(text, 50, doc.y, { 
            width: 495, 
            lineGap: 4,
            align: 'justify' 
        });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function sectionHeader(doc, title) {
    doc.fillColor(COLORS.primary)
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(title);
    doc.moveTo(50, doc.y + 4)
        .lineTo(545, doc.y + 4)
        .strokeColor(COLORS.gold)
        .lineWidth(1.5)
        .stroke();
    doc.moveDown(1.2);
    doc.font('Helvetica');
}

function table(doc, headers, rows) {
    const colWidths = [150, 150, 195];
    let y = doc.y;
    
    // Header
    doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 24).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(headers[0], 56, y + 7, { width: colWidths[0] - 12 });
    doc.text(headers[1], 50 + colWidths[0] + 6, y + 7, { width: colWidths[1] - 12 });
    doc.text(headers[2], 50 + colWidths[0] + colWidths[1] + 6, y + 7, { width: colWidths[2] - 12 });
    
    y += 24;
    
    // Rows
    for (let i = 0; i < rows.length; i++) {
        const bg = i % 2 === 0 ? COLORS.white : COLORS.lightBg;
        doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 22).fill(bg);
        doc.fillColor(COLORS.text)
            .fontSize(8)
            .font('Helvetica')
            .text(rows[i][0], 56, y + 5, { width: colWidths[0] - 12 });
        doc.text(rows[i][1], 50 + colWidths[0] + 6, y + 5, { width: colWidths[1] - 12 });
        doc.text(rows[i][2], 50 + colWidths[0] + colWidths[1] + 6, y + 5, { width: colWidths[2] - 12 });
        y += 22;
    }
    
    doc.y = y + 20;
}

module.exports = { generateValuationReport };