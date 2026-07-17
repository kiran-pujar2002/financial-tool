// services/fileParser.js
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');
const { validateFinancialFile } = require('./fileValidator');

function parseFinancialFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    let rows;
    if (ext === '.csv') {
        const content = fs.readFileSync(filePath, 'utf8');
        rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = xlsx.readFile(filePath);
        const firstSheet = workbook.SheetNames[0];
        rows = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
    } else if (ext === '.pdf') {
        throw new Error(
            'PDF uploads require OCR/table extraction. For MVP, ask brokers to export CSV/Excel from their accounting software instead.'
        );
    } else {
        throw new Error(`Unsupported file type: ${ext}`);
    }

    if (!rows || rows.length === 0) {
        throw new Error('No rows found in uploaded file');
    }

    // ✅ Validate the file before processing
    const validation = validateFinancialFile(rows);
    
    // ✅ If validation fails, throw a detailed error
    if (!validation.isValid) {
        const errorMessage = `
Invalid financial file:
- ${validation.errors.join('\n- ')}
${validation.warnings.length > 0 ? `\nWarnings:\n- ${validation.warnings.join('\n- ')}` : ''}
        `.trim();
        throw new Error(errorMessage);
    }

    // ✅ Log warnings but continue
    if (validation.warnings.length > 0) {
        console.warn('⚠️ File validation warnings:', validation.warnings);
    }

    // ✅ Log detected columns
    console.log('📊 Detected columns:', validation.detected);

    return rows.map(normalizeRow).filter((r) => r.description && !isNaN(r.amount));
}

// Rest of the file remains the same...
const DATE_KEYS = ['date', 'transaction date', 'txn date', 'posted date'];
const DESC_KEYS = ['description', 'memo', 'name', 'payee', 'transaction', 'details'];
const AMOUNT_KEYS = ['amount', 'debit', 'credit', 'value', 'total'];
const CATEGORY_KEYS = ['category', 'account', 'type', 'class'];

function findKey(row, candidates) {
    const keys = Object.keys(row);
    const lowerMap = Object.fromEntries(keys.map((k) => [k.toLowerCase().trim(), k]));
    for (const candidate of candidates) {
        if (lowerMap[candidate]) return lowerMap[candidate];
    }
    return null;
}

function parseAmount(value) {
    if (typeof value === 'number') return value;
    if (!value) return NaN;
    const isNegative = /^\(.*\)$/.test(String(value).trim());
    const cleaned = String(value).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return NaN;
    return isNegative ? -Math.abs(num) : num;
}

function normalizeRow(row) {
    const dateKey = findKey(row, DATE_KEYS);
    const descKey = findKey(row, DESC_KEYS);
    const amountKey = findKey(row, AMOUNT_KEYS);
    const categoryKey = findKey(row, CATEGORY_KEYS);

    return {
        date: dateKey ? row[dateKey] : null,
        description: descKey ? String(row[descKey]).trim() : '',
        amount: amountKey ? parseAmount(row[amountKey]) : NaN,
        rawCategory: categoryKey ? String(row[categoryKey]).trim() : null,
    };
}

module.exports = { parseFinancialFile };