'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
    Search,
    MapPin,
    DollarSign,
    TrendingUp,
    Eye,
    Heart,
    Users,
    Calendar,
    Plus,
    X,
    Store,
    ArrowUpRight,
    Clock,
    Sparkles,
    Building2,
    Briefcase,
    Filter,
    SlidersHorizontal,
    Grid3x3,
    LayoutList,
    Zap,
    Star,
    Award,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    TrendingDown,
    BarChart3,
    Target,
    CheckCircle,
    AlertCircle,
    Shield,
    User,
    Phone,
    Mail,
    Globe,
    Camera,
    Upload,
    Trash2,
    Edit3,
    ExternalLink,
    Loader2,
    Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

// Industry options
const INDUSTRIES = [
    { value: 'retail', label: '🛍️ Retail' },
    { value: 'manufacturing', label: '🏭 Manufacturing' },
    { value: 'technology', label: '💻 Technology' },
    { value: 'healthcare', label: '🏥 Healthcare' },
    { value: 'construction', label: '🏗️ Construction' },
    { value: 'hospitality', label: '🏨 Hospitality' },
    { value: 'food_beverage', label: '🍽️ Food & Beverage' },
    { value: 'ecommerce', label: '📦 E-commerce' },
    { value: 'services', label: '💼 Professional Services' },
    { value: 'real_estate', label: '🏠 Real Estate' },
    { value: 'education', label: '📚 Education' },
    { value: 'transportation', label: '🚚 Transportation' },
];

const SUB_INDUSTRIES = {
    retail: ['Hardware', 'Clothing', 'Electronics', 'Furniture', 'Grocery', 'Pharmacy'],
    manufacturing: ['Food Processing', 'Textile', 'Chemical', 'Plastic', 'Metal', 'Electronics'],
    technology: ['SaaS', 'Hardware', 'IT Services', 'AI/ML', 'Blockchain', 'Cybersecurity'],
    healthcare: ['Clinic', 'Hospital', 'Dental', 'Pharmacy', 'Lab', 'Wellness'],
    construction: ['Residential', 'Commercial', 'Industrial', 'Road', 'Interior'],
    hospitality: ['Restaurant', 'Hotel', 'Cafe', 'Bar', 'Resort', 'Event'],
    food_beverage: ['Restaurant', 'Cafe', 'Bakery', 'Food Truck', 'Catering', 'Brewery'],
    ecommerce: ['D2C', 'B2B', 'Marketplace', 'Fashion', 'Electronics', 'Home'],
    services: ['Legal', 'Accounting', 'Consulting', 'Marketing', 'IT', 'HR'],
    real_estate: ['Residential', 'Commercial', 'Property Management', 'Brokerage', 'Development'],
    education: ['School', 'College', 'Tutoring', 'Online', 'Training'],
    transportation: ['Logistics', 'Trucking', 'Taxi', 'Delivery', 'Warehouse'],
};

const CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
    'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Nagpur', 'Indore',
    'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Agra', 'Coimbatore'
];

const STATES = [
    'Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu', 'West Bengal',
    'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Andhra Pradesh'
];

const IMAGE_PLACEHOLDERS = [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=400&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&h=400&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=600&h=400&fit=crop&auto=format',
];

// Company placeholder colors for no logo
const COMPANY_COLORS = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-pink-500', 'bg-violet-500', 'bg-sky-500'
];

function getInitials(name) {
    if (!name) return 'B';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
}

function getRandomColor(id) {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COMPANY_COLORS[hash % COMPANY_COLORS.length];
}

// Debounce hook
function useDebounce(value, delay = 500) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

export default function MarketplacePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [listings, setListings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndustry, setSelectedIndustry] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [hoveredId, setHoveredId] = useState(null);
    const [likedIds, setLikedIds] = useState(new Set());
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('newest');
    const [showFilters, setShowFilters] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [activeFilterCount, setActiveFilterCount] = useState(0);
    const fileInputRef = useRef(null);
    
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const [formData, setFormData] = useState({
        businessName: '',
        industry: '',
        subIndustry: '',
        location: '',
        city: '',
        state: '',
        country: 'India',
        askingPrice: '',
        revenue: '',
        ebitda: '',
        sde: '',
        description: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        website: '',
        establishedYear: '',
        employees: '',
        logoUrl: '',
        reportId: null,
    });

    const subIndustries = formData.industry ? SUB_INDUSTRIES[formData.industry] || [] : [];

    // Count active filters
    useEffect(() => {
        let count = 0;
        if (selectedIndustry) count++;
        if (selectedCity) count++;
        if (searchTerm?.trim()) count++;
        setActiveFilterCount(count);
    }, [selectedIndustry, selectedCity, searchTerm]);

    useEffect(() => {
        if (!authLoading && !user) router.replace('/login');
        if (user) loadListings();
    }, [user, authLoading]);

    useEffect(() => {
        if (debouncedSearchTerm !== undefined) {
            loadListings();
        }
    }, [debouncedSearchTerm]);

    const loadListings = async () => {
        setIsLoading(true);
        setIsSearching(true);
        try {
            const params = {};
            if (searchTerm?.trim()) params.search = searchTerm.trim();
            if (selectedIndustry) params.industry = selectedIndustry;
            if (selectedCity) params.city = selectedCity;
            
            const data = await api.marketplace.getListings(params);
            let sorted = data.listings || [];
            
            switch(sortBy) {
                case 'newest': sorted.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); break;
                case 'oldest': sorted.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)); break;
                case 'price_high': sorted.sort((a,b) => (b.asking_price||0) - (a.asking_price||0)); break;
                case 'price_low': sorted.sort((a,b) => (a.asking_price||0) - (b.asking_price||0)); break;
                case 'popular': sorted.sort((a,b) => (b.views||0) - (a.views||0)); break;
                default: break;
            }
            setListings(sorted);
        } catch (err) {
            toast.error('Failed to load listings');
        } finally {
            setIsLoading(false);
            setIsSearching(false);
        }
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedIndustry('');
        setSelectedCity('');
        setSortBy('newest');
        setActiveFilterCount(0);
        setTimeout(() => loadListings(), 100);
    };

    const handleCreateListing = async () => {
        if (!formData.businessName) {
            toast.error('Business name is required');
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key]) fd.append(key, formData[key]);
            });
            if (selectedImageFile) fd.append('logo', selectedImageFile);

            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/marketplace/listings`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: fd
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            toast.success('✅ Listing created!');
            setShowCreateModal(false);
            resetForm();
            loadListings();
        } catch (err) {
            toast.error(err.message || 'Failed to create listing');
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            businessName: '', industry: '', subIndustry: '', location: '', city: '', state: '', country: 'India',
            askingPrice: '', revenue: '', ebitda: '', sde: '', description: '',
            contactName: '', contactPhone: '', contactEmail: '', website: '',
            establishedYear: '', employees: '', logoUrl: '', reportId: null,
        });
        setSelectedImage(null);
        setSelectedImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setSelectedImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const formatCurrency = (v) => {
        if (!v) return '—';
        return Number(v).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    };

    const getRandomImage = (i) => IMAGE_PLACEHOLDERS[i % IMAGE_PLACEHOLDERS.length];
    const openLocation = (loc) => loc && window.open(`https://www.google.com/maps/search/${encodeURIComponent(loc)}`, '_blank');

    const toggleLike = (id) => {
        setLikedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSearchChange = (e) => setSearchTerm(e.target.value);
    const handleManualSearch = () => loadListings();

    if (isLoading && !isSearching) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/20">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin"></div>
                    <p className="text-slate-500 text-sm font-medium">Loading marketplace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3">
                        {/* Left */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
                                    <Store size={18} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-slate-900">Marketplace</h1>
                                    <p className="text-xs text-slate-500">{listings.length} listings</p>
                                </div>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5 text-xs">
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {listings.filter(l => l.status === 'active').length} active
                                </span>
                            </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-2">
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                                >
                                    <X size={14} />
                                    Clear All ({activeFilterCount})
                                </button>
                            )}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-lg transition ${showFilters ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                                <SlidersHorizontal size={18} />
                            </button>
                            <div className="hidden sm:flex bg-slate-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                                >
                                    <Grid3x3 size={16} className="text-slate-600" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                                >
                                    <LayoutList size={16} className="text-slate-600" />
                                </button>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                            >
                                <Plus size={16} />
                                <span className="hidden sm:inline">List Business</span>
                            </button>
                        </div>
                    </div>

                    {/* Search & Filters */}
                    <div className="flex flex-col gap-2 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search businesses, industries..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                />
                                {isSearching && searchTerm && (
                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                        <Loader2 size={16} className="text-indigo-600 animate-spin" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleManualSearch}
                                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
                            >
                                Search
                            </button>
                        </div>

                        {/* Filter Bar */}
                        {showFilters && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 animate-slide-down">
                                <div className="flex-1 min-w-[120px]">
                                    <select
                                        value={selectedIndustry}
                                        onChange={(e) => setSelectedIndustry(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    >
                                        <option value="">All Industries</option>
                                        {INDUSTRIES.map(ind => (
                                            <option key={ind.value} value={ind.value}>{ind.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                    <select
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    >
                                        <option value="">All Cities</option>
                                        {CITIES.map(city => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => { setSortBy(e.target.value); setTimeout(loadListings, 100); }}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    >
                                        <option value="newest">🕐 Newest</option>
                                        <option value="popular">🔥 Most Viewed</option>
                                        <option value="price_high">⬆️ Price: High</option>
                                        <option value="price_low">⬇️ Price: Low</option>
                                        <option value="oldest">📅 Oldest</option>
                                    </select>
                                </div>
                                <button
                                    onClick={clearAllFilters}
                                    className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-sm transition flex items-center gap-1.5"
                                >
                                    <RefreshCw size={14} />
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Listings Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {/* Results Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-500">
                        {isSearching ? (
                            <span className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-indigo-600" />
                                Searching...
                            </span>
                        ) : (
                            <span>
                                {listings.length} result{listings.length !== 1 ? 's' : ''}
                                {searchTerm && ` for "${searchTerm}"`}
                            </span>
                        )}
                    </div>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                        >
                            <X size={12} />
                            Clear filters
                        </button>
                    )}
                </div>

                {/* Listings */}
                {listings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Store size={32} className="text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900">
                            {searchTerm ? 'No results found' : 'No listings yet'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                            {searchTerm 
                                ? `No businesses match "${searchTerm}". Try adjusting your search.`
                                : 'Be the first to list a business for sale and connect with buyers.'
                            }
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition"
                        >
                            <Plus size={16} />
                            List Your Business
                        </button>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' 
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
                        : 'space-y-3'
                    }>
                        {listings.map((listing, index) => {
                            const isHovered = hoveredId === listing.id;
                            const isLiked = likedIds.has(listing.id);
                            const hasLogo = listing.logo_url && listing.logo_url !== 'null';
                            const bgColor = getRandomColor(listing.id);
                            const initials = getInitials(listing.business_name);
                            
                            // ✅ Handle null contact email
                            const hasContactEmail = listing.contact_email && listing.contact_email !== 'null';
                            const hasContactPhone = listing.contact_phone && listing.contact_phone !== 'null';
                            const hasContactName = listing.contact_name && listing.contact_name !== 'null';
                            
                            if (viewMode === 'list') {
                                return (
                                    <div
                                        key={listing.id}
                                        className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-300 flex items-center p-3 gap-4"
                                        onMouseEnter={() => setHoveredId(listing.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                    >
                                        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                                            {hasLogo ? (
                                                <img src={listing.logo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full ${bgColor} flex items-center justify-center text-white text-2xl font-bold`}>
                                                    {initials}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-semibold text-sm text-slate-900">{listing.business_name}</h4>
                                                <span className="text-sm font-bold text-indigo-600">{formatCurrency(listing.asking_price)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{listing.industry || 'Other'}</span>
                                                {listing.location && (
                                                    <span className="flex items-center gap-0.5">
                                                        <MapPin size={10} /> {listing.location}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                                {listing.revenue && <span>Rev: {formatCurrency(listing.revenue)}</span>}
                                                {listing.employees && <span>👥 {listing.employees}</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/marketplace/${listing.id}`)}
                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition"
                                        >
                                            View
                                        </button>
                                    </div>
                                );
                            }

                            // Grid View
                            return (
                                <div
                                    key={listing.id}
                                    className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 transition-all duration-300"
                                    onMouseEnter={() => setHoveredId(listing.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    {/* Image */}
                                    <div className="relative h-44 overflow-hidden bg-slate-100">
                                        {hasLogo ? (
                                            <img
                                                src={listing.logo_url}
                                                alt={listing.business_name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className={`w-full h-full ${bgColor} flex items-center justify-center text-white text-4xl font-bold`}>
                                                {initials}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        
                                        {/* Badges */}
                                        <div className="absolute top-2 left-2 flex gap-1.5">
                                            {listing.is_featured && (
                                                <span className="px-2 py-0.5 bg-amber-400 text-white rounded-full text-[10px] font-medium flex items-center gap-0.5 shadow-lg">
                                                    <Star size={10} /> Featured
                                                </span>
                                            )}
                                            {listing.established_year && (
                                                <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white rounded-full text-[10px] font-medium">
                                                    Est. {listing.established_year}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Price */}
                                        <div className="absolute bottom-2 right-2 px-3 py-1 bg-white/95 backdrop-blur-sm rounded-lg text-sm font-bold text-slate-900 shadow-lg">
                                            {formatCurrency(listing.asking_price)}
                                        </div>
                                        
                                        {/* Views */}
                                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-sm text-white rounded-full text-[10px] font-medium flex items-center gap-1">
                                            <Eye size={10} />
                                            {listing.views || 0}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-3.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-semibold text-sm text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                                    {listing.business_name}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium truncate max-w-[80px]">
                                                        {listing.industry || 'Other'}
                                                    </span>
                                                    {listing.sub_industry && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full truncate max-w-[80px]">
                                                            {listing.sub_industry}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleLike(listing.id)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0"
                                            >
                                                <Heart size={14} className={isLiked ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                                            </button>
                                        </div>

                                        {/* Location */}
                                        {listing.location && (
                                            <button
                                                onClick={() => openLocation(listing.location)}
                                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-1 transition group/loc"
                                            >
                                                <MapPin size={12} className="group-hover/loc:animate-bounce" />
                                                <span className="hover:underline truncate">{listing.location}</span>
                                            </button>
                                        )}

                                        {/* Contact Info - Show only if available */}
                                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                                            {hasContactName && (
                                                <span className="flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded-full">
                                                    <User size={10} />
                                                    {listing.contact_name}
                                                </span>
                                            )}
                                            {hasContactPhone && (
                                                <span className="flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded-full">
                                                    <Phone size={10} />
                                                    {listing.contact_phone}
                                                </span>
                                            )}
                                            {hasContactEmail && (
                                                <span className="flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded-full">
                                                    <Mail size={10} />
                                                    {listing.contact_email}
                                                </span>
                                            )}
                                        </div>

                                        {/* Metrics */}
                                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                                            {listing.revenue && (
                                                <span className="flex items-center gap-0.5 bg-slate-50 px-2 py-0.5 rounded-full">
                                                    <TrendingUp size={10} className="text-emerald-500" />
                                                    {formatCurrency(listing.revenue)}
                                                </span>
                                            )}
                                            {listing.employees && (
                                                <span className="flex items-center gap-0.5 bg-slate-50 px-2 py-0.5 rounded-full">
                                                    <Users size={10} className="text-amber-500" />
                                                    {listing.employees}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-0.5 bg-slate-50 px-2 py-0.5 rounded-full text-slate-400">
                                                <Clock size={10} />
                                                {new Date(listing.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => router.push(`/marketplace/${listing.id}`)}
                                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition flex items-center gap-0.5 group/view"
                                            >
                                                View Details
                                                <ArrowUpRight size={12} className="group-hover/view:translate-x-0.5 group-hover/view:-translate-y-0.5 transition" />
                                            </button>
                                            <button
                                                onClick={() => toast.success('Interest expressed! The seller will contact you.')}
                                                className="text-xs px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition font-medium flex items-center gap-1"
                                            >
                                                <Zap size={10} />
                                                Interested
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Listing Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-scale-in">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">List Your Business</h3>
                                <p className="text-sm text-slate-500">Fill in the details to list your business</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Logo */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Logo</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-400 transition bg-slate-50 overflow-hidden group"
                                >
                                    {selectedImage ? (
                                        <img src={selectedImage} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center">
                                            <Camera size={20} className="text-slate-400 mx-auto group-hover:text-indigo-500 transition" />
                                            <p className="text-[10px] text-slate-500 mt-1">Upload</p>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                                    <input
                                        type="text"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                        placeholder="Acme Hardware"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry *</label>
                                    <select
                                        value={formData.industry}
                                        onChange={(e) => setFormData({ ...formData, industry: e.target.value, subIndustry: '' })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    >
                                        <option value="">Select Industry</option>
                                        {INDUSTRIES.map(ind => (
                                            <option key={ind.value} value={ind.value}>{ind.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                                    <select
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    >
                                        <option value="">Select City</option>
                                        {CITIES.map(city => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                                    <select
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    >
                                        <option value="">Select State</option>
                                        {STATES.map(state => (
                                            <option key={state} value={state}>{state}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Asking Price (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.askingPrice}
                                        onChange={(e) => setFormData({ ...formData, askingPrice: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                        placeholder="5,00,000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Revenue (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.revenue}
                                        onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Employees</label>
                                    <input
                                        type="number"
                                        value={formData.employees}
                                        onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                    placeholder="Describe your business..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                                    <input
                                        type="text"
                                        value={formData.contactName}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
                                    <input
                                        type="text"
                                        value={formData.contactPhone}
                                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateListing}
                                    disabled={uploading}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition disabled:opacity-50"
                                >
                                    {uploading ? 'Creating...' : 'List Business'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .animate-scale-in {
                    animation: scaleIn 0.2s ease-out;
                }
                .animate-slide-down {
                    animation: slideDown 0.2s ease-out;
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}