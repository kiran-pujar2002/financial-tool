'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
    ArrowLeft,
    Building2,
    MapPin,
    DollarSign,
    TrendingUp,
    Eye,
    Heart,
    Phone,
    Mail,
    Globe,
    Users,
    Calendar,
    Briefcase,
    Share2,
    MessageCircle,
    Download,
    ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ListingDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const listingId = params.id;

    const [listing, setListing] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInterested, setIsInterested] = useState(false);
    const [showContact, setShowContact] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
            return;
        }
        if (user) {
            loadListing();
        }
    }, [user, authLoading, listingId]);

    const loadListing = async () => {
        setIsLoading(true);
        try {
            const data = await api.marketplace.getListing(listingId);
            setListing(data.listing);
            
            // Check if user already expressed interest
            // This would require another API call or include in response
        } catch (err) {
            toast.error('Failed to load listing');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInterest = async () => {
        try {
            await api.marketplace.expressInterest({
                listingId,
                message: 'I am interested in this business. Please contact me.',
            });
            setIsInterested(true);
            toast.success('Interest expressed! The seller will contact you.');
        } catch (err) {
            toast.error('Failed to express interest');
        }
    };

    const formatCurrency = (value) => {
        if (!value) return '—';
        return Number(value).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        });
    };

    const openLocation = (location) => {
        if (location) {
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(location)}`, '_blank');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm">Loading listing...</p>
                </div>
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Building2 size={48} className="text-slate-300 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-slate-900">Listing not found</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/marketplace')}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition mb-6"
                >
                    <ArrowLeft size={20} />
                    Back to Marketplace
                </button>

                {/* Main Content */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Image */}
                    <div className="relative h-64 bg-slate-100">
                        <img
                            src={listing.logo_url || 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=400&fit=crop'}
                            alt={listing.business_name}
                            className="w-full h-full object-cover"
                        />
                        {listing.is_featured && (
                            <div className="absolute top-4 right-4 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium shadow-lg">
                                ⭐ Featured
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{listing.business_name}</h1>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                    <span className="text-sm px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">
                                        {listing.industry || 'Uncategorized'}
                                    </span>
                                    {listing.sub_industry && (
                                        <span className="text-sm px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                                            {listing.sub_industry}
                                        </span>
                                    )}
                                    <span className="text-sm text-slate-500">
                                        {listing.views || 0} views
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-indigo-600">
                                    {formatCurrency(listing.asking_price)}
                                </p>
                                <p className="text-xs text-slate-500">Asking Price</p>
                            </div>
                        </div>

                        {/* Location - Clickable */}
                        {listing.location && (
                            <button
                                onClick={() => openLocation(listing.location)}
                                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mt-3 transition"
                            >
                                <MapPin size={16} />
                                <span className="hover:underline">{listing.location}</span>
                                <ExternalLink size={14} />
                            </button>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-500">Revenue</p>
                                <p className="font-semibold text-slate-900">{formatCurrency(listing.revenue)}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-500">EBITDA</p>
                                <p className="font-semibold text-slate-900">{formatCurrency(listing.ebitda)}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-500">SDE</p>
                                <p className="font-semibold text-slate-900">{formatCurrency(listing.sde)}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-slate-500">Employees</p>
                                <p className="font-semibold text-slate-900">{listing.employees || '—'}</p>
                            </div>
                        </div>

                        {/* Description */}
                        {listing.description && (
                            <div className="mt-6">
                                <h3 className="font-semibold text-slate-900 mb-2">About the Business</h3>
                                <p className="text-sm text-slate-600 leading-relaxed">{listing.description}</p>
                            </div>
                        )}

                        {/* Contact & Actions */}
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <div className="flex flex-wrap items-center gap-4">
                                {showContact ? (
                                    <div className="flex-1 bg-slate-50 rounded-xl p-4 space-y-2">
                                        {listing.contact_name && (
                                            <p className="text-sm"><span className="font-medium">Contact:</span> {listing.contact_name}</p>
                                        )}
                                        {listing.contact_phone && (
                                            <p className="text-sm"><span className="font-medium">Phone:</span> {listing.contact_phone}</p>
                                        )}
                                        {listing.contact_email && (
                                            <p className="text-sm"><span className="font-medium">Email:</span> {listing.contact_email}</p>
                                        )}
                                        {listing.website && (
                                            <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">
                                                {listing.website}
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowContact(true)}
                                        className="flex items-center gap-2 px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
                                    >
                                        <Phone size={16} />
                                        Show Contact Details
                                    </button>
                                )}
                                
                                {!isInterested ? (
                                    <button
                                        onClick={handleInterest}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                                    >
                                        <Heart size={16} />
                                        Express Interest
                                    </button>
                                ) : (
                                    <span className="px-6 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
                                        ✅ Interest Sent
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Share */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    toast.success('Link copied to clipboard!');
                                }}
                                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
                            >
                                <Share2 size={16} />
                                Share this listing
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}