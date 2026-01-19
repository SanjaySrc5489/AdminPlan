import axios from 'axios';

// Use localhost for testing, switch to production URL for deployment
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Generate a UUID that works in both secure and non-secure contexts.
 * crypto.randomUUID() only works in secure contexts (HTTPS/localhost),
 * so we provide a fallback using crypto.getRandomValues() which works everywhere.
 */
function generateUUID(): string {
    // Try native crypto.randomUUID first (secure contexts only)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // Fall through to fallback
        }
    }

    // Fallback: Generate UUID v4 using crypto.getRandomValues()
    // This works in all browser contexts
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) and variant (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122

    // Convert to hex string in UUID format
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const api = axios.create({
    baseURL: `${API_URL}/api`,
    timeout: 30000,
});

/**
 * Check if Web Crypto API is available (only works in secure contexts: HTTPS or localhost)
 */
function isSecureContext(): boolean {
    if (typeof window === 'undefined') return false;
    // Check if we're in a secure context (HTTPS or localhost)
    if (window.isSecureContext !== undefined) {
        return window.isSecureContext;
    }
    // Fallback check for older browsers
    const protocol = window.location?.protocol;
    const hostname = window.location?.hostname;
    return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Generate HMAC-SHA256 signature for request integrity
 * Note: This only works in secure contexts (HTTPS or localhost).
 * In non-secure contexts (HTTP over IP), signature generation is skipped.
 */
async function generateSignature(method: string, url: string, timestamp: number, nonce: string, body: string = ''): Promise<string> {
    // Skip signature in non-secure contexts - crypto.subtle is not available
    if (!isSecureContext() || typeof crypto === 'undefined' || !crypto.subtle) {
        return '';
    }

    const signatureSecret = localStorage.getItem('signature_secret');
    if (!signatureSecret) return '';

    const payload = `${method.toUpperCase()}:${url}:${timestamp}:${nonce}:${body}`;

    // Use Web Crypto API for HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signatureSecret);
    const messageData = encoder.encode(payload);

    try {
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, messageData);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.error('Failed to generate signature:', error);
        return '';
    }
}

// Add auth token and signature to requests
api.interceptors.request.use(async (config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('admin_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add signature headers for integrity validation
        // Skip in development if signature secret not set
        const signatureSecret = localStorage.getItem('signature_secret');
        if (signatureSecret && config.url) {
            const timestamp = Date.now();
            const nonce = generateUUID();
            const body = config.data ? JSON.stringify(config.data) : '';
            const signature = await generateSignature(
                config.method || 'GET',
                config.url,
                timestamp,
                nonce,
                body
            );

            config.headers['X-Timestamp'] = timestamp.toString();
            config.headers['X-Nonce'] = nonce;
            config.headers['X-Signature'] = signature;
        }
    }
    return config;
});

// Handle token refresh on 401 and sanitize error messages
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
                    if (res.data.success) {
                        localStorage.setItem('admin_token', res.data.token);
                        localStorage.setItem('refresh_token', res.data.refreshToken);
                        originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    // Refresh failed, clear auth
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('signature_secret');
                    window.location.href = '/login';
                }
            }
        }

        // Sanitize error to hide sensitive information (API paths, stack traces)
        const sanitizedError = createSanitizedError(error);
        return Promise.reject(sanitizedError);
    }
);

/**
 * Create a sanitized error object that hides internal API paths and details
 */
function createSanitizedError(error: any): Error {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.error || error.response?.data?.message;

    // Map status codes to user-friendly messages
    const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Session expired. Please login again.',
        403: 'You do not have permission for this action.',
        404: 'Resource not found.',
        408: 'Request timed out. Please try again.',
        429: 'Too many requests. Please wait a moment.',
        500: 'Server error. Please try again later.',
        502: 'Server temporarily unavailable.',
        503: 'Service unavailable. Please try again later.',
    };

    // Use server message if safe, otherwise use generic message
    let userMessage: string;
    if (serverMessage && typeof serverMessage === 'string' && !serverMessage.includes('/api/')) {
        // Server message is safe to show (doesn't contain API paths)
        userMessage = serverMessage;
    } else if (status && statusMessages[status]) {
        userMessage = statusMessages[status];
    } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        userMessage = 'Network error. Please check your connection.';
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
    } else {
        userMessage = 'Something went wrong. Please try again.';
    }

    // Create a clean error object
    const sanitized = new Error(userMessage);
    sanitized.name = 'ApiError';

    // Attach status code for handling in components (but don't expose paths)
    (sanitized as any).status = status;
    (sanitized as any).isApiError = true;

    // Log original error to console for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
        console.error('[API Error]', {
            status,
            message: userMessage,
            originalMessage: error.message,
            url: error.config?.url // Only log in dev console, not in error object
        });
    }

    return sanitized;
}

// ========================================
// AUTH API
// ========================================

export const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
};

export const refreshToken = async (refreshToken: string) => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data;
};

export const logout = async () => {
    const res = await api.post('/auth/logout');
    return res.data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await api.put('/auth/password', { currentPassword, newPassword });
    return res.data;
};

// Self-service API token management
export const getMyApiToken = async () => {
    const res = await api.get('/auth/token');
    return res.data;
};

export const generateMyApiToken = async () => {
    const res = await api.post('/auth/token/generate');
    return res.data;
};

export const getCurrentUser = async () => {
    const res = await api.get('/auth/me');
    return res.data;
};

export const getSessions = async () => {
    const res = await api.get('/auth/sessions');
    return res.data;
};

export const revokeSession = async (sessionId: string) => {
    const res = await api.delete(`/auth/sessions/${sessionId}`);
    return res.data;
};

// ========================================
// USER MANAGEMENT API (Admin Only)
// ========================================

export const getUsers = async (params?: { page?: number; limit?: number; role?: string; search?: string; includeInactive?: boolean }) => {
    const res = await api.get('/users', { params });
    return res.data;
};

export const getUser = async (userId: string) => {
    const res = await api.get(`/users/${userId}`);
    return res.data;
};

export const createUser = async (userData: {
    username: string;
    password: string;
    email?: string;
    role?: 'admin' | 'client';
    isActive?: boolean;
    expiresAt?: string;
    permissions?: string[];
    maxDevices?: number;
}) => {
    const res = await api.post('/users', userData);
    return res.data;
};

export const updateUser = async (userId: string, updates: {
    email?: string;
    password?: string;
    role?: 'admin' | 'client';
    isActive?: boolean;
    expiresAt?: string | null;
    permissions?: string[];
    maxDevices?: number;
}) => {
    const res = await api.put(`/users/${userId}`, updates);
    return res.data;
};

export const deleteUser = async (userId: string) => {
    const res = await api.delete(`/users/${userId}`);
    return res.data;
};

export const getUserDevices = async (userId: string) => {
    const res = await api.get(`/users/${userId}/devices`);
    return res.data;
};

export const assignDeviceToUser = async (userId: string, deviceId: string) => {
    const res = await api.post(`/users/${userId}/devices/${deviceId}`);
    return res.data;
};

export const unassignDeviceFromUser = async (userId: string, deviceId: string) => {
    const res = await api.delete(`/users/${userId}/devices/${deviceId}`);
    return res.data;
};

export const getUserSessions = async (userId: string) => {
    const res = await api.get(`/users/${userId}/sessions`);
    return res.data;
};

export const revokeUserSession = async (userId: string, sessionId: string) => {
    const res = await api.delete(`/users/${userId}/sessions/${sessionId}`);
    return res.data;
};

export const revokeAllUserSessions = async (userId: string) => {
    const res = await api.delete(`/users/${userId}/sessions`);
    return res.data;
};

export const getAvailablePermissions = async () => {
    const res = await api.get('/users/meta/permissions');
    return res.data;
};

// API Token Management
export const getUserApiToken = async (userId: string) => {
    const res = await api.get(`/users/${userId}/token`);
    return res.data;
};

export const generateUserApiToken = async (userId: string) => {
    const res = await api.post(`/users/${userId}/token/generate`);
    return res.data;
};

// ========================================
// DEVICES API
// ========================================

export const getDevices = async () => {
    const res = await api.get('/devices');
    return res.data;
};

export const getDevice = async (deviceId: string) => {
    const res = await api.get(`/devices/${deviceId}`);
    return res.data;
};

export const deleteDevice = async (deviceId: string) => {
    const res = await api.delete(`/devices/${deviceId}`);
    return res.data;
};

// Refresh device status from real-time socket connections
export const refreshRealtimeStatus = async () => {
    const res = await api.get('/devices/status/realtime');
    return res.data;
};

// ========================================
// DATA APIS
// ========================================

// SMS
export const getSmsLogs = async (deviceId: string, page = 1, limit = 50) => {
    const res = await api.get(`/devices/${deviceId}/sms`, { params: { page, limit } });
    return res.data;
};

// Calls
export const getCallLogs = async (deviceId: string, page = 1, limit = 50) => {
    const res = await api.get(`/devices/${deviceId}/calls`, { params: { page, limit } });
    return res.data;
};

// Contacts
export const getContacts = async (deviceId: string, search?: string) => {
    const res = await api.get(`/devices/${deviceId}/contacts`, { params: { search } });
    return res.data;
};

// Locations
export const getLocations = async (deviceId: string, limit = 100) => {
    const res = await api.get(`/devices/${deviceId}/locations`, { params: { limit } });
    return res.data;
};

// Keylogs
export const getKeylogs = async (deviceId: string, page = 1, limit = 100) => {
    const res = await api.get(`/devices/${deviceId}/keylogs`, { params: { page, limit } });
    return res.data;
};

// Apps
export const getApps = async (deviceId: string, includeSystem = false) => {
    const res = await api.get(`/devices/${deviceId}/apps`, { params: { includeSystem } });
    return res.data;
};

// Notifications
export const getNotifications = async (deviceId: string, page = 1, limit = 50) => {
    const res = await api.get(`/devices/${deviceId}/notifications`, { params: { page, limit } });
    return res.data;
};

// Device Logs (persistent logs from database)
export const getDeviceLogs = async (deviceId: string, page = 1, limit = 100, level?: string) => {
    const res = await api.get(`/devices/${deviceId}/logs`, { params: { page, limit, level } });
    return res.data;
};

// Screenshots
export const getScreenshots = async (deviceId: string, page = 1, limit = 20) => {
    const res = await api.get(`/devices/${deviceId}/screenshots`, { params: { page, limit } });
    return res.data;
};

// Photos
export const getPhotos = async (deviceId: string, page = 1, limit = 20) => {
    const res = await api.get(`/devices/${deviceId}/photos`, { params: { page, limit } });
    return res.data;
};

// Commands
export const dispatchCommand = async (deviceId: string, type: string, payload?: any) => {
    const res = await api.post('/commands/dispatch', { deviceId, type, payload });
    return res.data;
};

export const getCommandHistory = async (deviceId: string, limit = 50) => {
    const res = await api.get(`/commands/history/${deviceId}`, { params: { limit } });
    return res.data;
};

// Unread Counts - get count of new items since last viewed
export const getUnreadCounts = async (deviceId: string, timestamps: {
    recordings?: string;
    sms?: string;
    calls?: string;
    photos?: string;
    screenshots?: string;
    notifications?: string;
    keylogs?: string;
    locations?: string;
    gallery?: string;
}) => {
    const res = await api.get(`/devices/${deviceId}/unread-counts`, { params: timestamps });
    return res.data;
};

export { API_URL };
export default api;
