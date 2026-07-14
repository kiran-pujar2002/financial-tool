const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

console.log('api url',process.env.NEXT_PUBLIC_API_URL)

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

  // ============================================
  // 🔥 NEW: EDITOR APIs
  // ============================================

  /**
   * Get draft data for a report
   * @param {string} reportId - The report ID
   * @returns {Promise} Report draft data
   */
  getEditorDraft: (reportId) =>
    request(`/api/editor/${reportId}/draft`),

  /**
   * Save draft data for a report
   * @param {string} reportId - The report ID
   * @param {object} data - { draftData, editorStatus }
   * @returns {Promise} Updated report
   */
  saveEditorDraft: (reportId, data) =>
    request(`/api/editor/${reportId}/draft`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Finalize report and proceed to payment
   * @param {string} reportId - The report ID
   * @param {object} data - { finalizedData }
   * @returns {Promise} Finalized report
   */
  finalizeReport: (reportId, data) =>
    request(`/api/editor/${reportId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ============================================
  // 🔥 NEW: VALUATION APIs
  // ============================================

  /**
   * Get all industry valuation multiples
   * @returns {Promise} List of industry multiples
   */
  getValuationMultiples: () =>
    request('/api/valuation/multiples'),

  /**
   * Get valuation multiples for a specific industry
   * @param {string} industry - Industry name
   * @returns {Promise} Industry multiples
   */
  getIndustryMultiple: (industry) =>
    request(`/api/valuation/multiples/${encodeURIComponent(industry)}`),

  /**
   * Calculate business valuation
   * @param {object} data - { reportId, method, multiple, riskFactors }
   * @returns {Promise} Valuation result
   */
  calculateValuation: (data) =>
    request('/api/valuation/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Get valuation history for a report
   * @param {string} reportId - The report ID
   * @returns {Promise} Valuation history
   */
  getValuationHistory: (reportId) =>
    request(`/api/valuation/history/${reportId}`),

  /**
   * Get comparable transactions
   * @param {object} params - { industry, minSize, maxSize }
   * @returns {Promise} Comparable transactions
   */
  getComparableTransactions: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return request(`/api/valuation/comparable${queryString ? '?' + queryString : ''}`);
  },
};

export { ApiError };