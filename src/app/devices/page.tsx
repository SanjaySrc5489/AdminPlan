'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DeviceCard from '@/components/devices/DeviceCard';
import { getDevices, getUsers, assignDeviceToUser } from '@/lib/api';
import { useDevicesStore, useAuthStore } from '@/lib/store';
import { connectSocket } from '@/lib/socket';
import { Smartphone, Wifi, WifiOff, Zap, Filter, Grid3X3, List, Users, ArrowRightLeft, X, Check, AlertCircle } from 'lucide-react';

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
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

    const fetchDevices = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getDevices();
            if (data.success) {
                setDevices(data.devices);
            }
        } catch (error) {
            console.error('Failed to fetch devices:', error);
        } finally {
            setLoading(false);
        }
    }, [setDevices]);

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
            });

            socket.on('device:offline', (data) => {
                updateDevice(data.deviceId, { isOnline: false });
            });

            return () => {
                socket.off('device:online');
                socket.off('device:offline');
            };
        }
    }, [isAuthenticated, fetchDevices, fetchUsers, updateDevice]);

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
                // Refresh devices list
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

    const onlineDevices = devices.filter(d => d.isOnline);
    const offlineDevices = devices.filter(d => !d.isOnline);

    const filteredDevices = filter === 'all' ? devices :
        filter === 'online' ? onlineDevices : offlineDevices;

    const filterTabs = [
        { key: 'all', label: 'All Devices', count: devices.length, icon: Smartphone, gradient: 'from-violet-500 to-purple-500' },
        { key: 'online', label: 'Online', count: onlineDevices.length, icon: Wifi, gradient: 'from-emerald-500 to-teal-500' },
        { key: 'offline', label: 'Offline', count: offlineDevices.length, icon: WifiOff, gradient: 'from-slate-400 to-gray-500' },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Devices"
                    subtitle={`Managing ${devices.length} devices`}
                    onRefresh={fetchDevices}
                />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
                    {/* Stats Bar */}
                    <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6 lg:mb-8">
                        {filterTabs.map((tab, i) => {
                            const Icon = tab.icon;
                            const isActive = filter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilter(tab.key as any)}
                                    className={`card p-4 lg:p-5 flex flex-col sm:flex-row items-center gap-3 transition-all stagger-${i + 1} ${isActive
                                        ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-base)]'
                                        : 'hover:shadow-lg'
                                        }`}
                                >
                                    <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-lg`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <p className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)]">{tab.count}</p>
                                        <p className="text-xs lg:text-sm font-medium text-[var(--text-muted)]">{tab.label}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center shadow-lg">
                                <Filter className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-bold text-[var(--text-primary)]">
                                    {filter === 'all' ? 'All Devices' : filter === 'online' ? 'Online Devices' : 'Offline Devices'}
                                </h2>
                                <p className="text-xs text-[var(--text-muted)]">{filteredDevices.length} devices shown</p>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)]">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                                    ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                    }`}
                            >
                                <Grid3X3 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                                    ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                    }`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Device Grid/List */}
                    {loading ? (
                        <div className={`grid gap-4 lg:gap-6 ${viewMode === 'grid'
                            ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                            : 'grid-cols-1'
                            }`}>
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className={`card skeleton ${viewMode === 'grid' ? 'h-56' : 'h-24'}`} />
                            ))}
                        </div>
                    ) : filteredDevices.length === 0 ? (
                        <div className="card bg-[var(--bg-elevated)] empty-state">
                            <div className="empty-state-icon">
                                <Smartphone className="w-10 h-10" />
                            </div>
                            <h3 className="empty-state-title">
                                {filter === 'all' ? 'No Devices Found' : filter === 'online' ? 'No Online Devices' : 'No Offline Devices'}
                            </h3>
                            <p className="empty-state-description">
                                {filter === 'all'
                                    ? 'Your monitoring list is empty. Connect a new device to get started.'
                                    : filter === 'online'
                                        ? 'All devices are currently offline.'
                                        : 'All devices are currently online.'}
                            </p>
                            {filter === 'all' && (
                                <div className="flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-[var(--primary-glow)] border border-[var(--primary)]/20">
                                    <Zap className="w-4 h-4 text-[var(--primary)] animate-glow" />
                                    <span className="text-sm font-semibold text-[var(--primary)]">Listening for connections...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`grid gap-4 lg:gap-6 ${viewMode === 'grid'
                            ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                            : 'grid-cols-1'
                            }`}>
                            {filteredDevices.map((device: any, i) => (
                                <div key={device.id} className={`animate-fade-in stagger-${(i % 6) + 1} relative group`}>
                                    <DeviceCard device={device} />
                                    {/* Admin Reassign Button */}
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                openReassignModal(device);
                                            }}
                                            className="absolute top-2 right-2 p-2 rounded-lg bg-[var(--bg-elevated)]/90 border border-[var(--border-light)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--primary)] hover:text-white hover:border-transparent"
                                            title="Reassign to user"
                                        >
                                            <ArrowRightLeft className="w-4 h-4" />
                                        </button>
                                    )}
                                    {/* Show current owner badge */}
                                    {device.owner && (
                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-elevated)]/90 border border-[var(--border-light)] text-[10px] font-medium text-[var(--text-muted)]">
                                            <Users className="w-3 h-3" />
                                            {device.owner.username}
                                        </div>
                                    )}
                                </div>
                            ))}
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
