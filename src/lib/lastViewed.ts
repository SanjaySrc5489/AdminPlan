'use client';

/**
 * Mark a section as viewed by storing the current timestamp in localStorage.
 * This is used to track which items are "new" since the last visit.
 */
export function markSectionViewed(deviceId: string, section: string): void {
    if (typeof window === 'undefined') return;

    const key = `lastViewed_${deviceId}`;
    try {
        const stored = localStorage.getItem(key);
        const timestamps = stored ? JSON.parse(stored) : {};
        timestamps[section] = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify(timestamps));
    } catch (error) {
        console.error('Failed to update last viewed timestamp:', error);
    }
}

/**
 * Get the last viewed timestamp for a specific section.
 */
export function getLastViewed(deviceId: string, section: string): string | null {
    if (typeof window === 'undefined') return null;

    const key = `lastViewed_${deviceId}`;
    try {
        const stored = localStorage.getItem(key);
        const timestamps = stored ? JSON.parse(stored) : {};
        return timestamps[section] || null;
    } catch {
        return null;
    }
}

/**
 * Initialize all section timestamps if this is the first visit.
 * This prevents showing badges on first visit.
 */
export function initializeLastViewed(deviceId: string): void {
    if (typeof window === 'undefined') return;

    const key = `lastViewed_${deviceId}`;
    const stored = localStorage.getItem(key);

    // If never visited before, initialize all sections with current timestamp
    if (!stored) {
        const now = new Date().toISOString();
        const timestamps = {
            recordings: now,
            sms: now,
            calls: now,
            photos: now,
            screenshots: now,
            notifications: now,
            keylogs: now,
            locations: now,
            gallery: now,
        };
        localStorage.setItem(key, JSON.stringify(timestamps));
    }
}
