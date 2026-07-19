// frontend/lib/download.js

/**
 * Unified PDF Download Utility
 * Handles all PDF downloads with consistent auth and error handling
 */

/**
 * Download a file from the server
 * @param {string} url - The download URL (e.g., '/api/reports/123/download')
 * @param {string} filename - The filename to save as
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<void>}
 */
export async function downloadFile(url, filename, onProgress = null) {
    try {
        const token = localStorage.getItem('token');
        const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${url}`;
        
        if (onProgress) onProgress(0);
        
        const response = await fetch(fullUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('File not found. Please regenerate the report.');
            } else if (response.status === 401) {
                throw new Error('Please login again to download this file.');
            } else {
                throw new Error(`Download failed (${response.status})`);
            }
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (onProgress) onProgress(100);
        
        // Clean up
        setTimeout(() => {
            window.URL.revokeObjectURL(downloadUrl);
        }, 1000);
        
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

// frontend/lib/download.js
export function getFilename(type, businessName, extension = 'pdf') {
    const date = new Date().toISOString().split('T')[0];
    const name = businessName.replace(/\s+/g, '-');
    
    const types = {
        qoe: `QOE-Report-${name}.${extension}`,
        valuation: `Valuation-Report-${name}.${extension}`,
        cim: `CIM-${name}.${extension}`,
        dd: `Due-Diligence-${name}.${extension}`,
    };
    
    return types[type] || `${type}-${name}.${extension}`;
}

/**
 * Show download progress
 */
export function createDownloadHandler(type, url, businessName, onComplete = null) {
    return async () => {
        const filename = getFilename(type, businessName);
        try {
            await downloadFile(url, filename);
            if (onComplete) onComplete();
        } catch (error) {
            throw error;
        }
    };
}