'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    Send, 
    MessageSquare, 
    X, 
    Loader2,
    Trash2,
    Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api'; // ✅ Add this import

export default function ChatAssistant({ reportId, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
        // ✅ Use the API method instead of direct fetch
        const response = await api.assistant.chat(
            reportId,
            userMessage,
            sessionId
        );

        if (response.sessionId && !sessionId) {
            setSessionId(response.sessionId);
        }

        setMessages(prev => [...prev, { role: 'assistant', content: response.answer }]);
    } catch (err) {
        toast.error(err.message || 'Failed to get response');
        setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Sorry, I encountered an error. Please try again.' 
        }]);
    } finally {
        setIsLoading(false);
    }
};

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-t-2xl">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-600" />
                    <h3 className="font-semibold text-slate-900">AI Deal Assistant</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-100 rounded-lg transition"
                >
                    <X size={18} className="text-slate-500" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                        <MessageSquare size={40} className="text-slate-300 mb-3" />
                        <p className="text-sm font-medium">Ask me anything about this report</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Try: "What are the top add-backs?" or "Summarize this report"
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4 justify-center">
                            {[
                                "What are the key metrics?",
                                "Show me top add-backs",
                                "Any red flags?",
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setInput(suggestion);
                                        setTimeout(() => sendMessage(), 100);
                                    }}
                                    className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 transition"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                                    msg.role === 'user'
                                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                                        : 'bg-slate-100 text-slate-800'
                                }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 px-4 py-2.5 rounded-2xl">
                            <Loader2 size={18} className="animate-spin text-indigo-600" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question..."
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="p-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:shadow-lg transition disabled:opacity-50"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-center">
                    AI may make mistakes. Verify important information.
                </p>
            </div>
        </div>
    );
}