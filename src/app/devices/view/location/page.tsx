'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getLocations } from '@/lib/api';
import { markSectionViewed } from '@/lib/lastViewed';
import { useAuthStore } from '@/lib/store';
import { format, formatDistanceToNow } from 'date-fns';
import {
    MapPin,
    ArrowLeft,
    Navigation,
    Clock,
    Target,
    Zap,
    ZapOff,
    Loader2,
    Signal,
    ChevronDown,
    ChevronUp,
    History,
    Crosshair,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { connectSocket } from '@/lib/socket';

// Dynamic import for Leaflet (SSR issue)
const Map = dynamic(() => import('@/components/maps/LocationMap'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full bg-slate-50 rounded-3xl animate-pulse flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-slate-100">
                <MapPin className="w-6 h-6 text-[var(--text-muted)]" />
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Initializing Map Grid...</p>
        </div>
    ),
});

export default function LocationPage() {
    return (
        <Suspense fallback={null}>
            <LocationContent />
        </Suspense>
    );
}

function LocationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<any>(null);
    const [isLive, setIsLive] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Socket for live updates
    const [socket, setSocket] = useState<any>(null);

    useEffect(() => {
        if (isAuthenticated) {
            const s = connectSocket();
            setSocket(s);
            s.emit('admin:join');
            console.log('[Socket] Location page joined admin room');

            return () => {
                if (isLive) {
                    console.log('[Socket] Leaving page - stopping live location');
                    s.emit('admin:sendCommand', {
                        deviceId,
                        type: 'stop_live_location',
                        payload: {}
                    });
                }
            };
        }
    }, [isAuthenticated, deviceId, isLive]);

    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getLocations(deviceId, 200);
            if (data.success) {
                setLocations(data.data);
                if (data.data.length > 0) {
                    setSelectedLocation(data.data[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch locations:', error);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            fetchLocations();
        }
    }, [isAuthenticated, deviceId, fetchLocations]);

    // Mark section as viewed to clear unread badge
    useEffect(() => {
        if (deviceId) {
            markSectionViewed(deviceId, 'locations');
        }
    }, [deviceId]);

    // Live Socket Listener
    useEffect(() => {
        if (!socket || !isLive) return;

        const handleLiveUpdate = (data: any) => {
            console.log('[Socket] Live location update received:', data);
            const incomingId = data.deviceId || data.id;
            if (incomingId && deviceId && incomingId.toString().toLowerCase() !== deviceId.toString().toLowerCase()) {
                return;
            }

            const newLocation = {
                id: `live-${Date.now()}`,
                ...data,
                timestamp: new Date().toISOString()
            };

            setLocations(prev => [newLocation, ...prev].slice(0, 300));
            setSelectedLocation(newLocation);
        };

        socket.on('location:update', handleLiveUpdate);
        return () => {
            socket.off('location:update', handleLiveUpdate);
        };
    }, [socket, isLive, deviceId]);

    const toggleLiveMode = async () => {
        if (!socket) return;

        setIsToggling(true);
        const commandType = isLive ? 'stop_live_location' : 'start_live_location';

        try {
            console.log(`[Socket] Sending ${commandType} to ${deviceId}`);
            socket.emit('admin:sendCommand', {
                deviceId,
                type: commandType,
                payload: {}
            });

            setTimeout(() => {
                setIsLive(!isLive);
                setIsToggling(false);
            }, 800);
        } catch (error) {
            console.error('Failed to toggle live mode:', error);
            setIsToggling(false);
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    const latestLocation = locations[0];

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Location Tracking"
                    subtitle={`${locations.length} coordinates archived`}
                    onRefresh={fetchLocations}
                />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
                    {/* Header Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <Link
                            href={`/devices/view/?id=${deviceId}`}
                            className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium w-fit group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center group-hover:bg-[var(--primary-glow)] transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                            </div>
                            Back to Device
                        </Link>

                        <button
                            onClick={toggleLiveMode}
                            disabled={isToggling}
                            className={`btn flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all shadow-lg ${isLive
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200 border-none'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-200 border-none'
                                }`}
                        >
                            {isToggling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isLive ? (
                                <ZapOff className="w-4 h-4" />
                            ) : (
                                <Zap className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">{isLive ? 'Stop Live Tracking' : 'Start Live Tracking'}</span>
                            <span className="sm:hidden">{isLive ? 'Stop' : 'Go Live'}</span>
                        </button>
                    </div>

                    {/* Current Location Card (Mobile) */}
                    {latestLocation && (
                        <div className="lg:hidden mb-4">
                            <div className="card bg-[var(--bg-elevated)] p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLive ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {isLive ? <Navigation className="w-5 h-5 animate-pulse" /> : <MapPin className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                                                {isLive ? 'Live Position' : 'Last Known'}
                                            </span>
                                            {isLive && (
                                                <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                    LIVE
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-mono text-[var(--text-primary)]">
                                            {latestLocation.latitude?.toFixed(6)}, {latestLocation.longitude?.toFixed(6)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {formatDistanceToNow(new Date(latestLocation.timestamp), { addSuffix: true })}
                                    </span>
                                    {latestLocation.accuracy && (
                                        <span className="flex items-center gap-1">
                                            <Crosshair className="w-3.5 h-3.5" />
                                            ±{Math.round(latestLocation.accuracy)}m
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Map Container */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                        <div className="lg:col-span-2">
                            <div className="card bg-[var(--bg-elevated)] p-0 rounded-2xl lg:rounded-[2rem] border border-[var(--border-light)] overflow-hidden shadow-xl relative h-[350px] sm:h-[450px] lg:h-[600px]">
                                {loading ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 animate-pulse">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-xl">
                                                <Navigation className="w-7 h-7 text-indigo-500 animate-spin" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Connecting to Satellites...</span>
                                        </div>
                                    </div>
                                ) : locations.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                                        <div className="text-center px-4">
                                            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 border border-[var(--border-light)] shadow-lg mx-auto">
                                                <MapPin className="w-8 h-8 text-[var(--text-muted)]" />
                                            </div>
                                            <h3 className="text-lg font-bold mb-2 text-[var(--text-primary)]">No Coordinates Found</h3>
                                            <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">This device hasn't reported any location data yet.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <Map
                                        locations={locations}
                                        selectedLocation={selectedLocation}
                                        onSelectLocation={setSelectedLocation}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Location History Sidebar */}
                        <div className="card bg-[var(--bg-elevated)] p-0 rounded-2xl lg:rounded-[2rem] border border-[var(--border-light)] overflow-hidden flex flex-col shadow-xl">
                            {/* Header */}
                            <div
                                className="p-4 lg:p-6 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-[var(--border-light)] relative cursor-pointer lg:cursor-default"
                                onClick={() => setShowHistory(!showHistory)}
                            >
                                {isLive && (
                                    <div className="absolute top-3 right-3 lg:top-4 lg:right-4 flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-full animate-pulse">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider">Live</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <History className="w-4 h-4 text-[var(--primary)]" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">Movement Logs</span>
                                        </div>
                                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                                            {isLive ? 'Real-time stream active...' : `${locations.length} positions recorded`}
                                        </p>
                                    </div>
                                    <button className="lg:hidden p-2 rounded-lg bg-white border border-[var(--border-light)]">
                                        {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* History List */}
                            <div className={`flex-1 overflow-y-auto no-scrollbar transition-all duration-300 ${showHistory ? 'max-h-[400px]' : 'max-h-0 lg:max-h-[500px]'}`}>
                                {locations.length === 0 ? (
                                    <div className="p-6 text-center text-[var(--text-muted)]">
                                        <Signal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No location data available</p>
                                    </div>
                                ) : (
                                    locations.slice(0, 50).map((location, index) => {
                                        const isSelected = selectedLocation?.id === location.id;
                                        const isCurrent = index === 0;

                                        return (
                                            <button
                                                key={location.id}
                                                onClick={() => setSelectedLocation(location)}
                                                className={`w-full p-4 lg:p-5 text-left border-b border-[var(--border-light)] transition-all outline-none group ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${isSelected
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-200'
                                                        : isCurrent
                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-500'
                                                            : 'bg-white border-[var(--border-light)] text-[var(--text-muted)] group-hover:border-indigo-200'
                                                        }`}>
                                                        {isCurrent && !isSelected ? (
                                                            <Navigation className="w-4 h-4 animate-pulse" />
                                                        ) : (
                                                            <MapPin className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 block ${isSelected ? 'text-indigo-600' : isCurrent ? 'text-emerald-600' : 'text-[var(--text-muted)]'
                                                            }`}>
                                                            {isCurrent ? 'Current' : `#${locations.length - index}`}
                                                        </span>
                                                        <p className="font-mono text-xs text-[var(--text-primary)] truncate">
                                                            {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {format(new Date(location.timestamp), 'HH:mm:ss')}
                                                            </span>
                                                            {location.accuracy && (
                                                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100">
                                                                    <Target className="w-2.5 h-2.5 text-indigo-400" />
                                                                    ±{Math.round(location.accuracy)}m
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
