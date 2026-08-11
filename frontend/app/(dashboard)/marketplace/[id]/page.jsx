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
    Star,
    Award,
    Shield,
    Clock,
    Zap,
    CheckCircle,
    AlertCircle
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
    const [isLiked, setIsLiked] = useState(false);

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

    const handleLike = () => {
        setIsLiked(!isLiked);
        toast.success(isLiked ? 'Removed from favorites' : 'Added to favorites');
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

    const shareListing = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/30">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading listing...</p>
                </div>
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/30">
                <div className="text-center">
                    <Building2 size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Listing not found</h2>
                    <button
                        onClick={() => router.push('/marketplace')}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
                    >
                        Back to Marketplace
                    </button>
                </div>
            </div>
        );
    }

    const hasLogo = listing.logo_url && listing.logo_url !== 'null';
    const hasContactEmail = listing.contact_email && listing.contact_email !== 'null';
    const hasContactPhone = listing.contact_phone && listing.contact_phone !== 'null';
    const hasContactName = listing.contact_name && listing.contact_name !== 'null';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/30 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/marketplace')}
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition mb-6 group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition" />
                    Back to Marketplace
                </button>

                {/* Main Content */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Image */}
                    <div className="relative h-64 bg-slate-100 dark:bg-slate-700">
                        {hasLogo ? (
                            <img
                                src={listing.logo_url}
                                alt={listing.business_name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center">
                                <span className="text-white text-6xl font-bold">
                                    {listing.business_name?.charAt(0).toUpperCase() || 'B'}
                                </span>
                            </div>
                        )}
                        {listing.is_featured && (
                            <div className="absolute top-4 right-4 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
                                <Star size={12} />
                                Featured
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-sm text-white rounded-full text-xs font-medium flex items-center gap-1">
                            <Eye size={12} />
                            {listing.views || 0} views
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {listing.business_name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="text-sm px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                        {listing.industry || 'Uncategorized'}
                                    </span>
                                    {listing.sub_industry && (
                                        <span className="text-sm px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                                            {listing.sub_industry}
                                        </span>
                                    )}
                                    {listing.established_year && (
                                        <span className="text-sm px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center gap-1">
                                            <Calendar size={12} />
                                            Est. {listing.established_year}
                                        </span>
                                    )}
                                    {listing.employees && (
                                        <span className="text-sm px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center gap-1">
                                            <Users size={12} />
                                            {listing.employees} employees
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(listing.asking_price)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Asking Price</p>
                            </div>
                        </div>

                        {/* Location - Clickable */}
                        {listing.location && (
                            <button
                                onClick={() => openLocation(listing.location)}
                                className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-3 transition group/loc"
                            >
                                <MapPin size={16} className="group-hover/loc:animate-bounce" />
                                <span className="hover:underline">{listing.location}</span>
                                <ExternalLink size={14} className="opacity-60" />
                            </button>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                    {formatCurrency(listing.revenue)}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">EBITDA</p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                    {formatCurrency(listing.ebitda)}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">SDE</p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                    {formatCurrency(listing.sde)}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employees</p>
                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                    {listing.employees || '—'}
                                </p>
                            </div>
                        </div>

                        {/* Website */}
                        {listing.website && (
                            <div className="mt-4">
                                <a 
                                    href={listing.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    <Globe size={14} />
                                    {listing.website}
                                    <ExternalLink size={12} />
                                </a>
                            </div>
                        )}

                        {/* Description */}
                        {listing.description && (
                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">About the Business</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {listing.description}
                                </p>
                            </div>
                        )}

                        {/* Contact & Actions */}
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap items-center gap-3">
                                {showContact ? (
                                    <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 border border-slate-200 dark:border-slate-700 min-w-[200px]">
                                        {hasContactName && (
                                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                                <span className="font-medium">Contact:</span> {listing.contact_name}
                                            </p>
                                        )}
                                        {hasContactPhone && (
                                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                                <span className="font-medium">Phone:</span> {listing.contact_phone}
                                            </p>
                                        )}
                                        {hasContactEmail && (
                                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                                <span className="font-medium">Email:</span> {listing.contact_email}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowContact(true)}
                                        className="flex items-center gap-2 px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                    >
                                        <Phone size={16} />
                                        Show Contact Details
                                    </button>
                                )}
                                
                                {!isInterested ? (
                                    <button
                                        onClick={handleInterest}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition shadow-sm hover:shadow-md"
                                    >
                                        <Heart size={16} />
                                        Express Interest
                                    </button>
                                ) : (
                                    <span className="px-6 py-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium flex items-center gap-2">
                                        <CheckCircle size={16} />
                                        Interest Sent
                                    </span>
                                )}

                                <button
                                    onClick={handleLike}
                                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                >
                                    <Heart size={20} className={isLiked ? 'fill-red-500 text-red-500' : 'text-slate-400 dark:text-slate-500'} />
                                </button>
                            </div>
                        </div>

                        {/* Share */}
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={shareListing}
                                className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition"
                            >
                                <Share2 size={16} />
                                Share this listing
                            </button>
                        </div>

                        {/* Trust Badge */}
                        <div className="mt-4 p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                <Shield size={14} className="text-indigo-600 dark:text-indigo-400" />
                                <span>Verified listing by <span className="font-medium">{listing.user_name || 'Ledger AI'}</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}