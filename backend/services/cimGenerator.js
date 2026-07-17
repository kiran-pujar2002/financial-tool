// services/cimGenerator.js
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
};

async function generateCIM({ report, transactions, addbacks, metrics, branding, user }) {
    const outputDir = path.join(__dirname, '../reports/cims');
    fs.mkdirSync(outputDir, { recursive: true });
    
    const filename = `CIM-${report.business_name.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
                Title: `CIM - ${report.business_name}`,
                Author: branding?.firm_name || 'Ledger AI',
                Subject: 'Confidential Information Memorandum'
            }
        });
        
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Generate all sections
        coverPage(doc, report, branding);
        doc.addPage();
        
        executiveSummary(doc, report, metrics);
        doc.addPage();
        
        businessOverview(doc, report);
        doc.addPage();
        
        financialPerformance(doc, report, metrics);
        doc.addPage();
        
        addbackAnalysis(doc, addbacks, metrics);
        doc.addPage();
        
        keySellingPoints(doc, report, metrics);
        doc.addPage();
        
        valuationGuidance(doc, metrics);
        doc.addPage();
        
        disclaimerPage(doc, branding);

        // ✅ FIX: Add page numbers using a different method
        addPageNumbers(doc);

        doc.end();
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
}

// ============================================================
// Add Page Numbers (Fixed - Using event listener approach)
// ============================================================
function addPageNumbers(doc) {
    // Get the total number of pages
    const range = doc.bufferedPageRange();
    const totalPages = range ? range.count : 1;
    
    // Add page numbers to each page
    for (let i = 0; i < totalPages; i++) {
        try {
            doc.switchToPage(i);
            doc.fillColor(COLORS.gray)
                .fontSize(8)
                .font('Helvetica')
                .text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 30, {
                    align: 'center',
                    width: 495
                });
        } catch (err) {
            // If switchToPage fails, skip this page
            console.warn(`Could not add page number to page ${i}:`, err.message);
        }
    }
}

// ============================================================
// COVER PAGE
// ============================================================
function coverPage(doc, report, branding) {
    const primaryColor = branding?.primary_color || COLORS.primary;
    
    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.lightBg);
    doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
    
    // CONFIDENTIAL banner
    doc.fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('CONFIDENTIAL', 50, 60, {
            width: 495,
            align: 'center',
            characterSpacing: 4
        });
    
    // Title
    doc.fillColor(primaryColor)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('Confidential Information Memorandum', 50, 120, {
            width: 495,
            align: 'center'
        });
    
    doc.moveTo(50, 170)
        .lineTo(545, 170)
        .strokeColor(COLORS.gold)
        .lineWidth(2)
        .stroke();
    
    // Business Name
    doc.fillColor(COLORS.text)
        .fontSize(26)
        .font('Helvetica')
        .text(report.business_name, 50, 200, {
            width: 495,
            align: 'center'
        });
    
    // Industry
    if (report.industry) {
        doc.fillColor(COLORS.gray)
            .fontSize(12)
            .font('Helvetica')
            .text(report.industry, 50, 245, {
                width: 495,
                align: 'center'
            });
    }
    
    // Bottom
    const bottomY = doc.page.height - 100;
    doc.rect(50, bottomY, 495, 1).fill(COLORS.border);
    
    if (branding?.firm_name) {
        doc.fillColor(primaryColor)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(branding.firm_name, 50, bottomY + 15, {
                width: 495,
                align: 'center'
            });
    }
    
    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .font('Helvetica')
        .text(`Prepared: ${new Date().toLocaleDateString()}`, 50, bottomY + 35, {
            width: 495,
            align: 'center'
        });
}

// ============================================================
// EXECUTIVE SUMMARY
// ============================================================
function executiveSummary(doc, report, metrics) {
    sectionHeader(doc, 'Executive Summary');
    
    const revenueLakhs = (metrics.totalRevenue / 100000).toFixed(1);
    const ebitdaLakhs = (metrics.ebitda / 100000).toFixed(1);
    const sdeLakhs = (metrics.sde / 100000).toFixed(1);
    
    const summary = `This Confidential Information Memorandum ("CIM") has been prepared to provide prospective buyers with an overview of ${report.business_name}, a ${report.industry || 'business'} with strong historical performance and significant growth potential.

The business generated ₹${revenueLakhs} Lakhs in revenue with an EBITDA of ₹${ebitdaLakhs} Lakhs and Seller's Discretionary Earnings (SDE) of ₹${sdeLakhs} Lakhs.

The company presents a compelling acquisition opportunity for strategic buyers, financial investors, or entrepreneurs looking to enter or expand in the ${report.industry || 'industry'} sector.`;
    
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text(summary, 50, doc.y, {
            width: 495,
            lineGap: 4,
            align: 'justify'
        });
    
    doc.moveDown(2);
    
    // Key highlights
    const highlights = [
        ['Revenue', `₹${revenueLakhs} Lakhs`],
        ['EBITDA', `₹${ebitdaLakhs} Lakhs`],
        ['SDE', `₹${sdeLakhs} Lakhs`],
        ['Add-backs', `₹${(metrics.totalAddbacks / 100000).toFixed(1)} Lakhs`],
    ];
    
    doc.fillColor(COLORS.text)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Financial Highlights', 50, doc.y);
    
    doc.moveDown(0.5);
    
    for (const [label, value] of highlights) {
        doc.rect(50, doc.y, 240, 25).fill(doc.y % 50 === 50 ? COLORS.lightBg : COLORS.white);
        doc.fillColor(COLORS.text)
            .fontSize(9)
            .font('Helvetica')
            .text(label, 60, doc.y + 7);
        doc.text(value, 60, doc.y + 7, { width: 170, align: 'right' });
        doc.y += 25;
    }
}

// ============================================================
// BUSINESS OVERVIEW
// ============================================================
function businessOverview(doc, report) {
    sectionHeader(doc, 'Business Overview');
    
    const overview = `${report.business_name} is a ${report.industry || 'business'} operating in the ${report.industry || 'industry'} sector. The business has demonstrated consistent performance and maintains a strong market position.

The company benefits from established operations, recurring revenue streams, and a loyal customer base. The current management team has built a scalable business model that presents significant growth opportunities for a new owner.`;
    
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text(overview, 50, doc.y, {
            width: 495,
            lineGap: 4,
            align: 'justify'
        });
    
    doc.moveDown(2);
    
    // Key strengths
    const strengths = [
        `Established operations with proven business model`,
        `Strong market position in the ${report.industry || 'industry'} sector`,
        'Skilled workforce and operational expertise',
        'Opportunity for strategic growth and expansion'
    ];
    
    doc.fillColor(COLORS.text)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Key Strengths', 50, doc.y);
    
    doc.moveDown(0.5);
    
    for (const strength of strengths) {
        doc.fillColor(COLORS.text)
            .fontSize(9)
            .font('Helvetica')
            .text('✓ ' + strength, 50, doc.y);
        doc.y += 15;
    }
}

// ============================================================
// FINANCIAL PERFORMANCE
// ============================================================
function financialPerformance(doc, report, metrics) {
    sectionHeader(doc, 'Financial Performance');
    
    const data = [
        ['Revenue', `₹${(metrics.totalRevenue / 100000).toFixed(1)} Lakhs`],
        ['EBITDA', `₹${(metrics.ebitda / 100000).toFixed(1)} Lakhs`],
        ['SDE', `₹${(metrics.sde / 100000).toFixed(1)} Lakhs`],
        ['Total Add-backs', `₹${(metrics.totalAddbacks / 100000).toFixed(1)} Lakhs`],
    ];
    
    table(doc, ['Metric', 'Amount'], data);
}

// ============================================================
// ADDBACK ANALYSIS
// ============================================================
function addbackAnalysis(doc, addbacks, metrics) {
    sectionHeader(doc, 'Add-Back Analysis');
    
    doc.fillColor(COLORS.textLight)
        .fontSize(9)
        .font('Helvetica')
        .text('The following adjustments have been identified to normalize earnings for a new owner:', 50, doc.y);
    doc.moveDown(0.5);
    
    if (!addbacks || addbacks.length === 0) {
        doc.fillColor(COLORS.gray)
            .fontSize(10)
            .text('No add-backs identified.', 50, doc.y);
        return;
    }
    
    const data = addbacks.map(a => [
        a.label || 'Other Add-back',
        `₹${(a.amount / 100000).toFixed(1)} Lakhs`
    ]);
    data.push(['Total Add-backs', `₹${(metrics.totalAddbacks / 100000).toFixed(1)} Lakhs`]);
    
    table(doc, ['Adjustment', 'Amount'], data);
}

// ============================================================
// KEY SELLING POINTS
// ============================================================
function keySellingPoints(doc, report, metrics) {
    sectionHeader(doc, 'Why Buy This Business?');
    
    const points = [
        'Established business with proven financial performance',
        'Strong market position with growth opportunities',
        'Owner can transition with a structured handover',
        'Potential for expansion into new markets or product lines',
        'Attractive valuation based on normalized earnings'
    ];
    
    for (let i = 0; i < points.length; i++) {
        const y = doc.y;
        doc.rect(50, y, 495, 35).fill(y % 70 === 50 ? COLORS.lightBg : COLORS.white);
        doc.fillColor(COLORS.primary)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(`${i + 1}`, 60, y + 8);
        doc.fillColor(COLORS.text)
            .fontSize(10)
            .font('Helvetica')
            .text(points[i], 85, y + 8, { width: 440 });
        doc.y = y + 35;
    }
}

// ============================================================
// VALUATION GUIDANCE
// ============================================================
function valuationGuidance(doc, metrics) {
    sectionHeader(doc, 'Valuation Guidance');
    
    const baseValue = metrics.sde || metrics.ebitda || 0;
    const multiple = 3.0;
    const estimatedValue = baseValue * multiple;
    const estimatedLakhs = (estimatedValue / 100000).toFixed(1);
    
    doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica')
        .text('Based on the normalized earnings and current market multiples, the indicative valuation range is:', 50, doc.y);
    doc.moveDown(0.5);
    
    doc.roundedRect(50, doc.y, 495, 60, 8)
        .fill(COLORS.lightBg)
        .stroke(COLORS.border);
    
    doc.fillColor(COLORS.accent)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(`₹${estimatedLakhs} Lakhs`, 70, doc.y + 15);
    
    doc.fillColor(COLORS.gray)
        .fontSize(10)
        .font('Helvetica')
        .text('Estimated Business Value', 70, doc.y + 42);
    
    doc.y += 80;
    doc.fillColor(COLORS.gray)
        .fontSize(8)
        .font('Helvetica')
        .text('* This is an indicative valuation based on current financials and market multiples.',
            50, doc.y, { width: 495, align: 'center' });
}

// ============================================================
// DISCLAIMER
// ============================================================
function disclaimerPage(doc, branding) {
    sectionHeader(doc, 'Disclaimer');
    
    const text = branding?.disclaimer_text ||
        `This Confidential Information Memorandum (CIM) has been prepared by ${branding?.firm_name || 'Ledger AI'} for informational purposes only.

        This document does not constitute an offer to sell or a solicitation of an offer to buy any securities. All information contained herein is confidential and intended solely for the recipient.

        The financial information contained in this document has been provided by the business owner and has not been independently verified. Prospective buyers should conduct their own due diligence before making any investment decision.

        This document is based on assumptions and projections that may change over time. Past performance is not indicative of future results.`;
    
    doc.fillColor(COLORS.textLight)
        .fontSize(8)
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
    const colWidths = [300, 195];
    let y = doc.y;
    
    // Header
    doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 24).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(headers[0], 60, y + 7, { width: colWidths[0] - 20 });
    doc.text(headers[1], 50 + colWidths[0] + 6, y + 7, {
        width: colWidths[1] - 12,
        align: 'right'
    });
    
    y += 24;
    
    // Rows
    for (let i = 0; i < rows.length; i++) {
        const bg = i % 2 === 0 ? COLORS.white : COLORS.lightBg;
        doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 22).fill(bg);
        doc.fillColor(COLORS.text)
            .fontSize(9)
            .font('Helvetica')
            .text(rows[i][0], 60, y + 5, { width: colWidths[0] - 20 });
        doc.text(rows[i][1], 50 + colWidths[0] + 6, y + 5, {
            width: colWidths[1] - 12,
            align: 'right'
        });
        y += 22;
    }
    
    doc.y = y + 20;
}

module.exports = { generateCIM };