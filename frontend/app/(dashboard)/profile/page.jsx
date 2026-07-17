'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import {
    User,
    Mail,
    Building2,
    Phone,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Edit2,
    X,
    Camera,
    LogOut,
    Shield,
    Calendar,
    Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showChangePassword, setShowChangePassword] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        companyName: '',
        phone: '',
    });

    // Load user data
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
            return;
        }
        if (user) {
            setFormData({
                fullName: user.full_name || '',
                email: user.email || '',
                companyName: user.company_name || '',
                phone: user.phone || '',
            });
        }
    }, [user, loading, router]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
        setSuccess(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await api.updateProfile(formData);
            setSuccess('Profile updated successfully!');
            setIsEditing(false);
            toast.success('Profile updated successfully!');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to update profile');
            toast.error('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading profile...</p>
                </div>
            </div>
        );
    }

    // Get initials
    const getInitials = (fullName) => {
        if (!fullName) return 'U';
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return fullName.slice(0, 2).toUpperCase();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Manage your personal information and account settings
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition"
                            >
                                <Edit2 size={16} />
                                Edit Profile
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({
                                        fullName: user.full_name || '',
                                        email: user.email || '',
                                        companyName: user.company_name || '',
                                        phone: user.phone || '',
                                    });
                                    setError(null);
                                    setSuccess(null);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                            >
                                <X size={16} />
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Cover / Avatar Section */}
                    <div className="relative">
                        <div className="h-32 bg-gradient-to-r from-indigo-600 to-violet-600"></div>
                        <div className="absolute -bottom-12 left-8">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg border-4 border-white">
                                    {getInitials(formData.fullName || user.full_name)}
                                </div>
                                <button className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-lg">
                                    <Camera size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Profile Info */}
                    <div className="pt-16 px-6 pb-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                                <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={18} />
                                <p className="text-sm text-emerald-700">{success}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <User size={16} className="inline mr-1.5 text-indigo-500" />
                                    Full Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => handleChange('fullName', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="Your full name"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-900 py-2.5">
                                        {formData.fullName || 'Not set'}
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Mail size={16} className="inline mr-1.5 text-indigo-500" />
                                    Email Address
                                </label>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="your@email.com"
                                        disabled
                                    />
                                ) : (
                                    <p className="text-sm text-slate-900 py-2.5">
                                        {formData.email || 'Not set'}
                                    </p>
                                )}
                                {!isEditing && (
                                    <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                                )}
                            </div>

                            {/* Company Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Building2 size={16} className="inline mr-1.5 text-indigo-500" />
                                    Company / Brokerage
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.companyName}
                                        onChange={(e) => handleChange('companyName', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="Your company name"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-900 py-2.5">
                                        {formData.companyName || 'Not set'}
                                    </p>
                                )}
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <Phone size={16} className="inline mr-1.5 text-indigo-500" />
                                    Phone Number
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="+91 98765 43210"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-900 py-2.5">
                                        {formData.phone || 'Not set'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Account Stats */}
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-medium text-slate-700 mb-3">Account Information</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Account Type</p>
                                    <p className="text-sm font-medium text-slate-900 capitalize">
                                        {user.plan || 'Free'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Member Since</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        }) : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Status</p>
                                    <p className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Active
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Save Button (when editing) */}
                        {isEditing && (
                            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Logout Button */}
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition"
                            >
                                <LogOut size={18} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Shield className="text-amber-600" size={20} />
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-900">Security</h3>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Manage your password and security settings
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowChangePassword(true)}
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition"
                        >
                            Change Password →
                        </button>
                    </div>
                </div>

                {/* Change Password Modal */}
                <ChangePasswordModal
                    isOpen={showChangePassword}
                    onClose={() => setShowChangePassword(false)}
                />
            </div>
        </div>
    );
}