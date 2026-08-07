// services/marketplaceService.js
const { query } = require('../config/db');

// ============================================================
// Helper: Assign Role
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
// Create Listing
// ============================================================
async function createListing(userId, data) {
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
        logoUrl,
    } = data;

    // Generate slug
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check if slug exists
    const existing = await query(
        'SELECT id FROM marketplace_listings WHERE slug = $1',
        [slug]
    );
    const finalSlug = existing.rows.length > 0 ? `${slug}-${Date.now()}` : slug;

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
            userId,
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
            logoUrl || null,
        ]
    );

    // Auto-assign role: Seller or Broker
    await assignRole(userId, 'seller');

    return result.rows[0];
}

// ============================================================
// Get Listings
// ============================================================
async function getListings(filters = {}) {
    const { industry, minPrice, maxPrice, status = 'active', search, city } = filters;
    
    console.log('🔍 Fetching listings with filters:', filters);
    
    let queryText = `
        SELECT l.*, u.full_name as user_name, u.email as user_email
        FROM marketplace_listings l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.status = $1
    `;
    
    const params = [status];
    let paramCount = 1;
    
    if (industry) {
        paramCount++;
        queryText += ` AND l.industry ILIKE $${paramCount}`;
        params.push(`%${industry}%`);
    }
    
    if (city) {
        paramCount++;
        queryText += ` AND l.city ILIKE $${paramCount}`;
        params.push(`%${city}%`);
    }
    
    if (minPrice) {
        paramCount++;
        queryText += ` AND l.asking_price >= $${paramCount}`;
        params.push(parseFloat(minPrice));
    }
    
    if (maxPrice) {
        paramCount++;
        queryText += ` AND l.asking_price <= $${paramCount}`;
        params.push(parseFloat(maxPrice));
    }
    
    if (search) {
        paramCount++;
        queryText += ` AND (l.business_name ILIKE $${paramCount} OR l.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
    }
    
    queryText += ` ORDER BY l.is_featured DESC, l.created_at DESC`;
    
    console.log('📝 Final Query:', queryText);
    console.log('📝 Params:', params);
    
    const result = await query(queryText, params);
    console.log(`✅ Found ${result.rows.length} listings`);
    
    return result.rows;
}

// ============================================================
// Get Single Listing
// ============================================================
async function getListing(listingId) {
    // Increment views
    await query(
        'UPDATE marketplace_listings SET views = views + 1 WHERE id = $1',
        [listingId]
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
        [listingId]
    );
    
    if (result.rows.length === 0) {
        throw new Error('Listing not found');
    }
    
    return result.rows[0];
}

// ============================================================
// Express Interest (Buyer)
// ============================================================
async function expressInterest(listingId, userId, message) {
    // Check if listing exists
    const listingResult = await query(
        'SELECT id FROM marketplace_listings WHERE id = $1 AND status = $2',
        [listingId, 'active']
    );
    
    if (listingResult.rows.length === 0) {
        throw new Error('Listing not found or not active');
    }
    
    // Check if already interested
    const existing = await query(
        'SELECT id FROM marketplace_interests WHERE listing_id = $1 AND user_id = $2 AND status != $3',
        [listingId, userId, 'rejected']
    );
    
    if (existing.rows.length > 0) {
        throw new Error('You have already expressed interest in this listing');
    }
    
    // Auto-assign role: Buyer
    await assignRole(userId, 'buyer');
    
    const result = await query(
        `INSERT INTO marketplace_interests (listing_id, user_id, message)
         VALUES ($1, $2, $3)
         ON CONFLICT (listing_id, user_id) 
         DO UPDATE SET status = 'pending', updated_at = now()
         RETURNING *`,
        [listingId, userId, message || null]
    );
    
    // Update interest count on listing
    await query(
        'UPDATE marketplace_listings SET interests = interests + 1 WHERE id = $1',
        [listingId]
    );
    
    return result.rows[0];
}

// ============================================================
// Create Deal Room
// ============================================================
async function createDealRoom(listingId, buyerId, brokerId = null) {
    // Check if deal room already exists
    const existing = await query(
        'SELECT id FROM marketplace_deal_rooms WHERE listing_id = $1 AND buyer_id = $2 AND status = $3',
        [listingId, buyerId, 'active']
    );
    
    if (existing.rows.length > 0) {
        throw new Error('Deal room already exists for this buyer');
    }
    
    const result = await query(
        `INSERT INTO marketplace_deal_rooms (listing_id, buyer_id, broker_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [listingId, buyerId, brokerId || null]
    );
    
    // Update interest status
    await query(
        `UPDATE marketplace_interests 
         SET status = 'accepted', updated_at = now()
         WHERE listing_id = $1 AND user_id = $2`,
        [listingId, buyerId]
    );
    
    return result.rows[0];
}

// ============================================================
// Send Deal Room Message
// ============================================================
async function sendDealMessage(dealRoomId, senderId, message) {
    // Verify user has access to this deal room
    const roomResult = await query(
        `SELECT * FROM marketplace_deal_rooms 
         WHERE id = $1 AND (buyer_id = $2 OR broker_id = $2)`,
        [dealRoomId, senderId]
    );
    
    if (roomResult.rows.length === 0) {
        throw new Error('Access denied');
    }
    
    const result = await query(
        `INSERT INTO marketplace_deal_messages (deal_room_id, sender_id, message)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [dealRoomId, senderId, message]
    );
    
    return result.rows[0];
}

// ============================================================
// Get Deal Room Messages
// ============================================================
async function getDealMessages(dealRoomId, userId) {
    // Verify user has access to this deal room
    const roomResult = await query(
        `SELECT * FROM marketplace_deal_rooms 
         WHERE id = $1 AND (buyer_id = $2 OR broker_id = $2)`,
        [dealRoomId, userId]
    );
    
    if (roomResult.rows.length === 0) {
        throw new Error('Access denied');
    }
    
    const result = await query(
        `SELECT m.*, u.full_name as sender_name
         FROM marketplace_deal_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.deal_room_id = $1
         ORDER BY m.created_at ASC`,
        [dealRoomId]
    );
    
    // Mark messages as read
    await query(
        `UPDATE marketplace_deal_messages 
         SET is_read = true 
         WHERE deal_room_id = $1 AND sender_id != $2`,
        [dealRoomId, userId]
    );
    
    return result.rows;
}

// ============================================================
// Get My Listings
// ============================================================
async function getMyListings(userId) {
    const result = await query(
        `SELECT l.*, COUNT(i.id) as interest_count
         FROM marketplace_listings l
         LEFT JOIN marketplace_interests i ON l.id = i.listing_id AND i.status != 'rejected'
         WHERE l.user_id = $1
         GROUP BY l.id
         ORDER BY l.created_at DESC`,
        [userId]
    );
    return result.rows;
}

// ============================================================
// Get My Interests (as buyer)
// ============================================================
async function getMyInterests(userId) {
    const result = await query(
        `SELECT i.*, l.business_name, l.industry, l.asking_price,
                l.user_id as seller_id, u.full_name as seller_name
         FROM marketplace_interests i
         JOIN marketplace_listings l ON i.listing_id = l.id
         LEFT JOIN users u ON l.user_id = u.id
         WHERE i.user_id = $1
         ORDER BY i.created_at DESC`,
        [userId]
    );
    return result.rows;
}

// ============================================================
// Get My Deal Rooms
// ============================================================
async function getMyDealRooms(userId) {
    const result = await query(
        `SELECT dr.*, l.business_name, l.industry, l.asking_price,
                u.full_name as buyer_name,
                u2.full_name as broker_name
         FROM marketplace_deal_rooms dr
         JOIN marketplace_listings l ON dr.listing_id = l.id
         LEFT JOIN users u ON dr.buyer_id = u.id
         LEFT JOIN users u2 ON dr.broker_id = u2.id
         WHERE dr.buyer_id = $1 OR dr.broker_id = $1
         ORDER BY dr.created_at DESC`,
        [userId]
    );
    return result.rows;
}

// ============================================================
// Module Exports
// ============================================================
module.exports = {
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
};