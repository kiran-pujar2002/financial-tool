'use client';

import { useState } from 'react';
import { 
    X, 
    Link2, 
    Copy, 
    Check, 
    Clock, 
    Lock,
    Eye,
    Download,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function ShareModal({ isOpen, onClose, reportId }) {
    const [isLoading, setIsLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [shareLinks, setShareLinks] = useState([]);
    const [copied, setCopied] = useState(false);
    
    // Form state
    const [password, setPassword] = useState('');
    const [expiresIn, setExpiresIn] = useState('7'); // days
    const [maxViews, setMaxViews] = useState('');
    const [allowDownload, setAllowDownload] = useState(false);
    const [allowPrint, setAllowPrint] = useState(true);

    // Load existing share links
    useState(() => {
        if (isOpen && reportId) {
            loadShareLinks();
        }
    }, [isOpen, reportId]);

    const loadShareLinks = async () => {
        try {
            const data = await api.share.getLinks(reportId);
            setShareLinks(data.shareLinks || []);
        } catch (err) {
            console.error('Failed to load share links:', err);
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            // Calculate expiresAt
            let expiresAt = null;
            if (expiresIn) {
                const date = new Date();
                date.setDate(date.getDate() + parseInt(expiresIn));
                expiresAt = date.toISOString();
            }

            const data = await api.share.create({
                reportId,
                password: password || undefined,
                expiresAt,
                maxViews: maxViews ? parseInt(maxViews) : undefined,
                allowDownload,
                allowPrint
            });

            setShareUrl(data.shareUrl);
            toast.success('Share link created!');
            await loadShareLinks();
        } catch (err) {
            toast.error('Failed to create share link');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
    };

    const handleRevoke = async (linkId) => {
        if (!confirm('Are you sure you want to revoke this share link?')) return;
        
        try {
            await api.share.revoke(linkId);
            toast.success('Share link revoked');
            await loadShareLinks();
        } catch (err) {
            toast.error('Failed to revoke link');
        }
    };

    const formatDate = (date) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-900">Share Report</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-lg transition"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Generate New Link */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <h3 className="font-medium text-slate-900 mb-3">Generate New Share Link</h3>
                        
                        <div className="space-y-3">
                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Lock size={14} className="inline mr-1" />
                                    Password Protection (optional)
                                </label>
                                <input
                                    type="text"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Leave blank for no password"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Expiration */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Clock size={14} className="inline mr-1" />
                                    Expires In
                                </label>
                                <select
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="1">1 Day</option>
                                    <option value="3">3 Days</option>
                                    <option value="7">7 Days</option>
                                    <option value="14">14 Days</option>
                                    <option value="30">30 Days</option>
                                    <option value="">Never</option>
                                </select>
                            </div>

                            {/* Max Views */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Eye size={14} className="inline mr-1" />
                                    Max Views (optional)
                                </label>
                                <input
                                    type="number"
                                    value={maxViews}
                                    onChange={(e) => setMaxViews(e.target.value)}
                                    placeholder="Unlimited"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Permissions */}
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={allowDownload}
                                        onChange={(e) => setAllowDownload(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Allow Download
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={allowPrint}
                                        onChange={(e) => setAllowPrint(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Allow Print
                                </label>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Link2 size={16} />
                                        Generate Share Link
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Generated Link */}
                    {shareUrl && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-emerald-700">Link Generated!</p>
                                    <p className="text-sm text-emerald-600 truncate">{shareUrl}</p>
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition flex items-center gap-1"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Existing Links */}
                    {shareLinks.length > 0 && (
                        <div>
                            <h3 className="font-medium text-slate-900 mb-3">Existing Share Links</h3>
                            <div className="space-y-2">
                                {shareLinks.map((link) => (
                                    <div key={link.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">
                                                {link.token.slice(0, 16)}...
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                                                <span>{link.views} views</span>
                                                {link.expires_at && (
                                                    <span>Expires: {formatDate(link.expires_at)}</span>
                                                )}
                                                {link.max_views && (
                                                    <span>Max: {link.max_views}</span>
                                                )}
                                                {link.password_hash && (
                                                    <span className="flex items-center gap-1">
                                                        <Lock size={10} /> Protected
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRevoke(link.id)}
                                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition text-sm"
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}