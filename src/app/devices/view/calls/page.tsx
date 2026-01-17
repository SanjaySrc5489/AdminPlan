'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getCallLogs } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { markSectionViewed } from '@/lib/lastViewed';
import { useAuthStore } from '@/lib/store';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import {
    Phone,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    Search,
    ChevronLeft,
    ChevronRight,
    Clock,
    ArrowLeft,
    User,
    Calendar,
} from 'lucide-react';
import Link from 'next/link';

export default function CallLogsPage() {
    return (
        <Suspense fallback={null}>
            <CallLogsContent />
        </Suspense>
    );
}

function CallLogsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [callLogs, setCallLogs] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');

    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    const fetchCalls = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const data = await getCallLogs(deviceId, page, 50);
            if (data.success) {
                setCallLogs(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch calls:', error);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            fetchCalls();
        }
    }, [isAuthenticated, deviceId, fetchCalls]);

    // Mark section as viewed to clear unread badge
    useEffect(() => {
        if (deviceId) {
            markSectionViewed(deviceId, 'calls');
        }
    }, [deviceId]);

    // Listen for real-time call log updates from server
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        const socket = connectSocket();

        const handleCallsUpdate = (data: { deviceId: string; count: number }) => {
            if (data.deviceId === deviceId) {
                console.log(`[Calls] New call logs synced: ${data.count}, auto-refreshing...`);
                fetchCalls(pagination.page);
            }
        };

        socket.on('calls:update', handleCallsUpdate);

        return () => {
            socket.off('calls:update', handleCallsUpdate);
        };
    }, [isAuthenticated, deviceId, fetchCalls, pagination.page]);

    const filteredCalls = callLogs.filter(call => {
        const matchesFilter = filter === 'all' || call.type === filter;
        const matchesSearch = search === '' ||
            call.number.toLowerCase().includes(search.toLowerCase()) ||
            (call.name && call.name.toLowerCase().includes(search.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    // Stats
    const incomingCount = callLogs.filter(c => c.type === 'incoming').length;
    const outgoingCount = callLogs.filter(c => c.type === 'outgoing').length;
    const missedCount = callLogs.filter(c => c.type === 'missed').length;

    const formatCallDuration = (seconds: number) => {
        if (seconds === 0) return '0s';
        const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
        return formatDuration(duration, { format: ['hours', 'minutes', 'seconds'], delimiter: ' ' });
    };

    const getCallConfig = (type: string) => {
        switch (type) {
            case 'incoming':
                return {
                    icon: PhoneIncoming,
                    gradient: 'from-emerald-500 to-teal-500',
                    bg: 'bg-emerald-50',
                    text: 'text-emerald-600',
                    label: 'Incoming'
                };
            case 'outgoing':
                return {
                    icon: PhoneOutgoing,
                    gradient: 'from-blue-500 to-cyan-500',
                    bg: 'bg-blue-50',
                    text: 'text-blue-600',
                    label: 'Outgoing'
                };
            case 'missed':
                return {
                    icon: PhoneMissed,
                    gradient: 'from-red-500 to-rose-500',
                    bg: 'bg-red-50',
                    text: 'text-red-600',
                    label: 'Missed'
                };
            default:
                return {
                    icon: Phone,
                    gradient: 'from-slate-500 to-gray-500',
                    bg: 'bg-slate-50',
                    text: 'text-slate-600',
                    label: 'Unknown'
                };
        }
    };

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Call Logs"
                    subtitle={`${pagination.total} calls recorded`}
                    onRefresh={() => fetchCalls(pagination.page)}
                />

                <div className="p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
                    {/* Back Button */}
                    <Link
                        href={`/devices/view/?id=${deviceId}`}
                        className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium mb-6 group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center group-hover:bg-[var(--primary-glow)] transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        Back to Device
                    </Link>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        {[
                            { key: 'all', label: 'All Calls', count: callLogs.length, icon: Phone, gradient: 'from-violet-500 to-purple-500' },
                            { key: 'incoming', label: 'Incoming', count: incomingCount, icon: PhoneIncoming, gradient: 'from-emerald-500 to-teal-500' },
                            { key: 'outgoing', label: 'Outgoing', count: outgoingCount, icon: PhoneOutgoing, gradient: 'from-blue-500 to-cyan-500' },
                            { key: 'missed', label: 'Missed', count: missedCount, icon: PhoneMissed, gradient: 'from-red-500 to-rose-500' },
                        ].map((stat) => {
                            const Icon = stat.icon;
                            const isActive = filter === stat.key;
                            return (
                                <button
                                    key={stat.key}
                                    onClick={() => setFilter(stat.key as any)}
                                    className={`card p-4 flex items-center gap-3 transition-all ${isActive
                                        ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-base)]'
                                        : 'hover:shadow-lg'
                                        }`}
                                >
                                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                                        <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xl lg:text-2xl font-bold text-[var(--text-primary)]">{stat.count}</p>
                                        <p className="text-xs font-medium text-[var(--text-muted)]">{stat.label}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            placeholder="Search by name or number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pl-12 w-full"
                        />
                    </div>

                    {/* Call List */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="card h-24 skeleton" />
                            ))}
                        </div>
                    ) : filteredCalls.length === 0 ? (
                        <div className="card bg-[var(--bg-elevated)] empty-state">
                            <div className="empty-state-icon">
                                <Phone className="w-10 h-10" />
                            </div>
                            <h3 className="empty-state-title">No Calls Found</h3>
                            <p className="empty-state-description">No call logs match your search criteria.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredCalls.map((call, i) => {
                                const config = getCallConfig(call.type);
                                const Icon = config.icon;
                                return (
                                    <div
                                        key={call.id}
                                        className={`card bg-[var(--bg-elevated)] p-0 overflow-hidden hover:shadow-lg transition-all animate-fade-in stagger-${(i % 5) + 1}`}
                                    >
                                        {/* Top accent bar */}
                                        <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />

                                        <div className="p-4 lg:p-5">
                                            <div className="flex items-center gap-4">
                                                {/* Call Type Icon */}
                                                <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                                    <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                                                </div>

                                                {/* Main Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className="font-bold text-[var(--text-primary)] text-base lg:text-lg truncate">
                                                            {call.name || 'Unknown'}
                                                        </span>
                                                        <span className={`badge ${config.bg} ${config.text} border-0`}>
                                                            {config.label}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-[var(--text-muted)] mb-2 font-medium">
                                                        {call.number}
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[var(--text-muted)]">
                                                        <span className="flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {formatCallDuration(call.duration)}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {format(new Date(call.timestamp), 'MMM d, HH:mm')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Duration Badge (Desktop) */}
                                                <div className="hidden lg:flex flex-col items-end">
                                                    <span className={`text-lg font-bold ${call.duration === 0 ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                                                        {call.duration === 0 ? 'No Answer' : formatCallDuration(call.duration)}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-muted)]">
                                                        {format(new Date(call.timestamp), 'MMM d, yyyy')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-2 lg:gap-4 mt-8">
                            <button
                                onClick={() => fetchCalls(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                                className="btn btn-secondary disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <div className="flex items-center gap-1 lg:gap-2">
                                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                    // Show pages around current page
                                    let pageNum: number;
                                    if (pagination.pages <= 5) {
                                        pageNum = i + 1;
                                    } else if (pagination.page <= 3) {
                                        pageNum = i + 1;
                                    } else if (pagination.page >= pagination.pages - 2) {
                                        pageNum = pagination.pages - 4 + i;
                                    } else {
                                        pageNum = pagination.page - 2 + i;
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => fetchCalls(pageNum)}
                                            className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl font-semibold text-sm transition-all ${pagination.page === pageNum
                                                ? 'bg-[var(--primary)] text-white shadow-lg'
                                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--primary-glow)]'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => fetchCalls(pagination.page + 1)}
                                disabled={pagination.page >= pagination.pages}
                                className="btn btn-secondary disabled:opacity-30"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
