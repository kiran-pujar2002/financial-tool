// routes/assistant.js
const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { processQuestion, getChatHistory } = require('../services/aiAssistant');

const router = express.Router();

// ============================================================
// POST /api/assistant/chat - Send a question
// ============================================================
router.post('/chat', authenticate, asyncHandler(async (req, res) => {
    const { reportId, question, sessionId } = req.body;
    
    if (!reportId) {
        throw new HttpError(400, 'reportId is required');
    }
    
    if (!question) {
        throw new HttpError(400, 'question is required');
    }
    
    // Verify report ownership
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    // Get chat history for context
    let chatHistory = [];
    if (sessionId) {
        const historyResult = await query(
            `SELECT role, content FROM chat_messages 
             WHERE session_id = $1 
             ORDER BY created_at ASC LIMIT 10`,
            [sessionId]
        );
        chatHistory = historyResult.rows;
    }
    
    // Process question
    const answer = await processQuestion(reportId, question, chatHistory, req.user.id);
    
    // Get or create session
    let sessionIdResult;
    if (sessionId) {
        sessionIdResult = sessionId;
    } else {
        const newSession = await query(
            `INSERT INTO chat_sessions (report_id, user_id, title) 
             VALUES ($1, $2, $3) RETURNING id`,
            [reportId, req.user.id, question.substring(0, 50)]
        );
        sessionIdResult = newSession.rows[0].id;
    }
    
    res.json({
        sessionId: sessionIdResult,
        answer: answer,
        question: question
    });
}));

// ============================================================
// GET /api/assistant/history/:reportId - Get chat history
// ============================================================
router.get('/history/:reportId', authenticate, asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    const reportResult = await query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
        throw new HttpError(404, 'Report not found');
    }
    
    const history = await getChatHistory(reportId, req.user.id);
    
    res.json({ sessions: history });
}));

// ============================================================
// DELETE /api/assistant/session/:sessionId - Delete a session
// ============================================================
router.delete('/session/:sessionId', authenticate, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    const result = await query(
        'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
        [sessionId, req.user.id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'Session not found');
    }
    
    res.json({ success: true, message: 'Chat session deleted' });
}));

module.exports = router;