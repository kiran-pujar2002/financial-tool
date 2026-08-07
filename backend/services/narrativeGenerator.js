// services/narrativeGenerator.js
const { GoogleGenAI } = require('@google/genai');
const { query } = require('../config/db');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// ============================================================
// Generate narrative for a report section
// ============================================================
async function generateNarrative(reportId, userId, section, tone = 'professional') {
    try {
        // 1. Get comprehensive report data
        const reportData = await getComprehensiveReportData(reportId);
        
        // 2. Build a detailed prompt
        const prompt = buildDetailedPrompt(reportData, section, tone);
        
        // 3. Generate narrative using AI
        const content = await generateWithAI(prompt, section);
        
        // 4. Save to database
        await saveNarrative(reportId, userId, section, content, tone);
        
        return content;
    } catch (err) {
        console.error('❌ Error generating narrative:', err);
        return generateFallbackNarrative(await getComprehensiveReportData(reportId), section);
    }
}

// ============================================================
// Get comprehensive report data
// ============================================================
async function getComprehensiveReportData(reportId) {
    const reportResult = await query(
        `SELECT id, business_name, industry, total_revenue, 
                total_expenses, net_income, ebitda, sde, total_addbacks, 
                ai_summary, period_start, period_end, created_at
         FROM reports WHERE id = $1`,
        [reportId]
    );
    
    if (reportResult.rows.length === 0) {
        throw new Error('Report not found');
    }
    
    const report = reportResult.rows[0];
    
    // Get all transactions (limit 100 for context)
    const txnsResult = await query(
        `SELECT description, category, amount, is_addback, addback_reason
         FROM transactions WHERE report_id = $1
         ORDER BY ABS(amount) DESC LIMIT 100`,
        [reportId]
    );
    
    // Get addback schedule
    const addbacksResult = await query(
        `SELECT label, amount, justification, transaction_count
         FROM addback_schedule WHERE report_id = $1
         ORDER BY amount DESC`,
        [reportId]
    );
    
    // Calculate additional metrics
    const totalRevenue = Number(report.total_revenue) || 0;
    const totalExpenses = Number(report.total_expenses) || 0;
    const netIncome = Number(report.net_income) || 0;
    const ebitda = Number(report.ebitda) || 0;
    const sde = Number(report.sde) || 0;
    const totalAddbacks = Number(report.total_addbacks) || 0;
    
    // Calculate margins
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
    const ebitdaMargin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
    const sdeMargin = totalRevenue > 0 ? (sde / totalRevenue) * 100 : 0;
    
    // Count addbacks
    const addbackCount = addbacksResult.rows.length || 0;
    
    return {
        report,
        transactions: txnsResult.rows,
        addbacks: addbacksResult.rows,
        metrics: {
            totalRevenue,
            totalExpenses,
            netIncome,
            ebitda,
            sde,
            totalAddbacks,
            grossMargin,
            ebitdaMargin,
            sdeMargin,
            addbackCount,
            transactionCount: txnsResult.rows.length
        }
    };
}

// ============================================================
// Build detailed prompt for AI
// ============================================================
function buildDetailedPrompt(reportData, section, tone) {
    const { report, metrics, transactions, addbacks } = reportData;
    
    // Format top transactions (top 10 by amount)
    const topTransactions = transactions.slice(0, 10).map(t => 
        `- ${t.description}: ${t.category} - ₹${Number(t.amount).toLocaleString()}${t.is_addback ? ' (Add-back)' : ''}`
    ).join('\n');
    
    // Format addbacks
    const addbackDetails = addbacks.map(a => 
        `- ${a.label}: ₹${Number(a.amount).toLocaleString()} (${a.justification || 'No justification provided'})`
    ).join('\n');
    
    const toneDescription = {
        professional: 'professional, formal, suitable for a business report or investment memorandum',
        concise: 'concise, to the point, using clear and direct language',
        detailed: 'detailed, comprehensive, with full explanations and context',
        investor_friendly: 'investor-friendly, highlighting growth potential, opportunities, and positive attributes'
    };
    
    const sectionPrompts = {
        executive_summary: `
Write a comprehensive executive summary for the Quality of Earnings report of ${report.business_name}.

Key Financial Metrics:
- Revenue: ₹${metrics.totalRevenue.toLocaleString()}
- EBITDA: ₹${metrics.ebitda.toLocaleString()}
- SDE: ₹${metrics.sde.toLocaleString()}
- Net Income: ₹${metrics.netIncome.toLocaleString()}
- Total Add-backs: ₹${metrics.totalAddbacks.toLocaleString()}
- Add-backs Count: ${metrics.addbackCount}

Key Ratios:
- Gross Margin: ${metrics.grossMargin.toFixed(1)}%
- EBITDA Margin: ${metrics.ebitdaMargin.toFixed(1)}%
- SDE Margin: ${metrics.sdeMargin.toFixed(1)}%

Industry: ${report.industry || 'Not specified'}
Period: ${report.period_start ? formatDate(report.period_start) : 'N/A'} to ${report.period_end ? formatDate(report.period_end) : 'N/A'}

Top 5 Add-backs:
${addbackDetails || 'No significant add-backs identified'}

Instructions: Write a 4-6 sentence executive summary that:
1. States the business name and key revenue/earnings figures
2. Highlights the normalized earnings (SDE and EBITDA)
3. Mentions the add-backs identified
4. Provides a brief assessment of the business's financial health
`,
        business_overview: `
Write a business overview for ${report.business_name}.

Business Information:
- Industry: ${report.industry || 'Not specified'}
- Revenue: ₹${metrics.totalRevenue.toLocaleString()}
- EBITDA: ₹${metrics.ebitda.toLocaleString()}
- SDE: ₹${metrics.sde.toLocaleString()}
- Number of Transactions: ${metrics.transactionCount}
- Number of Add-backs: ${metrics.addbackCount}

Top 10 Transactions:
${topTransactions || 'No transactions available'}

Instructions: Write a 3-5 sentence business overview that:
1. Describes the business and its industry
2. Highlights the business's financial performance
3. Mentions the key strengths or characteristics
4. References the normalized earnings metrics
`,
        financial_analysis: `
Write a financial performance analysis for ${report.business_name}.

Financial Summary:
- Revenue: ₹${metrics.totalRevenue.toLocaleString()}
- EBITDA: ₹${metrics.ebitda.toLocaleString()}
- SDE: ₹${metrics.sde.toLocaleString()}
- Net Income: ₹${metrics.netIncome.toLocaleString()}
- Total Add-backs: ₹${metrics.totalAddbacks.toLocaleString()}

Key Ratios:
- Gross Margin: ${metrics.grossMargin.toFixed(1)}%
- EBITDA Margin: ${metrics.ebitdaMargin.toFixed(1)}%
- SDE Margin: ${metrics.sdeMargin.toFixed(1)}%

Add-back Details:
${addbackDetails || 'No add-backs identified'}

Instructions: Write a 4-6 sentence financial analysis that:
1. Analyzes revenue and earnings trends
2. Discusses the profitability margins
3. Explains the key add-backs and their impact
4. Provides overall assessment of financial health
`,
        addback_explanation: `
Provide an explanation of the add-backs identified for ${report.business_name}.

Add-back Summary:
- Total Add-backs: ₹${metrics.totalAddbacks.toLocaleString()}
- Number of Add-backs: ${metrics.addbackCount}
- SDE: ₹${metrics.sde.toLocaleString()}

Add-back Details:
${addbackDetails || 'No add-backs identified'}

Instructions: Write a 3-5 sentence explanation that:
1. Introduces the add-backs and their purpose
2. Lists the major add-back categories
3. Explains why these items are added back
4. Mentions the total impact on SDE
`,
        valuation_commentary: `
Provide valuation commentary for ${report.business_name}.

Financial Summary:
- Revenue: ₹${metrics.totalRevenue.toLocaleString()}
- EBITDA: ₹${metrics.ebitda.toLocaleString()}
- SDE: ₹${metrics.sde.toLocaleString()}
- Total Add-backs: ₹${metrics.totalAddbacks.toLocaleString()}

Key Ratios:
- EBITDA Margin: ${metrics.ebitdaMargin.toFixed(1)}%
- SDE Margin: ${metrics.sdeMargin.toFixed(1)}%

Industry: ${report.industry || 'Not specified'}

Instructions: Write a 3-5 sentence valuation commentary that:
1. Discusses the business's earnings quality
2. References the SDE and EBITDA metrics
3. Mentions the industry context
4. Provides a general assessment of valuation drivers
`
    };
    
    return {
        systemPrompt: `You are a professional financial writer preparing a Quality of Earnings report. Write in a ${toneDescription[tone] || 'professional'} tone. Use proper business writing style.`,
        userPrompt: sectionPrompts[section] || sectionPrompts.executive_summary
    };
}

// ============================================================
// Generate narrative with AI
// ============================================================
async function generateWithAI(promptData, section) {
    const { systemPrompt, userPrompt } = promptData;
    
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            config: {
                temperature: 0.4,
                maxOutputTokens: 1000,
                topP: 0.9,
            },
        });
        
        return response.text.trim();
    } catch (err) {
        console.error('AI Narrative error:', err);
        throw err;
    }
}

// ============================================================
// Save narrative
// ============================================================
async function saveNarrative(reportId, userId, section, content, tone) {
    const existing = await query(
        `SELECT id FROM generated_narratives 
         WHERE report_id = $1 AND user_id = $2 AND section = $3`,
        [reportId, userId, section]
    );
    
    let result;
    if (existing.rows.length > 0) {
        result = await query(
            `UPDATE generated_narratives 
             SET content = $1, tone = $2, updated_at = now()
             WHERE id = $3
             RETURNING *`,
            [content, tone, existing.rows[0].id]
        );
    } else {
        result = await query(
            `INSERT INTO generated_narratives (report_id, user_id, section, content, tone)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [reportId, userId, section, content, tone]
        );
    }
    
    return result.rows[0];
}

// ============================================================
// Get saved narratives
// ============================================================
async function getNarratives(reportId, userId) {
    const result = await query(
        `SELECT * FROM generated_narratives 
         WHERE report_id = $1 AND user_id = $2
         ORDER BY section ASC`,
        [reportId, userId]
    );
    
    return result.rows;
}

// ============================================================
// Fallback narrative
// ============================================================
function generateFallbackNarrative(reportData, section) {
    const { report, metrics } = reportData;
    
    const narratives = {
        executive_summary: `${report.business_name} generated revenue of ₹${metrics.totalRevenue.toLocaleString()} for the period, with EBITDA of ₹${metrics.ebitda.toLocaleString()} and Seller's Discretionary Earnings (SDE) of ₹${metrics.sde.toLocaleString()}. ${metrics.addbackCount > 0 ? `${metrics.addbackCount} add-backs totaling ₹${metrics.totalAddbacks.toLocaleString()} were identified and normalized.` : 'No significant add-backs were identified.'} The business operates in the ${report.industry || 'business'} sector and maintains a ${metrics.ebitdaMargin.toFixed(1)}% EBITDA margin.`,
        
        business_overview: `${report.business_name} is a ${report.industry || 'business'} with annual revenue of ₹${metrics.totalRevenue.toLocaleString()}. The business has demonstrated consistent performance with EBITDA of ₹${metrics.ebitda.toLocaleString()} and SDE of ₹${metrics.sde.toLocaleString()}.`,
        
        financial_analysis: `Financial analysis of ${report.business_name} shows revenue of ₹${metrics.totalRevenue.toLocaleString()} with EBITDA of ₹${metrics.ebitda.toLocaleString()} and SDE of ₹${metrics.sde.toLocaleString()}. The business maintains a gross margin of ${metrics.grossMargin.toFixed(1)}% and EBITDA margin of ${metrics.ebitdaMargin.toFixed(1)}%.`,
        
        addback_explanation: `${metrics.addbackCount} add-backs were identified totaling ₹${metrics.totalAddbacks.toLocaleString()} for ${report.business_name}. These adjustments normalize the earnings to reflect the true economic performance of the business.`,
        
        valuation_commentary: `${report.business_name} presents a valuation supported by revenue of ₹${metrics.totalRevenue.toLocaleString()}, EBITDA of ₹${metrics.ebitda.toLocaleString()}, and SDE of ₹${metrics.sde.toLocaleString()}. The business shows ${metrics.ebitdaMargin > 15 ? 'strong' : 'moderate'} profitability with an EBITDA margin of ${metrics.ebitdaMargin.toFixed(1)}%.`
    };
    
    return narratives[section] || 'Narrative not available for this section.';
}

// ============================================================
// Helper functions
// ============================================================
function formatCurrency(value) {
    if (!value) return '₹0';
    return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

module.exports = {
    generateNarrative,
    getNarratives,
};