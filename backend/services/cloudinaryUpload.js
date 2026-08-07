// services/cloudinaryUpload.js
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 */
async function uploadToCloudinary(fileBuffer, folder = 'marketplace', options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `ledger-ai/${folder}`,
                resource_type: 'auto',
                transformation: [
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' },
                ],
                ...options,
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        uploadStream.end(fileBuffer);
    });
}

/**
 * Upload a logo specifically
 */
async function uploadLogo(fileBuffer, userId) {
    try {
        const result = await uploadToCloudinary(fileBuffer, `logos/${userId}`, {
            transformation: [
                { width: 400, height: 400, crop: 'limit' },
                { quality: 'auto:good' },
                { fetch_format: 'auto' },
            ],
            tags: ['logo', `user-${userId}`],
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
        };
    } catch (err) {
        console.error('Logo upload error:', err);
        throw err;
    }
}

/**
 * Delete a file from Cloudinary
 */
async function deleteFromCloudinary(publicId) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
            if (error) {
                console.error('Cloudinary delete error:', error);
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = {
    uploadToCloudinary,
    uploadLogo,
    deleteFromCloudinary,
};