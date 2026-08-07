// services/aiAssistant.js
const { GoogleGenAI } = require('@google/genai');
const { query } = require('../config/db');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const EMBEDDING_MODEL = 'models/embedding-001'; // Gemini embedding model

// ============================================================
// Process a user question about a report
// ============================================================
async function processQuestion(reportId, question, chatHistory = [], userId) {
    // 1. Get report data
    const report = await getReportData(reportId);
    
    // 2. Get relevant context using VECTOR search
    const context = await getRelevantContext(reportId, question);
    
    // 3. Build prompt
    const prompt = buildPrompt(report, context, question, chatHistory);
    
    // 4. Get AI response
    const response = await getAIResponse(prompt);
    
    // 5. Save to database
    await saveChatMessage(reportId, question, response, userId);
    
    return response;
}

// ============================================================
// Get report data
// ============================================================
async function getReportData(reportId) {
    const reportResult = await query(
        `SELECT id, business_name, industry, total_revenue, 
                ebitda, sde, total_addbacks, ai_summary
         FROM reports WHERE id = $1`,
        [reportId]
    );
    
    if (reportResult.rows.length === 0) {
        throw new Error('Report not found');
    }
    
    const report = reportResult.rows[0];
    
    // Get transactions
    const txnsResult = await query(
        `SELECT description, category, amount, is_addback, addback_reason
         FROM transactions WHERE report_id = $1
         ORDER BY ABS(amount) DESC LIMIT 50`,
        [reportId]
    );
    
    // Get addbacks
    const addbacksResult = await query(
        `SELECT label, amount, justification, transaction_count
         FROM addback_schedule WHERE report_id = $1
         ORDER BY amount DESC`,
        [reportId]
    );
    
    return {
        report,
        transactions: txnsResult.rows,
        addbacks: addbacksResult.rows
    };
}

// ============================================================
// ✅ VECTOR-BASED RAG: Get relevant context using embeddings
// ============================================================
async function getRelevantContext(reportId, question) {
    try {
        // 1. Convert user question to embedding (vector)
        const questionEmbedding = await getEmbedding(question);
        
        if (!questionEmbedding || questionEmbedding.length === 0) {
            console.warn('⚠️ Failed to get embedding for question, falling back to keyword search');
            return getKeywordContext(reportId, question);
        }
        
        // 2. ✅ VECTOR SIMILARITY SEARCH
        // Uses cosine distance (<->) to find the most similar chunks
        const result = await query(
            `SELECT chunk_text, chunk_type, metadata,
                    1 - (embedding <=> $2) as similarity
             FROM report_context
             WHERE report_id = $1
             ORDER BY embedding <=> $2  -- Cosine distance (lower = more similar)
             LIMIT 6`, // Get top 6 most relevant chunks
            [reportId, JSON.stringify(questionEmbedding)]
        );
        
        console.log(`✅ Found ${result.rows.length} relevant chunks using vector search`);
        
        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            transactions: result.rows.filter(r => r.chunk_type === 'transaction'),
            addbacks: result.rows.filter(r => r.chunk_type === 'addback'),
            summary: result.rows.filter(r => r.chunk_type === 'summary'),
            allChunks: result.rows
        };
        
    } catch (err) {
        console.error('❌ Vector search failed, falling back to keyword search:', err.message);
        return getKeywordContext(reportId, question);
    }
}

// ============================================================
// Fallback: Keyword-based context (when vector fails)
// ============================================================
async function getKeywordContext(reportId, question) {
    console.log('📝 Using keyword-based context (fallback)');
    
    const keywords = question.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(k => k.length > 3);
    
    if (keywords.length === 0) {
        return { transactions: [], addbacks: [], summary: [], allChunks: [] };
    }
    
    const conditions = keywords.map(k => `LOWER(chunk_text) LIKE '%${k}%'`);
    const whereClause = conditions.join(' OR ');
    
    const result = await query(
        `SELECT chunk_text, chunk_type, metadata
         FROM report_context
         WHERE report_id = $1 AND (${whereClause})
         LIMIT 6`,
        [reportId]
    );
    
    return {
        transactions: result.rows.filter(r => r.chunk_type === 'transaction'),
        addbacks: result.rows.filter(r => r.chunk_type === 'addback'),
        summary: result.rows.filter(r => r.chunk_type === 'summary'),
        allChunks: result.rows
    };
}

// ============================================================
// Build prompt for AI
// ============================================================
function buildPrompt(report, context, question, chatHistory) {
    const { report: reportData, transactions, addbacks } = report;
    
    // Format all transactions for prompt
    const txnSummary = transactions.slice(0, 15).map(t => 
        `- ${t.description}: ${t.category} - ₹${Number(t.amount).toLocaleString()}${t.is_addback ? ' ★(Add-back)' : ''}`
    ).join('\n') || 'No transactions available';
    
    // Format all addbacks for prompt
    const addbackSummary = addbacks.map(a => 
        `- ${a.label}: ₹${Number(a.amount).toLocaleString()}${a.justification ? ` (${a.justification})` : ''}`
    ).join('\n') || 'No add-backs identified';
    
    // ✅ FORMAT RELEVANT CONTEXT FROM VECTOR SEARCH
    const relevantChunks = context.allChunks || [];
    const relevantText = relevantChunks.length > 0
        ? relevantChunks.map(c => `- ${c.chunk_text}`).join('\n')
        : 'No specific relevant context found.';
    
    const historyText = chatHistory.length > 0 
        ? chatHistory.map(m => `${m.role}: ${m.content}`).join('\n') 
        : 'No previous messages.';
    
    return `
You are an AI financial analyst assistant helping a business broker understand a Quality of Earnings report.

=== REPORT INFORMATION ===
Business Name: ${reportData.business_name}
Industry: ${reportData.industry || 'Not specified'}
Revenue: ₹${Number(reportData.total_revenue).toLocaleString()}
EBITDA: ₹${Number(reportData.ebitda).toLocaleString()}
SDE: ₹${Number(reportData.sde).toLocaleString()}
Total Add-backs: ₹${Number(reportData.total_addbacks).toLocaleString()}

Executive Summary: ${reportData.ai_summary || 'No summary available'}

=== ALL TRANSACTIONS (Top 15) ===
${txnSummary}

=== ALL ADD-BACKS ===
${addbackSummary}

=== 🔍 RELEVANT CONTEXT (AI-sourced from vector search) ===
${relevantText}

=== CHAT HISTORY ===
${historyText}

=== USER QUESTION ===
${question}

=== INSTRUCTIONS ===
1. Answer based on the report information and relevant context provided above.
2. If the information is not in the report, say "I don't have that information in this report."
3. Use professional, clear language suitable for a business broker.
4. Provide specific numbers and details when available.
5. Be concise but thorough.
6. When relevant context is found, incorporate it into your answer.

Answer:`;
}

// ============================================================
// Get AI response
// ============================================================
async function getAIResponse(prompt) {
    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.3,
                maxOutputTokens: 1000,
            },
        });
        
        return response.text.trim();
    } catch (err) {
        console.error('❌ AI Assistant error:', err);
        return 'I encountered an error processing your question. Please try again.';
    }
}

// ============================================================
// Helper: Get embedding from Gemini
// ============================================================
async function getEmbedding(text) {
    try {
        // Clean and truncate text if needed
        const cleanText = text.trim().slice(0, 2000); // Limit length
        
        const response = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ parts: [{ text: cleanText }] }],
        });
        
        return response.embedding.values; // Array of numbers
    } catch (err) {
        console.error('❌ Embedding error:', err.message);
        throw err;
    }
}

// ============================================================
// Generate and store embeddings for a report
// ============================================================
async function generateAndStoreEmbeddings(reportId) {
    console.log(`📊 Generating embeddings for report: ${reportId}`);
    
    try {
        const reportData = await getReportData(reportId);
        let count = 0;
        
        // 1. Store executive summary
        if (reportData.report.ai_summary) {
            const text = `Executive Summary: ${reportData.report.ai_summary}`;
            const embedding = await getEmbedding(text);
            await query(
                `INSERT INTO report_context (report_id, chunk_text, chunk_type, embedding, metadata)
                 VALUES ($1, $2, 'summary', $3, $4)`,
                [reportId, text, JSON.stringify(embedding), JSON.stringify({ type: 'summary' })]
            );
            count++;
            await delay(100); // Rate limit
        }
        
        // 2. Store transactions as chunks
        for (const txn of reportData.transactions.slice(0, 30)) {
            const text = `${txn.description}: ${txn.category} - ₹${Number(txn.amount).toLocaleString()}${txn.is_addback ? ' (Add-back)' : ''}`;
            const embedding = await getEmbedding(text);
            await query(
                `INSERT INTO report_context (report_id, chunk_text, chunk_type, embedding, metadata)
                 VALUES ($1, $2, 'transaction', $3, $4)`,
                [reportId, text, JSON.stringify(embedding), JSON.stringify({ 
                    amount: txn.amount,
                    is_addback: txn.is_addback 
                })]
            );
            count++;
            await delay(100); // Rate limit
        }
        
        // 3. Store addbacks as chunks
        for (const addback of reportData.addbacks) {
            const text = `Add-back: ${addback.label} - ₹${Number(addback.amount).toLocaleString()}${addback.justification ? ` (${addback.justification})` : ''}`;
            const embedding = await getEmbedding(text);
            await query(
                `INSERT INTO report_context (report_id, chunk_text, chunk_type, embedding, metadata)
                 VALUES ($1, $2, 'addback', $3, $4)`,
                [reportId, text, JSON.stringify(embedding), JSON.stringify({ 
                    amount: addback.amount 
                })]
            );
            count++;
            await delay(100); // Rate limit
        }
        
        console.log(`✅ Generated ${count} embeddings for report ${reportId}`);
        return { success: true, count };
        
    } catch (err) {
        console.error('❌ Error generating embeddings:', err);
        return { success: false, error: err.message };
    }
}

// ============================================================
// Helper: Delay function for rate limiting
// ============================================================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Save chat message
// ============================================================
async function saveChatMessage(reportId, question, answer, userId) {
    // Get or create session
    let sessionResult = await query(
        `SELECT id FROM chat_sessions 
         WHERE report_id = $1 AND user_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [reportId, userId]
    );
    
    let sessionId;
    if (sessionResult.rows.length === 0) {
        const newSession = await query(
            `INSERT INTO chat_sessions (report_id, user_id, title) 
             VALUES ($1, $2, $3) RETURNING id`,
            [reportId, userId, question.substring(0, 50)]
        );
        sessionId = newSession.rows[0].id;
    } else {
        sessionId = sessionResult.rows[0].id;
    }
    
    // Save user message
    await query(
        `INSERT INTO chat_messages (session_id, role, content) 
         VALUES ($1, 'user', $2)`,
        [sessionId, question]
    );
    
    // Save assistant response
    await query(
        `INSERT INTO chat_messages (session_id, role, content) 
         VALUES ($1, 'assistant', $2)`,
        [sessionId, answer]
    );
}

// ============================================================
// Get chat history
// ============================================================
async function getChatHistory(reportId, userId) {
    const result = await query(
        `SELECT s.id, s.title, s.created_at,
                m.role, m.content, m.created_at as message_created_at
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON s.id = m.session_id
         WHERE s.report_id = $1 AND s.user_id = $2
         ORDER BY s.created_at DESC, m.created_at ASC`,
        [reportId, userId]
    );
    
    // Group messages by session
    const sessions = {};
    result.rows.forEach(row => {
        if (!sessions[row.id]) {
            sessions[row.id] = {
                id: row.id,
                title: row.title,
                created_at: row.created_at,
                messages: []
            };
        }
        if (row.role) {
            sessions[row.id].messages.push({
                role: row.role,
                content: row.content,
                created_at: row.message_created_at
            });
        }
    });
    
    return Object.values(sessions);
}

module.exports = {
    processQuestion,
    getChatHistory,
    generateAndStoreEmbeddings,
    getEmbedding,
};