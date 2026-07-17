'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { 
    Building2, 
    Mail, 
    Phone, 
    Globe, 
    Palette,
    Upload,
    X,
    Check,
    RefreshCw,
    Eye,
    EyeOff,
    Download
} from 'lucide-react';
import toast from 'react-hot-toast';

const TEMPLATES = [
    { id: 'professional', name: 'Professional', description: 'Classic dark blue theme' },
    { id: 'modern', name: 'Modern', description: 'Clean indigo/violet gradient' },
    { id: 'minimal', name: 'Minimal', description: 'Simple and elegant' },
];

const PRESET_COLORS = [
    { name: 'Navy', value: '#1a3a5c' },
    { name: 'Indigo', value: '#4F46E5' },
    { name: 'Violet', value: '#7C3AED' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Rose', value: '#E11D48' },
    { name: 'Amber', value: '#D97706' },
];

export default function BrandingSettingsPage() {
    const { user } = useAuth();
    const fileInputRef = useRef(null);
    
    const [branding, setBranding] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        firm_name: '',
        contact_email: '',
        contact_phone: '',
        website: '',
        primary_color: '#1a3a5c',
        secondary_color: '#2e7d32',
        accent_color: '#4F46E5',
        template_layout: 'professional',
        disclaimer_text: '',
        show_watermark: false,
        logo_url: null,
    });

    // Load branding data
    useEffect(() => {
        loadBranding();
    }, []);

    const loadBranding = async () => {
        setIsLoading(true);
        try {
            const data = await api.get('/branding');
            if (data.branding) {
                setBranding(data.branding);
                setFormData({
                    firm_name: data.branding.firm_name || '',
                    contact_email: data.branding.contact_email || '',
                    contact_phone: data.branding.contact_phone || '',
                    website: data.branding.website || '',
                    primary_color: data.branding.primary_color || '#1a3a5c',
                    secondary_color: data.branding.secondary_color || '#2e7d32',
                    accent_color: data.branding.accent_color || '#4F46E5',
                    template_layout: data.branding.template_layout || 'professional',
                    disclaimer_text: data.branding.disclaimer_text || '',
                    show_watermark: data.branding.show_watermark || false,
                    logo_url: data.branding.logo_url || null,
                });
            }
        } catch (err) {
            toast.error('Failed to load branding settings');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle form changes
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Handle logo upload
    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('logo', file);

        try {
            const result = await api.post('/branding/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData(prev => ({ ...prev, logo_url: result.logo_url }));
            toast.success('Logo uploaded successfully!');
        } catch (err) {
            toast.error('Failed to upload logo');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle logo removal
    const handleRemoveLogo = async () => {
        try {
            await api.delete('/branding/logo');
            setFormData(prev => ({ ...prev, logo_url: null }));
            toast.success('Logo removed');
        } catch (err) {
            toast.error('Failed to remove logo');
        }
    };

    // Save branding settings
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.put('/branding', formData);
            toast.success('Branding settings saved!');
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    // Preview report
    const handlePreview = () => {
        setPreviewMode(!previewMode);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading branding settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Branding Settings</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Customize how your reports look with your firm's branding
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePreview}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                        >
                            {previewMode ? <EyeOff size={16} /> : <Eye size={16} />}
                            {previewMode ? 'Hide Preview' : 'Preview'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    Save Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Preview Card */}
                {previewMode && (
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 mb-8">
                        <h3 className="font-semibold text-slate-900 mb-4">Report Preview</h3>
                        <div className="border rounded-xl p-8 bg-slate-50">
                            <div className="max-w-2xl mx-auto">
                                {/* Cover Page Preview */}
                                <div 
                                    className="rounded-xl p-8 text-white text-center"
                                    style={{ backgroundColor: formData.primary_color }}
                                >
                                    {formData.logo_url && (
                                        <img 
                                            src={formData.logo_url} 
                                            alt="Logo" 
                                            className="h-16 mx-auto mb-4 object-contain"
                                        />
                                    )}
                                    <h2 className="text-2xl font-bold">{formData.firm_name || 'Your Firm Name'}</h2>
                                    <p className="text-white/70 mt-1">Quality of Earnings Report</p>
                                    <div className="mt-4 pt-4 border-t border-white/20">
                                        <p className="text-sm">{formData.contact_email || 'your@email.com'}</p>
                                        <p className="text-sm">{formData.contact_phone || '+91 98765 43210'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings Form */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                    {/* Firm Details */}
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Firm Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Building2 size={16} className="inline mr-1.5 text-indigo-500" />
                                    Firm Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.firm_name}
                                    onChange={(e) => handleChange('firm_name', e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Reyes M&A Advisors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Mail size={16} className="inline mr-1.5 text-indigo-500" />
                                    Contact Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.contact_email}
                                    onChange={(e) => handleChange('contact_email', e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="info@reyesadvisors.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Phone size={16} className="inline mr-1.5 text-indigo-500" />
                                    Contact Phone
                                </label>
                                <input
                                    type="tel"
                                    value={formData.contact_phone}
                                    onChange={(e) => handleChange('contact_phone', e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Globe size={16} className="inline mr-1.5 text-indigo-500" />
                                    Website
                                </label>
                                <input
                                    type="url"
                                    value={formData.website}
                                    onChange={(e) => handleChange('website', e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="www.reyesadvisors.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Logo */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Logo</h3>
                        <div className="flex items-center gap-6">
                            <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50 overflow-hidden">
                                {formData.logo_url ? (
                                    <img 
                                        src={formData.logo_url} 
                                        alt="Logo" 
                                        className="w-full h-full object-contain p-2"
                                    />
                                ) : (
                                    <Building2 size={48} className="text-slate-300" />
                                )}
                            </div>
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".png,.jpg,.jpeg,.svg"
                                    className="hidden"
                                    onChange={handleLogoUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Upload Logo
                                        </>
                                    )}
                                </button>
                                {formData.logo_url && (
                                    <button
                                        onClick={handleRemoveLogo}
                                        className="mt-2 text-sm text-red-600 hover:text-red-700 transition"
                                    >
                                        Remove logo
                                    </button>
                                )}
                                <p className="text-xs text-slate-500 mt-2">
                                    PNG, JPG, or SVG • Max 5MB
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            <Palette size={18} className="inline mr-2 text-indigo-500" />
                            Colors
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Primary Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.primary_color}
                                        onChange={(e) => handleChange('primary_color', e.target.value)}
                                        className="w-12 h-12 rounded-lg cursor-pointer border border-slate-200"
                                    />
                                    <input
                                        type="text"
                                        value={formData.primary_color}
                                        onChange={(e) => handleChange('primary_color', e.target.value)}
                                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex gap-1 mt-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color.value}
                                            onClick={() => handleChange('primary_color', color.value)}
                                            className="w-6 h-6 rounded-full border-2 border-slate-200 hover:border-indigo-500 transition"
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Secondary Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.secondary_color}
                                        onChange={(e) => handleChange('secondary_color', e.target.value)}
                                        className="w-12 h-12 rounded-lg cursor-pointer border border-slate-200"
                                    />
                                    <input
                                        type="text"
                                        value={formData.secondary_color}
                                        onChange={(e) => handleChange('secondary_color', e.target.value)}
                                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Accent Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.accent_color}
                                        onChange={(e) => handleChange('accent_color', e.target.value)}
                                        className="w-12 h-12 rounded-lg cursor-pointer border border-slate-200"
                                    />
                                    <input
                                        type="text"
                                        value={formData.accent_color}
                                        onChange={(e) => handleChange('accent_color', e.target.value)}
                                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Template & Options */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Template Options</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Template Layout
                                </label>
                                <select
                                    value={formData.template_layout}
                                    onChange={(e) => handleChange('template_layout', e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {TEMPLATES.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    {TEMPLATES.find(t => t.id === formData.template_layout)?.description}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Options
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.show_watermark}
                                        onChange={(e) => handleChange('show_watermark', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Show watermark on reports
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Disclaimer</h3>
                        <textarea
                            value={formData.disclaimer_text}
                            onChange={(e) => handleChange('disclaimer_text', e.target.value)}
                            rows={4}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Add your custom disclaimer text here..."
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            This disclaimer will appear on every report. Leave blank to use the default.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}