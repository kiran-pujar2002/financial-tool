// routes/marketplace.js
const express = require('express');
const multer = require('multer');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');
const { uploadLogo } = require('../services/cloudinaryUpload');

const router = express.Router();

// ✅ Import marketplace service functions
const {
    createListing,
    getListings,
    getListing,
    expressInterest,
    createDealRoom,
    sendDealMessage,
    getDealMessages,
    getMyListings,
    getMyInterests,
    getMyDealRooms,
} = require('../services/marketplaceService');

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PNG, JPG, SVG, and WEBP images are allowed'), false);
        }
    }
});

// ============================================================
// Helper: Assign role
// ============================================================
async function assignRole(userId, role) {
    const result = await query(
        `SELECT roles FROM users WHERE id = $1`,
        [userId]
    );
    
    if (result.rows.length === 0) return;
    
    const currentRoles = result.rows[0].roles || [];
    if (!currentRoles.includes(role)) {
        await query(
            `UPDATE users SET roles = array_append(roles, $1) WHERE id = $2`,
            [role, userId]
        );
    }
}

// ============================================================
// POST /api/marketplace/listings - Create a listing
// ============================================================
router.post('/listings', authenticate, upload.single('logo'), asyncHandler(async (req, res) => {
    const {
        reportId,
        businessName,
        industry,
        subIndustry,
        location,
        city,
        state,
        country,
        revenue,
        ebitda,
        sde,
        askingPrice,
        description,
        contactName,
        contactPhone,
        contactEmail,
        website,
        establishedYear,
        employees,
    } = req.body;

    if (!businessName) {
        throw new HttpError(400, 'Business name is required');
    }

    // Generate slug
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existing = await query(
        'SELECT id FROM marketplace_listings WHERE slug = $1',
        [slug]
    );
    const finalSlug = existing.rows.length > 0 ? `${slug}-${Date.now()}` : slug;

    // Upload logo to Cloudinary if provided
    let logoUrl = null;
    if (req.file) {
        try {
            const result = await uploadLogo(req.file.buffer, req.user.id);
            logoUrl = result.url;
            console.log('✅ Logo uploaded to Cloudinary:', logoUrl);
        } catch (err) {
            console.error('Cloudinary upload error:', err);
            // Continue without logo
        }
    }

    const result = await query(
        `INSERT INTO marketplace_listings (
            user_id, report_id, business_name, slug, industry, sub_industry,
            location, city, state, country,
            revenue, ebitda, sde, asking_price, description,
            contact_name, contact_phone, contact_email, website,
            established_year, employees, logo_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                  $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22)
        RETURNING *`,
        [
            req.user.id, 
            reportId || null, 
            businessName, 
            finalSlug,
            industry || null, 
            subIndustry || null,
            location || null, 
            city || null, 
            state || null, 
            country || 'India',
            revenue || 0, 
            ebitda || 0, 
            sde || 0,
            askingPrice || 0, 
            description || null,
            contactName || null, 
            contactPhone || null, 
            contactEmail || null,
            website || null, 
            establishedYear || null,
            employees || null, 
            logoUrl || null
        ]
    );

    await assignRole(req.user.id, 'seller');
    res.status(201).json({ listing: result.rows[0] });
}));

// ============================================================
// GET /api/marketplace/listings - Get all listings
// ============================================================
router.get('/listings', asyncHandler(async (req, res) => {
    const { industry, minPrice, maxPrice, status, search, city } = req.query;
    
    console.log('📊 GET /listings called with query:', req.query);
    
    const listings = await getListings({ 
        industry, 
        minPrice, 
        maxPrice, 
        status, 
        search, 
        city 
    });
    
    console.log(`📊 Returning ${listings.length} listings`);
    res.json({ listings });
}));

// ============================================================
// GET /api/marketplace/listings/:id - Get single listing
// ============================================================
router.get('/listings/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Increment views
    await query(
        'UPDATE marketplace_listings SET views = views + 1 WHERE id = $1',
        [id]
    );
    
    const result = await query(
        `SELECT l.*, u.full_name as user_name, u.email as user_email,
                COUNT(DISTINCT i.id) as interest_count,
                COALESCE(json_agg(DISTINCT i.user_id) FILTER (WHERE i.user_id IS NOT NULL), '[]') as interested_buyers
         FROM marketplace_listings l
         LEFT JOIN users u ON l.user_id = u.id
         LEFT JOIN marketplace_interests i ON l.id = i.listing_id AND i.status != 'rejected'
         WHERE l.id = $1
         GROUP BY l.id, u.id`,
        [id]
    );
    
    if (result.rows.length === 0) {
        throw new HttpError(404, 'Listing not found');
    }
    
    res.json({ listing: result.rows[0] });
}));

// ============================================================
// GET /api/marketplace/my-listings - Get user's listings
// ============================================================
router.get('/my-listings', authenticate, asyncHandler(async (req, res) => {
    const listings = await getMyListings(req.user.id);
    res.json({ listings });
}));

// ============================================================
// POST /api/marketplace/interests - Express interest
// ============================================================
router.post('/interests', authenticate, asyncHandler(async (req, res) => {
    const { listingId, message } = req.body;
    
    if (!listingId) {
        throw new HttpError(400, 'listingId is required');
    }
    
    const interest = await expressInterest(listingId, req.user.id, message);
    res.status(201).json({ interest });
}));

// ============================================================
// GET /api/marketplace/my-interests - Get user's interests
// ============================================================
router.get('/my-interests', authenticate, asyncHandler(async (req, res) => {
    const interests = await getMyInterests(req.user.id);
    res.json({ interests });
}));

// ============================================================
// POST /api/marketplace/deal-rooms - Create deal room
// ============================================================
router.post('/deal-rooms', authenticate, asyncHandler(async (req, res) => {
    const { listingId, buyerId, brokerId } = req.body;
    
    if (!listingId || !buyerId) {
        throw new HttpError(400, 'listingId and buyerId are required');
    }
    
    const dealRoom = await createDealRoom(listingId, buyerId, brokerId);
    res.status(201).json({ dealRoom });
}));

// ============================================================
// POST /api/marketplace/deal-rooms/:id/messages - Send message
// ============================================================
router.post('/deal-rooms/:id/messages', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
        throw new HttpError(400, 'Message is required');
    }
    
    const result = await sendDealMessage(id, req.user.id, message);
    res.status(201).json({ message: result });
}));

// ============================================================
// GET /api/marketplace/deal-rooms/:id/messages - Get messages
// ============================================================
router.get('/deal-rooms/:id/messages', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const messages = await getDealMessages(id, req.user.id);
    res.json({ messages });
}));

// ============================================================
// GET /api/marketplace/my-deal-rooms - Get user's deal rooms
// ============================================================
router.get('/my-deal-rooms', authenticate, asyncHandler(async (req, res) => {
    const dealRooms = await getMyDealRooms(req.user.id);
    res.json({ dealRooms });
}));

module.exports = router;