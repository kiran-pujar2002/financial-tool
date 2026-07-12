const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const BRAND_COLOR = '#1a3a5c';
const ACCENT_COLOR = '#2e7d32';
const GRAY = '#666666';

function generateReportPdf({ report, transactions, addbackSchedule, metrics, executiveSummary, outputPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    coverPage(doc, report);
    doc.addPage();
    disclaimerPage(doc);
    doc.addPage();
    executiveSummaryPage(doc, report, metrics, executiveSummary);
    doc.addPage();
    normalizedPnLPage(doc, metrics);
    doc.addPage();
    addbackSchedulePage(doc, addbackSchedule, metrics);
    doc.addPage();
    keyRatiosPage(doc, metrics);
    doc.addPage();
    transactionDetailPages(doc, transactions);

    addPageNumbers(doc);

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

function coverPage(doc, report) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7f9fb');
  doc.fillColor(BRAND_COLOR)
    .fontSize(12).text('CONFIDENTIAL', 50, 80, { characterSpacing: 2 });
  doc.moveDown(4);
  doc.fillColor('#111').fontSize(30).font('Helvetica-Bold')
    .text('Quality of Earnings Report', 50, 200, { width: 495 });
  doc.moveDown(0.5);
  doc.fontSize(20).font('Helvetica').fillColor(GRAY)
    .text(report.business_name || 'Business Name', { width: 495 });
  doc.moveDown(2);
  doc.fontSize(11).fillColor(GRAY);
  if (report.period_start && report.period_end) {
    doc.text(`Period: ${formatDate(report.period_start)} – ${formatDate(report.period_end)}`);
  }
  doc.text(`Prepared: ${formatDate(new Date())}`);
  doc.moveDown(6);
  doc.fontSize(9).fillColor('#999')
    .text('Prepared using AI-assisted financial normalization. This report is a supporting analytical tool and does not constitute an audit, review, or compilation under AICPA/ICAI standards.', 50, doc.page.height - 130, { width: 495 });
}

function disclaimerPage(doc) {
  sectionHeader(doc, 'Important Disclaimers');
  const points = [
    'This report was generated with AI-assisted categorization of financial transactions provided by the business owner or their representative. It has not been audited, reviewed, or compiled in accordance with AICPA, ICAI, or other professional accounting standards.',
    'Add-back determinations reflect a reasonable, good-faith interpretation of the source data and are subject to review and adjustment by the preparing broker, the business owner, and any party relying on this report, including buyers, lenders, and their advisors.',
    'EBITDA and Seller\u2019s Discretionary Earnings (SDE) are calculated using industry-standard main-street business brokerage conventions, which may differ from formal GAAP or IFRS-based adjustments used in larger M&A transactions.',
    'This report does not constitute investment, legal, or tax advice. Recipients should engage a licensed CPA, attorney, or financial advisor before relying on this report for a transaction, financing, or valuation decision.',
    'Figures are only as accurate as the source data provided. Uploading incomplete or inaccurate financial records will produce a materially inaccurate report.',
    'Neither the preparer nor the platform generating this report guarantees the accuracy, completeness, or fitness of this report for any particular purpose, and disclaims liability for decisions made in reliance on it.',
  ];
  doc.fontSize(10.5).fillColor('#222');
  for (const p of points) {
    doc.circle(55, doc.y + 5, 1.5).fill('#333');
    doc.fillColor('#222').text(p, 68, doc.y, { width: 475 });
    doc.moveDown(0.8);
  }
}

function executiveSummaryPage(doc, report, metrics, executiveSummary) {
  sectionHeader(doc, 'Executive Summary');
  doc.fontSize(11).fillColor('#222')
    .text(executiveSummary || 'Executive summary unavailable.', { width: 495, lineGap: 4 });
  doc.moveDown(2);

  const cards = [
    ['Total Revenue', metrics.totalRevenue],
    ['Net Income', metrics.netIncome],
    ['EBITDA', metrics.ebitda],
    ['SDE', metrics.sde],
  ];
  let x = 50;
  const y = doc.y + 10;
  const cardWidth = 110;
  for (const [label, value] of cards) {
    doc.roundedRect(x, y, cardWidth, 70, 6).fillAndStroke('#eef3f8', '#dbe4ec');
    doc.fillColor(GRAY).fontSize(8.5).text(label.toUpperCase(), x + 10, y + 12, { width: cardWidth - 20, characterSpacing: 0.5 });
    doc.fillColor(BRAND_COLOR).fontSize(15).font('Helvetica-Bold')
      .text(formatCurrency(value), x + 10, y + 32, { width: cardWidth - 20 });
    doc.font('Helvetica');
    x += cardWidth + 15;
  }
  doc.y = y + 90;
}

function normalizedPnLPage(doc, metrics) {
  sectionHeader(doc, 'Normalized Profit & Loss Statement');
  const rows = Object.entries(metrics.categoryBreakdown).filter(([cat]) => cat !== 'Revenue');
  table(doc, ['Category', 'Amount'], [
    ['Revenue', formatCurrency(metrics.totalRevenue)],
    ...rows.map(([cat, amt]) => [cat, formatCurrency(-Math.abs(amt))]),
    ['__divider__', ''],
    ['Net Income', formatCurrency(metrics.netIncome)],
    ['EBITDA', formatCurrency(metrics.ebitda)],
    ['SDE', formatCurrency(metrics.sde)],
  ]);
}

function addbackSchedulePage(doc, addbackSchedule, metrics) {
  sectionHeader(doc, 'Add-Back Schedule');
  doc.fontSize(10).fillColor(GRAY)
    .text('The following items were identified as personal, discretionary, or non-recurring expenses added back to EBITDA to calculate Seller\u2019s Discretionary Earnings (SDE). Each should be reviewed and confirmed by the business owner.', { width: 495 });
  doc.moveDown(1);

  if (!addbackSchedule.length) {
    doc.fontSize(10).fillColor('#222').text('No add-backs were identified in the source data.');
    return;
  }

  table(doc, ['Add-Back Item', 'Occurrences', 'Amount'],
    addbackSchedule.map((a) => [a.label, String(a.count), formatCurrency(a.amount)])
  );
  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND_COLOR)
    .text(`Total Add-Backs: ${formatCurrency(metrics.totalAddbacks)}`);
  doc.font('Helvetica');
}

function keyRatiosPage(doc, metrics) {
  sectionHeader(doc, 'Key Ratios & Margins');
  const margin = (metrics.netIncome / metrics.totalRevenue) * 100;
  const ebitdaMargin = (metrics.ebitda / metrics.totalRevenue) * 100;
  const sdeMargin = (metrics.sde / metrics.totalRevenue) * 100;

  table(doc, ['Metric', 'Value'], [
    ['Net Income Margin', `${margin.toFixed(1)}%`],
    ['EBITDA Margin', `${ebitdaMargin.toFixed(1)}%`],
    ['SDE Margin', `${sdeMargin.toFixed(1)}%`],
    ['Total Add-backs as % of Revenue', `${((metrics.totalAddbacks / metrics.totalRevenue) * 100).toFixed(1)}%`],
  ]);

  doc.moveDown(2);
  doc.fontSize(9).fillColor('#999')
    .text('Margins are calculated against total normalized revenue for the analyzed period. Ratios should be compared against industry benchmarks by a qualified advisor.', { width: 495 });
}

function transactionDetailPages(doc, transactions) {
  sectionHeader(doc, 'Transaction Detail (Categorized)');
  doc.fontSize(9).fillColor(GRAY)
    .text(`${transactions.length} transactions were processed and categorized below. Add-back items are marked with *.`, { width: 495 });
  doc.moveDown(0.5);

  const rows = transactions.map((t) => [
    t.date ? formatDate(t.date) : '—',
    truncate(t.description, 40) + (t.isAddback ? ' *' : ''),
    t.category,
    formatCurrency(t.amount),
  ]);

  table(doc, ['Date', 'Description', 'Category', 'Amount'], rows, { fontSize: 8, colWidths: [60, 200, 130, 105] });
}

function sectionHeader(doc, title) {
  doc.fillColor(BRAND_COLOR).fontSize(18).font('Helvetica-Bold').text(title);
  doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).strokeColor(BRAND_COLOR).lineWidth(1.5).stroke();
  doc.moveDown(1.2);
  doc.font('Helvetica');
}

function table(doc, headers, rows, opts = {}) {
  const fontSize = opts.fontSize || 10;
  const startX = 50;
  const colWidths = opts.colWidths || distributeWidths(headers.length);
  let y = doc.y;

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#fff');
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 22).fill(BRAND_COLOR);
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor('#fff').text(h, x + 6, y + 6, { width: colWidths[i] - 12 });
    x += colWidths[i];
  });
  y += 22;
  doc.font('Helvetica').fillColor('#222');

  rows.forEach((row, idx) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    if (row[0] === '__divider__') {
      doc.moveTo(startX, y + 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + 4).strokeColor('#ccc').stroke();
      y += 10;
      return;
    }
    const bg = idx % 2 === 0 ? '#f7f9fb' : '#ffffff';
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill(bg);
    let cx = startX;
    row.forEach((cell, i) => {
      doc.fillColor('#222').fontSize(fontSize).text(String(cell), cx + 6, y + 5, { width: colWidths[i] - 12 });
      cx += colWidths[i];
    });
    y += 20;
  });

  doc.y = y + 10;
}

function distributeWidths(n) {
  const total = 495;
  return new Array(n).fill(total / n);
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#999')
      .text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 40, { align: 'center', width: 495 });
  }
}

function formatCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

module.exports = { generateReportPdf };