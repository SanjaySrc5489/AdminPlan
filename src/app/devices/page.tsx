'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DeviceCard from '@/components/devices/DeviceCard';
import { getDevices } from '@/lib/api';
import { useDevicesStore, useAuthStore } from '@/lib/store';
import { connectSocket } from '@/lib/socket';
import { Smartphone, Wifi, WifiOff, Zap, Filter, Grid3X3, List } from 'lucide-react';

export default function DevicesPage() {
    return (
        <Suspense fallback={null}>
            <DevicesContent />
        </Suspense>
    );
}

function DevicesContent() {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();
    const { devices, setDevices, updateDevice } = useDevicesStore();
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

    useEffect(() => {
        if (isAuthenticated) {
            fetchDevices();

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
    }, [isAuthenticated, fetchDevices, updateDevice]);

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
                            {filteredDevices.map((device, i) => (
                                <div key={device.id} className={`animate-fade-in stagger-${(i % 6) + 1}`}>
                                    <DeviceCard device={device} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
