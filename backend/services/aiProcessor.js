const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const CATEGORIES = [
  'Revenue', 'COGS', 'Payroll', 'Rent', 'Utilities', 'Marketing',
  'Insurance', 'Professional Fees', 'Travel & Entertainment', 'Vehicle',
  'Office Supplies', 'Depreciation & Amortization', 'Interest Expense',
  'Taxes', 'Owner Compensation', 'Other Operating Expense', 'Non-Operating',
];

const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES_MS = 4000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function categorizeAndDetectAddbacks(transactions, context = {}) {
  const results = [];

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const batchResults = await processBatch(batch, context);
    results.push(...batchResults);

    if (i + BATCH_SIZE < transactions.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  return results;
}

async function processBatch(batch, context, retriesLeft = 3) {
  const systemPrompt = `You are a financial analyst assistant helping a business broker prepare a Quality of Earnings (QOE) normalization for a small business sale.

For each transaction, determine:
1. "category" — exactly one of: ${CATEGORIES.join(', ')}
2. "isAddback" — true only if this expense is plausibly a personal expense, one-time/non-recurring item, or discretionary owner expense that a new buyer would NOT need to continue paying (e.g. owner's personal vehicle, personal travel, one-time legal settlement, above-market owner salary, personal cell phone, country club dues, family member on payroll with no clear duties).
3. "addbackReason" — a short (<15 words) plain-English justification if isAddback is true, otherwise null.
4. "confidence" — your confidence in this categorization, 0.0 to 1.0.

Business context: ${context.businessName || 'Unknown business'}, industry: ${context.industry || 'unspecified'}.

Be conservative: only flag an add-back when there is a clear, defensible reason a buyer's diligence team would accept. When uncertain, set isAddback to false and let the human broker decide.

Respond with ONLY a JSON array (no markdown, no prose), one object per transaction, in the same order as given, with keys: category, isAddback, addbackReason, confidence.`;

  const userPrompt = JSON.stringify(
    batch.map((t) => ({ date: t.date, description: t.description, amount: t.amount }))
  );

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nTransactions:\n${userPrompt}` }] }],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
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
  } catch (err) {
    const isRateLimit = err.message && err.message.includes('429');
    if (isRateLimit && retriesLeft > 0) {
      console.warn(`Gemini rate limit hit, retrying in 10s (${retriesLeft} retries left)...`);
      await sleep(10000);
      return processBatch(batch, context, retriesLeft - 1);
    }
    throw err;
  }
}

function safeParseArray(raw, expectedLength) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    const key = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
    if (key) return parsed[key];
    return [];
  } catch (err) {
    console.error('Failed to parse AI response as JSON:', err, raw);
    return new Array(expectedLength).fill({});
  }
}

async function generateExecutiveSummary(metrics, context = {}) {
  const prompt = `Write a concise, professional 3-4 sentence executive summary for a Quality of Earnings report on "${context.businessName || 'this business'}" (industry: ${context.industry || 'unspecified'}). Use these normalized figures for the period: Revenue ${metrics.totalRevenue}, EBITDA ${metrics.ebitda}, SDE ${metrics.sde}, total add-backs ${metrics.totalAddbacks}. Tone: neutral, analytical, suitable for a business buyer. Do not invent facts not given. No markdown formatting.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.3 },
  });

  return response.text.trim();
}

module.exports = { categorizeAndDetectAddbacks, generateExecutiveSummary, CATEGORIES };