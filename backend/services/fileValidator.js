// services/fileValidator.js

/**
 * Validate if a file contains valid financial transaction data
 * Checks for:
 * 1. Required columns (date, description, amount)
 * 2. Numeric values in amount column
 * 3. Minimum number of transactions
 * 4. Reasonable date range
 * 5. Amount patterns (debits/credits)
 */
function validateFinancialFile(rows) {
    const errors = [];
    const warnings = [];

    if (!rows || rows.length === 0) {
        errors.push('File is empty or contains no data rows');
        return { isValid: false, errors, warnings };
    }

    // ✅ 1. Check minimum rows (at least 3 transactions to be meaningful)
    if (rows.length < 3) {
        errors.push(`File contains only ${rows.length} rows. Minimum 3 transactions required.`);
    }

    // ✅ 2. Detect column headers
    const headers = Object.keys(rows[0] || {});
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    // ✅ 3. Find required columns
    const dateCol = findColumn(headers, ['date', 'transaction date', 'txn date', 'posted date', 'posting date', 'entry date']);
    const descCol = findColumn(headers, ['description', 'memo', 'name', 'payee', 'transaction', 'details', 'narration', 'particulars']);
    const amountCol = findColumn(headers, ['amount', 'debit', 'credit', 'value', 'total', 'net', 'transaction amount']);
    const categoryCol = findColumn(headers, ['category', 'account', 'type', 'class', 'ledger']);

    // ✅ 4. Check required columns exist
    if (!dateCol) {
        errors.push('No date column found. Expected: "Date", "Transaction Date", "Posted Date", etc.');
    }
    if (!descCol) {
        errors.push('No description column found. Expected: "Description", "Memo", "Payee", etc.');
    }
    if (!amountCol) {
        errors.push('No amount column found. Expected: "Amount", "Debit", "Credit", "Value", etc.');
    }

    // ✅ 5. If missing critical columns, fail validation
    if (!descCol || !amountCol) {
        return { 
            isValid: false, 
            errors, 
            warnings,
            detected: { dateCol, descCol, amountCol, categoryCol }
        };
    }

    // ✅ 6. Sample data validation (check first 10 rows)
    const sampleSize = Math.min(10, rows.length);
    let numericCount = 0;
    let validDates = 0;
    let hasNonZeroAmounts = false;

    for (let i = 0; i < sampleSize; i++) {
        const row = rows[i];
        const amount = parseAmount(row[amountCol]);
        
        // Check if amount is numeric
        if (!isNaN(amount) && amount !== 0) {
            numericCount++;
            hasNonZeroAmounts = true;
        }

        // Check if date is valid
        if (dateCol) {
            const dateVal = row[dateCol];
            if (dateVal && isValidDate(dateVal)) {
                validDates++;
            }
        }

        // Check if description is meaningful
        if (descCol) {
            const desc = String(row[descCol] || '').trim();
            if (desc.length < 2) {
                warnings.push(`Row ${i + 2} has very short description: "${desc}"`);
            }
        }
    }

    // ✅ 7. Amount validation
    if (numericCount === 0) {
        errors.push(`No valid numeric amounts found in the "${amountCol}" column.`);
    } else if (numericCount < sampleSize * 0.5) {
        warnings.push(`Only ${numericCount}/${sampleSize} rows have valid numeric amounts.`);
    }

    // ✅ 8. Check if all amounts are zero
    if (!hasNonZeroAmounts) {
        errors.push('All amounts appear to be zero. This doesn\'t look like a valid financial statement.');
    }

    // ✅ 9. Date validation (if date column exists)
    if (dateCol && validDates === 0) {
        warnings.push(`No valid dates found in the "${dateCol}" column.`);
    }

    // ✅ 10. Check for financial keywords in description
    if (descCol) {
        const financialKeywords = ['payment', 'revenue', 'expense', 'salary', 'rent', 'invoice', 'purchase', 
                                  'sales', 'income', 'cost', 'fee', 'tax', 'insurance', 'utility', 
                                  'deposit', 'withdrawal', 'transfer', 'credit', 'debit'];
        let foundKeywords = 0;
        
        for (let i = 0; i < Math.min(5, rows.length); i++) {
            const desc = String(rows[i][descCol] || '').toLowerCase();
            for (const keyword of financialKeywords) {
                if (desc.includes(keyword)) {
                    foundKeywords++;
                    break;
                }
            }
        }

        if (foundKeywords === 0) {
            warnings.push('No common financial keywords found in descriptions. Please verify this is a financial statement.');
        }
    }

    // ✅ 11. Check for story-like content (long text, no numbers)
    if (descCol && rows.length < 10) {
        const totalText = rows.map(r => String(r[descCol] || '')).join(' ').length;
        const totalNumbers = rows.map(r => String(r[descCol] || '')).join(' ').match(/\d/g)?.length || 0;
        
        // If descriptions are very long with few numbers, it might be text/story
        if (totalText > 1000 && totalNumbers < 50) {
            warnings.push('File appears to contain narrative text rather than transaction data.');
        }
    }

    // ✅ 12. Check for common non-financial file patterns
    if (descCol) {
        const sampleDesc = String(rows[0][descCol] || '').toLowerCase();
        const nonFinancialPatterns = ['chapter', 'introduction', 'summary', 'abstract', 'conclusion', 
                                     'author', 'publisher', 'book', 'novel', 'story', 'essay'];
        
        for (const pattern of nonFinancialPatterns) {
            if (sampleDesc.includes(pattern)) {
                warnings.push(`File content looks like narrative text (contains "${pattern}"). Please upload a financial statement.`);
                break;
            }
        }
    }

    // ✅ Determine if valid
    const isValid = errors.length === 0;

    return {
        isValid,
        errors,
        warnings,
        detected: {
            dateCol,
            descCol,
            amountCol,
            categoryCol,
            totalRows: rows.length,
            numericCount,
            hasNonZeroAmounts,
            validDates
        },
        // Suggested column mapping for user
        suggestedMapping: {
            date: dateCol,
            description: descCol,
            amount: amountCol,
            category: categoryCol
        }
    };
}

// ============================================================
// Helper Functions
// ============================================================

function findColumn(headers, candidates) {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    for (const candidate of candidates) {
        const index = lowerHeaders.findIndex(h => h === candidate);
        if (index !== -1) return headers[index];
        // Also check if candidate is contained in header
        const partialMatch = lowerHeaders.findIndex(h => h.includes(candidate));
        if (partialMatch !== -1) return headers[partialMatch];
    }
    return null;
}

function parseAmount(value) {
    if (typeof value === 'number') return value;
    if (!value) return NaN;
    const str = String(value).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? NaN : num;
}

function isValidDate(value) {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
}

module.exports = { validateFinancialFile };