const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const CATEGORIES = [
    'Revenue', 'COGS', 'Payroll', 'Rent', 'Utilities', 'Marketing',
    'Insurance', 'Professional Fees', 'Travel & Entertainment', 'Vehicle',
    'Office Supplies', 'Depreciation & Amortization', 'Interest Expense',
    'Taxes', 'Owner Compensation', 'Other Operating Expense', 'Non-Operating',
];

const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 4000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Main categorization with quota detection
// ============================================================
async function categorizeAndDetectAddbacks(transactions, context = {}) {
    console.log(`📊 Starting categorization for ${transactions.length} transactions...`);
    
    // ✅ Check if we have quota before starting
    const hasQuota = await checkQuotaAvailability();
    if (!hasQuota) {
        throw new Error('AI_QUOTA_EXHAUSTED');
    }
    
    const results = [];
    let batchIndex = 0;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        batchIndex++;
        
        console.log(`📦 Processing batch ${batchIndex}/${Math.ceil(transactions.length / BATCH_SIZE)} (${batch.length} items)...`);
        
        try {
            const batchResults = await processBatch(batch, context);
            results.push(...batchResults);
            console.log(`✅ Batch ${batchIndex} completed`);
        } catch (err) {
            // ✅ Check if it's a quota error
            if (isQuotaError(err)) {
                console.warn('⚠️ AI quota exhausted. Stopping processing.');
                throw new Error('AI_QUOTA_EXHAUSTED');
            }
            throw err;
        }

        if (i + BATCH_SIZE < transactions.length) {
            await sleep(DELAY_BETWEEN_BATCHES_MS);
        }
    }

    console.log(`🎉 Categorization complete! Processed ${results.length} transactions.`);
    return results;
}

// ============================================================
// Check if quota is available
// ============================================================
async function checkQuotaAvailability() {
    try {
        // Make a tiny test request to check quota
        const testPrompt = 'Return {"test": "ok"}';
        await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
            config: { temperature: 0, responseMimeType: 'application/json' },
        });
        return true;
    } catch (err) {
        if (isQuotaError(err)) {
            return false;
        }
        // If it's some other error, assume quota is fine
        return true;
    }
}

// ============================================================
// Check if error is quota-related
// ============================================================
function isQuotaError(err) {
    const message = err.message || '';
    return (
        err.status === 429 ||
        err.status === 503 ||
        message.includes('quota') ||
        message.includes('rate limit') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('exceeded your current quota') ||
        message.includes('high demand')
    );
}

// ============================================================
// Process a single batch
// ============================================================
async function processBatch(batch, context) {
    const systemPrompt = `You are a financial analyst assistant helping a business broker prepare a Quality of Earnings (QOE) normalization.

For each transaction, determine:
1. "category" — exactly one of: ${CATEGORIES.join(', ')}
2. "isAddback" — true only if this is a personal, one-time, or discretionary expense
3. "addbackReason" — short justification if isAddback is true
4. "confidence" — 0.0 to 1.0

Business: ${context.businessName || 'Unknown'}, Industry: ${context.industry || 'unspecified'}

Be conservative with add-backs. Respond with ONLY a JSON array.`;

    const userPrompt = JSON.stringify(
        batch.map((t) => ({ date: t.date, description: t.description, amount: t.amount }))
    );

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nTransactions:\n${userPrompt}` }] }],
        config: {
            temperature: 0,
            responseMimeType: 'application/json',
            timeout: 60000,
        },
    });

    const raw = response.text;
    const parsed = safeParseArray(raw, batch.length);

    return batch.map((t, idx) => {
        const r = parsed[idx] || {};
        return {
            ...t,
            category: CATEGORIES.includes(r.category) ? r.category : 'Other Operating Expense',
            isAddback: Boolean(r.isAddback),
            addbackReason: r.isAddback ? (r.addbackReason || 'Flagged as potential add-back') : null,
            confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
        };
    });
}

// ============================================================
// Helper: Parse AI response
// ============================================================
function safeParseArray(raw, expectedLength) {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        const key = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (key) return parsed[key];
        return [];
    } catch (err) {
        console.error('Failed to parse AI response:', err.message);
        return new Array(expectedLength).fill({});
    }
}

// ============================================================
// Generate Executive Summary with quota check
// ============================================================
async function generateExecutiveSummary(metrics, context = {}) {
    console.log('📝 Generating executive summary...');

    // ✅ Check quota first
    const hasQuota = await checkQuotaAvailability();
    if (!hasQuota) {
        console.warn('⚠️ No AI quota available for summary generation.');
        // Return a fallback summary without using AI
        return generateFallbackSummary(metrics, context);
    }

    const prompt = `Write a concise, professional 3-4 sentence executive summary for a Quality of Earnings report on "${context.businessName || 'this business'}" (industry: ${context.industry || 'unspecified'}). Use these normalized figures: Revenue ${metrics.totalRevenue}, EBITDA ${metrics.ebitda}, SDE ${metrics.sde}, total add-backs ${metrics.totalAddbacks}. Tone: neutral, analytical. No markdown.`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.3, timeout: 30000 },
        });
        return response.text.trim();
    } catch (err) {
        if (isQuotaError(err)) {
            console.warn('⚠️ AI quota exhausted for summary. Using fallback.');
            return generateFallbackSummary(metrics, context);
        }
        throw err;
    }
}

// ============================================================
// Fallback summary (no AI required)
// ============================================================
function generateFallbackSummary(metrics, context) {
    const revenue = metrics.totalRevenue || 0;
    const ebitda = metrics.ebitda || 0;
    const sde = metrics.sde || 0;
    const addbacks = metrics.totalAddbacks || 0;

    let summary = `${context.businessName || 'The business'} generated ${formatCurrency(revenue)} in revenue with EBITDA of ${formatCurrency(ebitda)} and Seller's Discretionary Earnings (SDE) of ${formatCurrency(sde)}.`;

    if (addbacks > 0) {
        summary += ` Add-backs totaling ${formatCurrency(addbacks)} were identified as personal, discretionary, or non-recurring expenses.`;
    } else {
        summary += ` No significant add-backs were identified in the financial records.`;
    }

    return summary;
}

// ============================================================
// Helper: Format currency
// ============================================================
function formatCurrency(value) {
    if (value === null || value === undefined) return '₹0';
    return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

module.exports = { 
    categorizeAndDetectAddbacks, 
    generateExecutiveSummary, 
    CATEGORIES,
    isQuotaError,
};