// services/pdf/index.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const { coverPage } = require('./shared/coverPage');
const { addPageNumbers } = require('./shared/footer');
const { generateQOEContent } = require('./generators/qoe');
const { generateCIMContent } = require('./generators/cim');
const { generateValuationContent } = require('./generators/valuation');
const { generateDDContent } = require('./generators/dd');
const { getReportType } = require('./shared/helpers');

async function generatePDF({
    type,
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

        console.log('📄 Generating PDF for:', report.business_name);
        console.log('📄 Type:', type);

        // ✅ Generate cover page FIRST
        coverPage(doc, report, branding, type, data.coverInfo || {});
        doc.addPage();

        // ✅ Generate content based on type
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

        // ✅ Add page numbers last
        addPageNumbers(doc, branding);

        doc.end();
        stream.on('finish', () => {
            console.log('✅ PDF generated:', outputPath);
            resolve(outputPath);
        });
        stream.on('error', reject);
    });
}

module.exports = { generatePDF };