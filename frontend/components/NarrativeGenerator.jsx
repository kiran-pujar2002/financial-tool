'use client';

import { useState } from 'react';
import { api } from '@/lib/api'; // ✅ Add this import
import { 
    Sparkles, 
    RefreshCw, 
    Copy, 
    Check, 
    Edit2, 
    Save,
    X,
    FileText,
    TrendingUp,
    Building2,
    DollarSign,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const SECTIONS = [
    { id: 'executive_summary', label: 'Executive Summary', icon: FileText },
    { id: 'business_overview', label: 'Business Overview', icon: Building2 },
    { id: 'financial_analysis', label: 'Financial Analysis', icon: TrendingUp },
    { id: 'addback_explanation', label: 'Add-back Explanations', icon: DollarSign },
    { id: 'valuation_commentary', label: 'Valuation Commentary', icon: TrendingUp },
];

const TONES = [
    { id: 'professional', label: 'Professional', description: 'Formal business tone' },
    { id: 'concise', label: 'Concise', description: 'Short and to the point' },
    { id: 'detailed', label: 'Detailed', description: 'Comprehensive explanation' },
    { id: 'investor_friendly', label: 'Investor-Friendly', description: 'Highlights growth potential' },
];

export default function NarrativeGenerator({ reportId, businessName }) {
    const [selectedSection, setSelectedSection] = useState('executive_summary');
    const [selectedTone, setSelectedTone] = useState('professional');
    const [narratives, setNarratives] = useState({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingSection, setEditingSection] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [copiedSection, setCopiedSection] = useState(null);

    const generateNarrative = async (section) => {
        setIsGenerating(true);
        try {
            // ✅ Use api.narratives.generate
            const response = await api.narratives.generate({
                reportId,
                section,
                tone: selectedTone
            });

            setNarratives(prev => ({
                ...prev,
                [section]: response.content
            }));
            
            toast.success(`${section.replace('_', ' ')} generated!`);
        } catch (err) {
            console.error('Generate error:', err);
            toast.error(err.message || 'Failed to generate narrative');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateAll = async () => {
        setIsGenerating(true);
        try {
            for (const section of SECTIONS) {
                const response = await api.narratives.generate({
                    reportId,
                    section: section.id,
                    tone: selectedTone
                });
                setNarratives(prev => ({
                    ...prev,
                    [section.id]: response.content
                }));
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            toast.success('All narratives generated!');
        } catch (err) {
            console.error('Generate all error:', err);
            toast.error(err.message || 'Failed to generate all narratives');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (section, content) => {
        navigator.clipboard.writeText(content);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
        toast.success('Copied to clipboard!');
    };

    const handleEdit = (section, content) => {
        setEditingSection(section);
        setEditContent(content);
    };

    const handleSaveEdit = async (section) => {
        try {
            setNarratives(prev => ({
                ...prev,
                [section]: editContent
            }));
            setEditingSection(null);
            toast.success('Narrative updated!');
        } catch (err) {
            toast.error('Failed to save');
        }
    };

    const getSectionIcon = (sectionId) => {
        const section = SECTIONS.find(s => s.id === sectionId);
        return section ? section.icon : FileText;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Automated Narratives</h3>
                    <p className="text-sm text-slate-500">
                        Generate professional narratives for your report sections
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Tone Selector */}
                    <select
                        value={selectedTone}
                        onChange={(e) => setSelectedTone(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {TONES.map(tone => (
                            <option key={tone.id} value={tone.id}>
                                {tone.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={generateAll}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Generate All
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Sections Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const content = narratives[section.id];
                    const isEditing = editingSection === section.id;
                    const isCopied = copiedSection === section.id;

                    return (
                        <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                    <Icon size={16} className="text-indigo-600" />
                                    <h4 className="font-medium text-sm text-slate-900">{section.label}</h4>
                                </div>
                                <div className="flex items-center gap-1">
                                    {content && (
                                        <>
                                            <button
                                                onClick={() => handleCopy(section.id, content)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                                                title="Copy"
                                            >
                                                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(section.id, content)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => generateNarrative(section.id)}
                                        disabled={isGenerating}
                                        className="p-1.5 text-indigo-600 hover:text-indigo-700 rounded-lg hover:bg-indigo-50 transition disabled:opacity-50"
                                        title="Generate"
                                    >
                                        <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            rows={4}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSaveEdit(section.id)}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingSection(null)}
                                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : content ? (
                                    <div className="prose prose-sm max-w-none">
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                            {content}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <AlertCircle size={24} className="text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500">No content generated yet</p>
                                        <button
                                            onClick={() => generateNarrative(section.id)}
                                            disabled={isGenerating}
                                            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                        >
                                            Generate {section.label}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}