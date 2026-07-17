const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Professional color scheme
const COLORS = {
  primary: '#1a3a5c',      // Dark blue
  secondary: '#2e7d32',    // Green
  accent: '#4F46E5',       // Indigo
  gold: '#c9a84c',         // Gold accent
  text: '#1a202c',         // Dark text
  textLight: '#4a5568',    // Light text
  gray: '#718096',         // Gray
  lightBg: '#f7fafc',      // Light background
  border: '#e2e8f0',       // Border color
  white: '#ffffff',
  red: '#e53e3e',
};

function generateReportPdf({ report, transactions, addbackSchedule, metrics, executiveSummary, outputPath, branding = null }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50, 
      bufferPages: true,
      info: {
        Title: `QOE Report - ${report.business_name}`,
        Author: branding?.firmName || 'Ledger AI',
        Subject: 'Quality of Earnings Report',
        Keywords: 'QOE, Financial Analysis, Business Valuation',
        Creator: 'Ledger AI',
      }
    });
    
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ========== COVER PAGE ==========
    coverPage(doc, report, branding);
    doc.addPage();

    // ========== DISCLAIMER ==========
    disclaimerPage(doc);
    doc.addPage();

    // ========== EXECUTIVE SUMMARY ==========
    executiveSummaryPage(doc, report, metrics, executiveSummary);
    doc.addPage();

    // ========== FINANCIAL SUMMARY ==========
    financialSummaryPage(doc, metrics);
    doc.addPage();

    // ========== ADD-BACK SCHEDULE ==========
    addbackSchedulePage(doc, addbackSchedule, metrics);
    doc.addPage();

    // ========== KEY RATIOS ==========
    keyRatiosPage(doc, metrics);
    doc.addPage();

    // ========== TRANSACTIONS ==========
    transactionDetailPages(doc, transactions);

    // ========== FOOTER ==========
    addPageNumbers(doc, branding);

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ============================================================
// COVER PAGE
// ============================================================
function coverPage(doc, report, branding) {
  const primaryColor = branding?.primaryColor || COLORS.primary;
  
  // Background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.lightBg);
  
  // Top decorative bar
  doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
  
  // Logo Area
  const logoY = 80;
  doc.rect(50, logoY, 120, 120).fill(primaryColor);
  doc.fillColor(COLORS.white)
    .fontSize(42)
    .font('Helvetica-Bold')
    .text('L', 62, logoY + 30, { width: 100, align: 'center' })
    .fontSize(12)
    .text('LEDGER AI', 50, logoY + 85, { width: 120, align: 'center' });
  
  // Company Name (if branded)
  if (branding?.firmName) {
    doc.fillColor(COLORS.textLight)
      .fontSize(10)
      .font('Helvetica')
      .text(branding.firmName, 50, logoY + 110, { width: 120, align: 'center' });
  }

  // Main Title
  doc.fillColor(primaryColor)
    .fontSize(32)
    .font('Helvetica-Bold')
    .text('Quality of Earnings Report', 200, 80, { 
      width: 340, 
      align: 'left',
      lineGap: 4
    });

  // Decorative line
  doc.moveTo(200, 130)
    .lineTo(540, 130)
    .strokeColor(COLORS.gold)
    .lineWidth(2)
    .stroke();

  // Business Name
  doc.fillColor(COLORS.text)
    .fontSize(22)
    .font('Helvetica')
    .text(report.business_name || 'Business Name', 200, 150, { 
      width: 340,
      align: 'left'
    });

  // Industry
  if (report.industry) {
    doc.fillColor(COLORS.textLight)
      .fontSize(14)
      .font('Helvetica')
      .text(report.industry, 200, 185, { width: 340 });
  }

  // Period
  let periodText = '';
  if (report.period_start && report.period_end) {
    periodText = `Period: ${formatDate(report.period_start)} – ${formatDate(report.period_end)}`;
  } else {
    periodText = `Period: ${formatDate(report.created_at)}`;
  }
  
  doc.fillColor(COLORS.gray)
    .fontSize(11)
    .font('Helvetica')
    .text(periodText, 200, 215, { width: 340 });

  // Prepared date
  doc.text(`Prepared: ${formatDate(new Date())}`, 200, 240, { width: 340 });

  // Bottom section
  const bottomY = doc.page.height - 120;
  
  // Gold bar
  doc.rect(50, bottomY, 495, 4).fill(COLORS.gold);

  // Confidential
  doc.fillColor(COLORS.primary)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('CONFIDENTIAL', 50, bottomY + 20, { 
      width: 495, 
      align: 'center',
      characterSpacing: 4
    });

  // Footer text
  doc.fillColor(COLORS.gray)
    .fontSize(8)
    .font('Helvetica')
    .text('This report is confidential and intended solely for the use of the recipient.', 50, bottomY + 40, { 
      width: 495, 
      align: 'center' 
    });

  // Contact info if branded
  if (branding?.contactEmail || branding?.contactPhone) {
    const contactText = [];
    if (branding.contactPhone) contactText.push(branding.contactPhone);
    if (branding.contactEmail) contactText.push(branding.contactEmail);
    
    if (contactText.length > 0) {
      doc.fontSize(8)
        .text(contactText.join('  |  '), 50, bottomY + 60, { 
          width: 495, 
          align: 'center' 
        });
    }
  }
}

// ============================================================
// DISCLAIMER PAGE
// ============================================================
function disclaimerPage(doc) {
  sectionHeader(doc, 'Important Disclaimers');
  
  const disclaimers = [
    {
      title: '1. AI-Assisted Analysis',
      text: 'This report was generated with AI-assisted categorization of financial transactions provided by the business owner or their representative. It has not been audited, reviewed, or compiled in accordance with AICPA, ICAI, or other professional accounting standards.'
    },
    {
      title: '2. Add-Back Determinations',
      text: 'Add-back determinations reflect a reasonable, good-faith interpretation of the source data and are subject to review and adjustment by the preparing broker, the business owner, and any party relying on this report, including buyers, lenders, and their advisors.'
    },
    {
      title: '3. EBITDA & SDE Calculations',
      text: 'EBITDA and Seller\'s Discretionary Earnings (SDE) are calculated using industry-standard main-street business brokerage conventions, which may differ from formal GAAP or IFRS-based adjustments used in larger M&A transactions.'
    },
    {
      title: '4. Not Professional Advice',
      text: 'This report does not constitute investment, legal, or tax advice. Recipients should engage a licensed CPA, attorney, or financial advisor before relying on this report for a transaction, financing, or valuation decision.'
    },
    {
      title: '5. Data Accuracy',
      text: 'Figures are only as accurate as the source data provided. Uploading incomplete or inaccurate financial records will produce a materially inaccurate report.'
    },
    {
      title: '6. Liability',
      text: 'Neither the preparer nor the platform generating this report guarantees the accuracy, completeness, or fitness of this report for any particular purpose, and disclaims liability for decisions made in reliance on it.'
    }
  ];

  let y = doc.y + 10;
  
  for (const item of disclaimers) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    
    doc.fillColor(COLORS.primary)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(item.title, 50, y);
    
    y = doc.y + 2;
    
    doc.fillColor(COLORS.textLight)
      .fontSize(9.5)
      .font('Helvetica')
      .text(item.text, 50, y, { 
        width: 495, 
        lineGap: 2,
        align: 'justify'
      });
    
    y = doc.y + 12;
    doc.y = y;
  }
}

// ============================================================
// EXECUTIVE SUMMARY PAGE
// ============================================================
function executiveSummaryPage(doc, report, metrics, executiveSummary) {
  sectionHeader(doc, 'Executive Summary');
  
  doc.fillColor(COLORS.text)
    .fontSize(11)
    .font('Helvetica')
    .text(executiveSummary || 'Executive summary unavailable.', { 
      width: 495, 
      lineGap: 4,
      align: 'justify' 
    });
  
  doc.moveDown(2);

  // Key metrics cards
  const cards = [
    ['Total Revenue', metrics.totalRevenue, COLORS.primary],
    ['EBITDA', metrics.ebitda, COLORS.accent],
    ['SDE', metrics.sde, COLORS.secondary],
  ];

  let x = 50;
  const y = doc.y + 10;
  const cardWidth = 155;
  const cardHeight = 70;

  for (const [label, value, color] of cards) {
    // Card background
    doc.roundedRect(x, y, cardWidth, cardHeight, 8)
      .fillAndStroke(COLORS.lightBg, COLORS.border);
    
    // Label
    doc.fillColor(COLORS.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(label.toUpperCase(), x + 12, y + 12, { 
        width: cardWidth - 24,
        characterSpacing: 0.5 
      });
    
    // Value
    doc.fillColor(color)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(formatCurrency(value), x + 12, y + 30, { 
        width: cardWidth - 24 
      });
    
    x += cardWidth + 15;
  }
  
  doc.y = y + cardHeight + 30;
}

// ============================================================
// FINANCIAL SUMMARY PAGE
// ============================================================
function financialSummaryPage(doc, metrics) {
  sectionHeader(doc, 'Financial Summary');
  
  const rows = [
    ['Revenue', formatCurrency(metrics.totalRevenue), 'positive'],
    ['Total Expenses', formatCurrency(-Math.abs(metrics.totalExpenses)), 'negative'],
    ['---', '', ''],
    ['Net Income', formatCurrency(metrics.netIncome), metrics.netIncome >= 0 ? 'positive' : 'negative'],
    ['Add-backs', formatCurrency(metrics.totalAddbacks), 'positive'],
    ['EBITDA', formatCurrency(metrics.ebitda), 'positive'],
    ['SDE', formatCurrency(metrics.sde), 'positive'],
  ];

  let y = doc.y + 10;
  
  for (const row of rows) {
    const [label, value, type] = row;
    
    if (label === '---') {
      doc.moveTo(50, y).lineTo(545, y).strokeColor(COLORS.border).lineWidth(1).stroke();
      y += 10;
      continue;
    }
    
    doc.fillColor(type === 'positive' ? COLORS.secondary : type === 'negative' ? COLORS.red : COLORS.text)
      .fontSize(type === 'positive' || type === 'negative' ? 12 : 10)
      .font(type === 'positive' || type === 'negative' ? 'Helvetica-Bold' : 'Helvetica')
      .text(label, 50, y, { width: 350 });
    
    doc.text(value, 400, y, { 
      width: 95, 
      align: 'right',
      font: type === 'positive' || type === 'negative' ? 'Helvetica-Bold' : 'Helvetica'
    });
    
    y += 22;
  }
}

// ============================================================
// ADD-BACK SCHEDULE PAGE
// ============================================================
function addbackSchedulePage(doc, addbackSchedule, metrics) {
  sectionHeader(doc, 'Add-Back Schedule');
  
  doc.fillColor(COLORS.gray)
    .fontSize(9)
    .font('Helvetica')
    .text('The following items were identified as personal, discretionary, or non-recurring expenses added back to EBITDA.', { 
      width: 495 
    });
  doc.moveDown(1);

  if (!addbackSchedule || addbackSchedule.length === 0) {
    doc.fillColor(COLORS.textLight)
      .fontSize(11)
      .text('No add-backs were identified in the source data.');
    return;
  }

  // Table
  const headers = ['Add-Back Item', 'Transactions', 'Amount'];
  const colWidths = [280, 100, 115];
  
  // Header
  doc.rect(50, doc.y, colWidths.reduce((a, b) => a + b, 0), 28).fill(COLORS.primary);
  doc.fillColor(COLORS.white)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(headers[0], 56, doc.y + 9, { width: colWidths[0] - 12 });
  doc.text(headers[1], 50 + colWidths[0] + 6, doc.y + 9, { width: colWidths[1] - 12 });
  doc.text(headers[2], 50 + colWidths[0] + colWidths[1] + 6, doc.y + 9, { 
    width: colWidths[2] - 12,
    align: 'right' 
  });
  
  let y = doc.y + 28;
  
  // Rows
  for (let i = 0; i < addbackSchedule.length; i++) {
    const a = addbackSchedule[i];
    const bg = i % 2 === 0 ? COLORS.white : COLORS.lightBg;
    
    doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 22).fill(bg);
    doc.fillColor(COLORS.text)
      .fontSize(9)
      .font('Helvetica')
      .text(a.label || 'Unnamed', 56, y + 5, { width: colWidths[0] - 12 });
    doc.text(String(a.transaction_count || a.count || 1), 50 + colWidths[0] + 6, y + 5, { 
      width: colWidths[1] - 12,
      align: 'center' 
    });
    doc.text(formatCurrency(a.amount), 50 + colWidths[0] + colWidths[1] + 6, y + 5, { 
      width: colWidths[2] - 12,
      align: 'right' 
    });
    
    y += 22;
  }
  
  // Total row
  doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 26).fill(COLORS.lightBg);
  doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 26).stroke(COLORS.border);
  
  doc.fillColor(COLORS.primary)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Total Add-Backs', 56, y + 7, { width: colWidths[0] - 12 });
  doc.text(formatCurrency(metrics.totalAddbacks), 50 + colWidths[0] + colWidths[1] + 6, y + 7, { 
    width: colWidths[2] - 12,
    align: 'right' 
  });
  
  doc.y = y + 40;
}

// ============================================================
// KEY RATIOS PAGE
// ============================================================
function keyRatiosPage(doc, metrics) {
  sectionHeader(doc, 'Key Financial Ratios');
  
  const totalRevenue = Number(metrics.totalRevenue) || 1;
  const netIncome = Number(metrics.netIncome) || 0;
  const ebitda = Number(metrics.ebitda) || 0;
  const sde = Number(metrics.sde) || 0;
  const totalAddbacks = Number(metrics.totalAddbacks) || 0;

  const ratios = [
    ['Net Income Margin', `${((netIncome / totalRevenue) * 100).toFixed(1)}%`, netIncome >= 0],
    ['EBITDA Margin', `${((ebitda / totalRevenue) * 100).toFixed(1)}%`, ebitda >= 0],
    ['SDE Margin', `${((sde / totalRevenue) * 100).toFixed(1)}%`, sde >= 0],
    ['Add-backs as % of Revenue', `${((totalAddbacks / totalRevenue) * 100).toFixed(1)}%`, true],
  ];

  let y = doc.y + 10;
  
  for (const [label, value, isPositive] of ratios) {
    doc.rect(50, y, 495, 30).fill(y % 60 === 10 ? COLORS.lightBg : COLORS.white);
    doc.fillColor(COLORS.text)
      .fontSize(10)
      .font('Helvetica')
      .text(label, 60, y + 9, { width: 350 });
    
    doc.fillColor(isPositive ? COLORS.secondary : COLORS.red)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(value, 400, y + 8, { width: 95, align: 'right' });
    
    y += 30;
  }

  doc.moveDown(2);
  doc.fillColor(COLORS.gray)
    .fontSize(8)
    .font('Helvetica')
    .text('Margins are calculated against total normalized revenue for the analyzed period.', { 
      width: 495,
      align: 'center' 
    });
}

// ============================================================
// TRANSACTION DETAIL PAGES
// ============================================================
function transactionDetailPages(doc, transactions) {
  sectionHeader(doc, 'Transaction Detail');
  
  doc.fillColor(COLORS.gray)
    .fontSize(9)
    .font('Helvetica')
    .text(`${transactions.length} transactions processed. Add-back items are marked with ★.`, { 
      width: 495 
    });
  doc.moveDown(1);

  const headers = ['Date', 'Description', 'Category', 'Amount'];
  const colWidths = [70, 210, 115, 100];
  let y = doc.y;

  // Split transactions into pages
  const rowsPerPage = 30;
  let startIndex = 0;

  while (startIndex < transactions.length) {
    const endIndex = Math.min(startIndex + rowsPerPage, transactions.length);
    const pageTransactions = transactions.slice(startIndex, endIndex);

    // Header
    doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 24).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(headers[0], 56, y + 7, { width: colWidths[0] - 12 });
    doc.text(headers[1], 50 + colWidths[0] + 6, y + 7, { width: colWidths[1] - 12 });
    doc.text(headers[2], 50 + colWidths[0] + colWidths[1] + 6, y + 7, { width: colWidths[2] - 12 });
    doc.text(headers[3], 50 + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 7, { 
      width: colWidths[3] - 12,
      align: 'right' 
    });

    y += 24;

    // Rows
    for (let i = 0; i < pageTransactions.length; i++) {
      const t = pageTransactions[i];
      const isAddback = t.is_addback;
      const bg = i % 2 === 0 ? COLORS.white : COLORS.lightBg;

      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 50;
        // Re-draw header on new page
        doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 24).fill(COLORS.primary);
        doc.fillColor(COLORS.white)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(headers[0], 56, y + 7, { width: colWidths[0] - 12 });
        doc.text(headers[1], 50 + colWidths[0] + 6, y + 7, { width: colWidths[1] - 12 });
        doc.text(headers[2], 50 + colWidths[0] + colWidths[1] + 6, y + 7, { width: colWidths[2] - 12 });
        doc.text(headers[3], 50 + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 7, { 
          width: colWidths[3] - 12,
          align: 'right' 
        });
        y += 24;
      }

      doc.rect(50, y, colWidths.reduce((a, b) => a + b, 0), 20).fill(bg);
      
      if (isAddback) {
        doc.rect(50, y, 4, 20).fill(COLORS.gold);
      }

      doc.fillColor(isAddback ? COLORS.primary : COLORS.text)
        .fontSize(8)
        .font(isAddback ? 'Helvetica-Bold' : 'Helvetica')
        .text(t.txn_date ? formatDate(t.txn_date) : '—', 56, y + 5, { width: colWidths[0] - 12 });
      
      const desc = (t.description || '') + (isAddback ? ' ★' : '');
      doc.text(truncate(desc, 35), 50 + colWidths[0] + 6, y + 5, { width: colWidths[1] - 12 });
      doc.text(t.category || 'Uncategorized', 50 + colWidths[0] + colWidths[1] + 6, y + 5, { 
        width: colWidths[2] - 12 
      });
      doc.text(formatCurrency(t.amount), 50 + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 5, { 
        width: colWidths[3] - 12,
        align: 'right' 
      });

      y += 20;
    }

    startIndex = endIndex;
    
    if (startIndex < transactions.length) {
      doc.addPage();
      y = 50;
    }
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function sectionHeader(doc, title) {
  doc.fillColor(COLORS.primary)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(title);
  
  doc.moveTo(50, doc.y + 4)
    .lineTo(545, doc.y + 4)
    .strokeColor(COLORS.gold)
    .lineWidth(2)
    .stroke();
  
  doc.moveDown(1.2);
  doc.font('Helvetica');
}

function addPageNumbers(doc, branding) {
  const range = doc.bufferedPageRange();
  const primaryColor = branding?.primaryColor || COLORS.primary;
  
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    
    // Bottom border
    doc.moveTo(50, doc.page.height - 35)
      .lineTo(545, doc.page.height - 35)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();
    
    // Page number
    doc.fillColor(primaryColor)
      .fontSize(8)
      .font('Helvetica')
      .text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 28, { 
        align: 'center', 
        width: 495 
      });
  }
}

function formatCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    maximumFractionDigits: 0 
  });
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

module.exports = { generateReportPdf };