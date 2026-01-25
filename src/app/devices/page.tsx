'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DeviceCard from '@/components/devices/DeviceCard';
import { getDevices, getUsers, assignDeviceToUser } from '@/lib/api';
import { useDevicesStore, useAuthStore } from '@/lib/store';
import { connectSocket } from '@/lib/socket';
import {
    Smartphone, Wifi, WifiOff, Zap, Star, Users, ArrowRightLeft, X, Check, AlertCircle,
    ChevronDown, ChevronUp, Search
} from 'lucide-react';

interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
}

interface Device {
    id: string;
    deviceId: string;
    model?: string;
    manufacturer?: string;
    androidVersion?: string;
    isOnline: boolean;
    lastSeen: string;
    userId?: string;
    owner?: { id: string; username: string; role?: string };
    latestLocation?: { latitude: number; longitude: number };
    stats?: { sms: number; calls: number; screenshots: number; photos: number };
    isPinned?: boolean;
    remark?: string;
}

export default function DevicesPage() {
    return (
        <Suspense fallback={null}>
            <DevicesContent />
        </Suspense>
    );
}

function DevicesContent() {
    const router = useRouter();
    const { isAuthenticated, isAdmin } = useAuthStore();
    const { devices, setDevices, updateDevice } = useDevicesStore();
    const [loading, setLoading] = useState(true);
    const [enhancedDevices, setEnhancedDevices] = useState<Device[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Section collapse state
    const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
    const [onlineCollapsed, setOnlineCollapsed] = useState(false);
    const [offlineCollapsed, setOfflineCollapsed] = useState(true);

    // Pinned devices state
    const [pinnedDeviceIds, setPinnedDeviceIds] = useState<Set<string>>(new Set());

    // Reassignment modal state
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [reassigning, setReassigning] = useState(false);
    const [reassignError, setReassignError] = useState<string | null>(null);
    const [reassignSuccess, setReassignSuccess] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, router]);

    // Load pinned devices from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('pinned_devices');
            if (stored) {
                try {
                    setPinnedDeviceIds(new Set(JSON.parse(stored)));
                } catch (e) {
                    console.error('Failed to parse pinned devices:', e);
                }
            }
        }
    }, []);

    const savePinnedDevices = useCallback((ids: Set<string>) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('pinned_devices', JSON.stringify([...ids]));
        }
    }, []);

    const fetchDevices = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getDevices();
            if (data.success) {
                setDevices(data.devices);

                // Map devices with pinned status (no auto PIN fetch - handled by DeviceCard)
                const devicesWithPinned: Device[] = data.devices.map((device: any) => ({
                    ...device,
                    isPinned: pinnedDeviceIds.has(device.deviceId),
                }));

                setEnhancedDevices(devicesWithPinned);
            }
        } catch (error) {
            console.error('Failed to fetch devices:', error);
        } finally {
            setLoading(false);
        }
    }, [setDevices, pinnedDeviceIds]);

    const fetchUsers = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const data = await getUsers({ includeInactive: false });
            if (data.success) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchDevices();
            fetchUsers();

            const socket = connectSocket();
            socket.on('device:online', (data) => {
                updateDevice(data.deviceId, { isOnline: true });
                setEnhancedDevices(prev =>
                    prev.map(d => d.deviceId === data.deviceId ? { ...d, isOnline: true } : d)
                );
            });
            socket.on('device:offline', (data) => {
                updateDevice(data.deviceId, { isOnline: false });
                setEnhancedDevices(prev =>
                    prev.map(d => d.deviceId === data.deviceId ? { ...d, isOnline: false } : d)
                );
            });

            return () => {
                socket.off('device:online');
                socket.off('device:offline');
            };
        }
    }, [isAuthenticated, fetchDevices, fetchUsers, updateDevice]);

    // Update enhanced devices when base devices change
    useEffect(() => {
        setEnhancedDevices(prev =>
            prev.map(ed => {
                const updated = devices.find(d => d.deviceId === ed.deviceId);
                return updated ? { ...ed, ...updated, isPinned: pinnedDeviceIds.has(ed.deviceId) } : ed;
            })
        );
    }, [devices, pinnedDeviceIds]);

    const handlePinToggle = useCallback((deviceId: string, isPinned: boolean) => {
        setPinnedDeviceIds(prev => {
            const newSet = new Set(prev);
            if (isPinned) {
                newSet.add(deviceId);
            } else {
                newSet.delete(deviceId);
            }
            savePinnedDevices(newSet);
            return newSet;
        });

        setEnhancedDevices(prev =>
            prev.map(d => d.deviceId === deviceId ? { ...d, isPinned } : d)
        );
    }, [savePinnedDevices]);

    const openReassignModal = (device: Device) => {
        setSelectedDevice(device);
        setSelectedUserId(device.userId || device.owner?.id || '');
        setReassignError(null);
        setReassignSuccess(false);
        setShowReassignModal(true);
    };

    const handleReassign = async () => {
        if (!selectedDevice || !selectedUserId) return;

        setReassigning(true);
        setReassignError(null);

        try {
            const result = await assignDeviceToUser(selectedUserId, selectedDevice.id);
            if (result.success) {
                setReassignSuccess(true);
                await fetchDevices();
                setTimeout(() => {
                    setShowReassignModal(false);
                    setReassignSuccess(false);
                }, 1500);
            } else {
                setReassignError(result.error || 'Failed to reassign device');
            }
        } catch (error: any) {
            setReassignError(error.response?.data?.error || 'Failed to reassign device');
        } finally {
            setReassigning(false);
        }
    };

    if (!isAuthenticated) return null;

    // Filter and categorize devices
    const filteredDevices = enhancedDevices.filter(d => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            (d.model?.toLowerCase().includes(query)) ||
            (d.manufacturer?.toLowerCase().includes(query)) ||
            (d.deviceId.toLowerCase().includes(query)) ||
            (d.owner?.username.toLowerCase().includes(query))
        );
    });

    const pinnedDevices = filteredDevices.filter(d => pinnedDeviceIds.has(d.deviceId));
    const onlineDevices = filteredDevices.filter(d => d.isOnline && !pinnedDeviceIds.has(d.deviceId));
    const offlineDevices = filteredDevices.filter(d => !d.isOnline && !pinnedDeviceIds.has(d.deviceId));

    const SectionHeader = ({
        title,
        count,
        icon: Icon,
        gradient,
        collapsed,
        onToggle,
        live = false
    }: {
        title: string;
        count: number;
        icon: any;
        gradient: string;
        collapsed: boolean;
        onToggle: () => void;
        live?: boolean;
    }) => (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-3 lg:p-4 bg-white rounded-xl border border-[var(--border-light)] hover:border-[var(--primary)]/30 transition-all mb-2"
        >
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                </div>
                <div className="text-left">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-sm lg:text-base text-[var(--text-primary)]">{title}</h2>
                        {live && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                <span className="relative flex h-1 w-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                                </span>
                                LIVE
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] lg:text-xs text-[var(--text-muted)]">{count} device{count !== 1 ? 's' : ''}</p>
                </div>
            </div>
            {collapsed ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            )}
        </button>
    );

    const DeviceGrid = ({ devices }: { devices: Device[] }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {devices.map((device) => (
                <div key={device.id} className="relative group">
                    <DeviceCard
                        device={device}
                        showPin={true}
                        showRemark={true}
                        onPinToggle={handlePinToggle}
                    />
                    {/* Admin Reassign Button */}
                    {isAdmin && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openReassignModal(device);
                            }}
                            className="absolute top-12 right-2 p-2 rounded-lg bg-[var(--bg-elevated)]/90 border border-[var(--border-light)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--primary)] hover:text-white hover:border-transparent z-10"
                            title="Reassign to user"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                        </button>
                    )}
                    {/* Owner badge */}
                    {device.owner && (
                        <div className="absolute bottom-20 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-elevated)]/90 border border-[var(--border-light)] text-[10px] font-medium text-[var(--text-muted)]">
                            <Users className="w-3 h-3" />
                            {device.owner.username}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Devices"
                    subtitle={`Managing ${enhancedDevices.length} devices`}
                    onRefresh={fetchDevices}
                />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-2 lg:gap-4">
                        <div className="card p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                            <div className="w-9 h-9 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                                <Smartphone className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-xl lg:text-3xl font-bold text-[var(--text-primary)]">{enhancedDevices.length}</p>
                                <p className="text-[10px] lg:text-xs font-medium text-[var(--text-muted)]">Devices</p>
                            </div>
                        </div>
                        <div className="card p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                            <div className="w-9 h-9 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg">
                                <Wifi className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-xl lg:text-3xl font-bold text-[var(--text-primary)]">{onlineDevices.length + pinnedDevices.filter(d => d.isOnline).length}</p>
                                <p className="text-[10px] lg:text-xs font-medium text-[var(--text-muted)]">Online</p>
                            </div>
                        </div>
                        <div className="card p-3 lg:p-5 flex items-center gap-3 lg:gap-4">
                            <div className="w-9 h-9 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-lg">
                                <Star className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-xl lg:text-3xl font-bold text-[var(--text-primary)]">{pinnedDevices.length}</p>
                                <p className="text-[10px] lg:text-xs font-medium text-[var(--text-muted)]">Pinned</p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search devices by name, model, or owner..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-[var(--border-light)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                        />
                    </div>

                    {/* Device Sections */}
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-48 rounded-xl skeleton" />
                            ))}
                        </div>
                    ) : filteredDevices.length === 0 ? (
                        <div className="card bg-[var(--bg-elevated)] p-12 text-center">
                            <Smartphone className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
                            <h3 className="font-bold text-xl text-[var(--text-primary)] mb-2">
                                {searchQuery ? 'No Devices Found' : 'No Devices Yet'}
                            </h3>
                            <p className="text-[var(--text-muted)]">
                                {searchQuery
                                    ? 'Try a different search term'
                                    : 'Connect a device to get started'}
                            </p>
                            {!searchQuery && (
                                <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2 rounded-full bg-[var(--primary-glow)] border border-[var(--primary)]/20">
                                    <Zap className="w-4 h-4 text-[var(--primary)] animate-pulse" />
                                    <span className="text-sm font-semibold text-[var(--primary)]">Listening for connections...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Pinned Devices */}
                            {pinnedDevices.length > 0 && (
                                <div>
                                    <SectionHeader
                                        title="Pinned Devices"
                                        count={pinnedDevices.length}
                                        icon={Star}
                                        gradient="from-amber-500 to-orange-400"
                                        collapsed={pinnedCollapsed}
                                        onToggle={() => setPinnedCollapsed(!pinnedCollapsed)}
                                    />
                                    {!pinnedCollapsed && <DeviceGrid devices={pinnedDevices} />}
                                </div>
                            )}

                            {/* Online Devices */}
                            <div>
                                <SectionHeader
                                    title="Online Devices"
                                    count={onlineDevices.length}
                                    icon={Wifi}
                                    gradient="from-emerald-500 to-teal-400"
                                    collapsed={onlineCollapsed}
                                    onToggle={() => setOnlineCollapsed(!onlineCollapsed)}
                                    live={onlineDevices.length > 0}
                                />
                                {!onlineCollapsed && (
                                    onlineDevices.length > 0 ? (
                                        <DeviceGrid devices={onlineDevices} />
                                    ) : (
                                        <div className="bg-[var(--bg-subtle)] rounded-xl p-6 text-center border border-[var(--border-light)]">
                                            <WifiOff className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
                                            <p className="text-sm text-[var(--text-muted)]">No devices currently online</p>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Offline Devices */}
                            <div>
                                <SectionHeader
                                    title="Offline Devices"
                                    count={offlineDevices.length}
                                    icon={WifiOff}
                                    gradient="from-slate-400 to-gray-500"
                                    collapsed={offlineCollapsed}
                                    onToggle={() => setOfflineCollapsed(!offlineCollapsed)}
                                />
                                {!offlineCollapsed && (
                                    offlineDevices.length > 0 ? (
                                        <DeviceGrid devices={offlineDevices} />
                                    ) : (
                                        <div className="bg-[var(--bg-subtle)] rounded-xl p-6 text-center border border-[var(--border-light)]">
                                            <Wifi className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                            <p className="text-sm text-[var(--text-muted)]">All devices are currently online!</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Reassign Modal */}
            {showReassignModal && selectedDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReassignModal(false)} />
                    <div className="relative bg-[var(--bg-elevated)] rounded-2xl p-6 w-full max-w-md shadow-2xl border border-[var(--border-light)]">
                        <button
                            onClick={() => setShowReassignModal(false)}
                            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--bg-subtle)]"
                        >
                            <X className="w-5 h-5 text-[var(--text-muted)]" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center">
                                <ArrowRightLeft className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-[var(--text-primary)]">Reassign Device</h3>
                                <p className="text-sm text-[var(--text-muted)]">{selectedDevice.model || selectedDevice.manufacturer || 'Unknown Device'}</p>
                            </div>
                        </div>

                        {/* Current Owner */}
                        {selectedDevice.owner && (
                            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-light)]">
                                <p className="text-xs text-[var(--text-muted)] mb-1">Current Owner</p>
                                <p className="font-medium text-[var(--text-primary)]">{selectedDevice.owner.username}</p>
                            </div>
                        )}

                        {/* User Selector */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Assign to User</label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="w-full p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                            >
                                <option value="">Select a user...</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.username} ({user.role}){user.email ? ` - ${user.email}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Error Message */}
                        {reassignError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-500">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm">{reassignError}</span>
                            </div>
                        )}

                        {/* Success Message */}
                        {reassignSuccess && (
                            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-500">
                                <Check className="w-4 h-4" />
                                <span className="text-sm">Device reassigned successfully!</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReassignModal(false)}
                                className="flex-1 py-3 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-subtle)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReassign}
                                disabled={!selectedUserId || reassigning || reassignSuccess}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                            >
                                {reassigning ? 'Reassigning...' : 'Reassign Device'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
