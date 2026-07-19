// services/pdf/index.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Shared components
const { coverPage } = require('./shared/coverPage');
const { addPageNumbers } = require('./shared/footer');

// Generators
const { generateQOEContent } = require('./generators/qoe');
const { generateCIMContent } = require('./generators/cim');
const { generateValuationContent } = require('./generators/valuation');
const { generateDDContent } = require('./generators/dd');

// Helpers
const { getReportType } = require('./shared/helpers');

// ============================================================
// MAIN PDF GENERATOR - Unified Entry Point
// ============================================================

async function generatePDF({
    type,           // 'qoe', 'cim', 'valuation', 'dd'
    report,
    data,
    branding,
    outputPath,
}) {
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            bufferPages: true,
            info: {
                Title: `${getReportType(type)} - ${report.business_name}`,
                Author: branding?.firm_name || 'Ledger AI',
            },
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // 1. Cover Page
        coverPage(doc, report, branding, type, data.coverInfo || {});
        doc.addPage();

        // 2. Generate specific content based on type
        const generators = {
            qoe: generateQOEContent,
            cim: generateCIMContent,
            valuation: generateValuationContent,
            dd: generateDDContent,
        };

        const generator = generators[type];
        if (!generator) {
            throw new Error(`Unknown report type: ${type}`);
        }

        generator(doc, report, data);

        // 3. Add page numbers
        addPageNumbers(doc, branding);

        doc.end();
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
}

module.exports = { generatePDF };