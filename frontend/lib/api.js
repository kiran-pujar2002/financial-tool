const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

console.log('api url', process.env.NEXT_PUBLIC_API_URL);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export function setToken(token) {
  window.localStorage.setItem('token', token);
}

export function clearToken() {
  window.localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // response wasn't JSON — keep default message
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
    return res.blob();
  }
  return res.json();
}

export const api = {
  // ============================================
  // AUTHENTICATION APIs
  // ============================================

  signup: (data) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: (data) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/api/auth/me'),

  updateProfile: (data) =>
    request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  changePassword: (data) =>
    request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // ============================================
  // REPORT APIs
  // ============================================

  listReports: () => request('/api/reports'),

  getReport: (id) => request(`/api/reports/${id}`),

  uploadReport: (formData) =>
    request('/api/reports/upload', { method: 'POST', body: formData }),

  updateTransaction: (reportId, txnId, data) =>
    request(`/api/reports/${reportId}/transactions/${txnId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  generatePdf: (reportId) =>
    request(`/api/reports/${reportId}/generate-pdf`, { method: 'POST' }),

  downloadReport: (reportId) => request(`/api/reports/${reportId}/download`),

  // ============================================
  // PAYMENT APIs
  // ============================================

  createOrder: (data) =>
    request('/api/payments/order', { method: 'POST', body: JSON.stringify(data) }),

  verifyPayment: (data) =>
    request('/api/payments/verify', { method: 'POST', body: JSON.stringify(data) }),


  // Add to the api object
// Unified download endpoints
downloads: {
    // QOE Report
    qoe: (reportId) => `/api/reports/${reportId}/download`,
    
    // Valuation
    valuation: (filename) => `/api/valuation/download/${filename}`,
    
    // CIM
    cim: (filename) => `/api/cim/download/${filename}`,
    
    // Due Diligence (coming soon)
    dd: (reportId) => `/api/dd/${reportId}/download`,
},

// Helper to get download URL
getDownloadUrl: (type, id) => {
    const urls = {
        qoe: `/api/reports/${id}/download`,
        valuation: `/api/valuation/download/${id}`,
        cim: `/api/cim/download/${id}`,
        dd: `/api/dd/${id}/download`,
    };
    return urls[type] || null;
},


// Add to the api object

// Delete report (soft delete)
deleteReport: (id) =>
    request(`/api/reports/${id}`, {
        method: 'DELETE'
    }),

// Restore report
restoreReport: (id) =>
    request(`/api/reports/${id}/restore`, {
        method: 'POST'
    }),


    
// Get trashed reports
getTrashedReports: () =>
    request('/api/reports/trash'),
  // ============================================
  // VALUATION APIs
  // ============================================

  valuation: {
    getMultiples: () => request('/api/valuation/multiples'),
    getIndustryMultiple: (industry) => request(`/api/valuation/multiples/${encodeURIComponent(industry)}`),
    calculate: (data) => request('/api/valuation/calculate', { method: 'POST', body: JSON.stringify(data) }),
    getHistory: (reportId) => request(`/api/valuation/history/${reportId}`),
    generateReport: (data) => request('/api/valuation/generate-report', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ============================================
  // EDITOR APIs
  // ============================================

  getEditorDraft: (reportId) =>
    request(`/api/editor/${reportId}/draft`),

  saveEditorDraft: (reportId, data) =>
    request(`/api/editor/${reportId}/draft`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  bulkUpdateTransactions: (reportId, updates) =>
    request(`/api/editor/${reportId}/transactions/bulk`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),

  finalizeReport: (reportId, data) =>
    request(`/api/editor/${reportId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVersionHistory: (reportId) =>
    request(`/api/editor/${reportId}/versions`),

  getVersion: (reportId, versionId) =>
    request(`/api/editor/${reportId}/versions/${versionId}`),

  restoreVersion: (reportId, versionId, data) =>
    request(`/api/editor/${reportId}/versions/${versionId}/restore`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createCustomCategory: (data) =>
    request('/api/editor/custom-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomCategory: (id, data) =>
    request(`/api/editor/custom-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCustomCategory: (id) =>
    request(`/api/editor/custom-categories/${id}`, {
      method: 'DELETE',
    }),

  // ============================================
  // BRANDING APIs
  // ============================================

  branding: {
    get: () => request('/api/branding'),
    
    update: (data) => 
      request('/api/branding', { 
        method: 'PUT', 
        body: JSON.stringify(data) 
      }),
    
    uploadLogo: (formData) => 
      request('/api/branding/logo', { 
        method: 'POST', 
        body: formData 
      }),
    
    removeLogo: () => 
      request('/api/branding/logo', { 
        method: 'DELETE' 
      }),
  },

  // ============================================
  // CIM APIs
  // ============================================

  cim: {
    generate: (data) => request('/api/cim/generate', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    download: (filename) => {
      const token = getToken();
      return fetch(`${API_URL}/api/cim/download/${filename}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    },
  },

  // ============================================
  // DUE DILIGENCE APIs
  // ============================================

  dd: {
    getTemplates: () => request('/api/dd/templates'),
    getProgress: (reportId) => request(`/api/dd/progress/${reportId}`),
    updateProgress: (reportId, itemId, data) => 
      request(`/api/dd/progress/${reportId}/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    uploadDocument: (progressId, formData) =>
      request(`/api/dd/documents/${progressId}`, {
        method: 'POST',
        body: formData
      }),
    getDocuments: (progressId) => 
      request(`/api/dd/documents/${progressId}`),

        uploadDocument: (itemId, reportId, formData) =>
        request(`/api/dd/documents/${itemId}?reportId=${reportId}`, {
            method: 'POST',
            body: formData
        }),

            generateReport: (data) => 
        request('/api/dd/generate-report', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    
  },



  // ============================================
  // SHARE APIs
  // ============================================

  share: {
    create: (data) => request('/api/share', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    getLinks: (reportId) => request(`/api/share/${reportId}`),
    
    revoke: (linkId) => request(`/api/share/${linkId}`, {
      method: 'DELETE'
    }),
    
    getAnalytics: (linkId) => request(`/api/share/analytics/${linkId}`),
    
    getPublic: async (token, password) => {
      const url = `${API_URL}/api/share/public/${token}${password ? `?password=${encodeURIComponent(password)}` : ''}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401 && data.requiresPassword) {
          const error = new Error('Password required');
          error.status = 401;
          error.requiresPassword = true;
          throw error;
        }
        throw new Error(data.error || 'Failed to load report');
      }
      
      return data;
    },
    
    download: (token) => {
      return fetch(`${API_URL}/api/share/download/${token}`).then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      });
    },
  },
};

export { ApiError };