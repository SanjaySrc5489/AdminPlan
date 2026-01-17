'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getSmsLogs } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { markSectionViewed } from '@/lib/lastViewed';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import {
    MessageSquare,
    ArrowDownLeft,
    ArrowUpRight,
    Search,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Inbox,
    User,
    Clock,
} from 'lucide-react';
import Link from 'next/link';

export default function SmsLogsPage() {
    return (
        <Suspense fallback={null}>
            <SmsLogsContent />
        </Suspense>
    );
}

function SmsLogsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [smsLogs, setSmsLogs] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');

    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    const fetchSms = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const data = await getSmsLogs(deviceId, page, 50);
            if (data.success) {
                setSmsLogs(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch SMS:', error);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            fetchSms();
        }
    }, [isAuthenticated, deviceId, fetchSms]);

    // Mark section as viewed to clear unread badge
    useEffect(() => {
        if (deviceId) {
            markSectionViewed(deviceId, 'sms');
        }
    }, [deviceId]);

    // Listen for real-time SMS updates from server
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        const socket = connectSocket();

        const handleSmsUpdate = (data: { deviceId: string; count: number }) => {
            if (data.deviceId === deviceId) {
                console.log(`[SMS] New messages synced: ${data.count}, auto-refreshing...`);
                fetchSms(pagination.page);
            }
        };

        socket.on('sms:update', handleSmsUpdate);

        return () => {
            socket.off('sms:update', handleSmsUpdate);
        };
    }, [isAuthenticated, deviceId, fetchSms, pagination.page]);

    const filteredSms = smsLogs.filter(sms => {
        const matchesFilter = filter === 'all' || sms.type === filter;
        const matchesSearch = search === '' ||
            sms.address.toLowerCase().includes(search.toLowerCase()) ||
            sms.body.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (!isHydrated || !isAuthenticated) return null;

    const incomingCount = smsLogs.filter(s => s.type === 'incoming').length;
    const outgoingCount = smsLogs.filter(s => s.type === 'outgoing').length;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="SMS Messages"
                    subtitle={`${pagination.total} messages captured`}
                    onRefresh={() => fetchSms(pagination.page)}
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

                    {/* Stats & Filters */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[
                            { key: 'all', label: 'All', count: smsLogs.length, icon: MessageSquare, gradient: 'from-blue-500 to-cyan-400' },
                            { key: 'incoming', label: 'Received', count: incomingCount, icon: ArrowDownLeft, gradient: 'from-emerald-500 to-teal-400' },
                            { key: 'outgoing', label: 'Sent', count: outgoingCount, icon: ArrowUpRight, gradient: 'from-purple-500 to-pink-400' },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = filter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilter(tab.key as any)}
                                    className={`card p-4 flex items-center gap-3 transition-all ${isActive
                                        ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-base)]'
                                        : 'hover:shadow-lg'
                                        }`}
                                >
                                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-lg`}>
                                        <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xl lg:text-2xl font-bold text-[var(--text-primary)]">{tab.count}</p>
                                        <p className="text-xs font-medium text-[var(--text-muted)]">{tab.label}</p>
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
                            placeholder="Search messages or phone numbers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pl-12 w-full"
                        />
                    </div>

                    {/* SMS List */}
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="card h-28 skeleton" />
                            ))}
                        </div>
                    ) : filteredSms.length === 0 ? (
                        <div className="card bg-[var(--bg-elevated)] empty-state">
                            <div className="empty-state-icon">
                                <Inbox className="w-10 h-10" />
                            </div>
                            <h3 className="empty-state-title">No Messages Found</h3>
                            <p className="empty-state-description">No SMS messages match your search criteria.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredSms.map((sms, i) => (
                                <div key={sms.id} className={`card bg-[var(--bg-elevated)] p-0 overflow-hidden hover:shadow-lg transition-all animate-fade-in stagger-${(i % 5) + 1}`}>
                                    {/* Top accent */}
                                    <div className={`h-1 ${sms.type === 'incoming'
                                        ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                                        : 'bg-gradient-to-r from-blue-400 to-cyan-400'
                                        }`} />

                                    <div className="p-4 lg:p-5">
                                        <div className="flex gap-4">
                                            {/* Avatar */}
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${sms.type === 'incoming'
                                                ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                                                : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                                } shadow-lg`}>
                                                {sms.type === 'incoming' ? (
                                                    <ArrowDownLeft className="w-5 h-5 text-white" />
                                                ) : (
                                                    <ArrowUpRight className="w-5 h-5 text-white" />
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[var(--text-primary)]">{sms.address}</span>
                                                        <span className={`badge ${sms.type === 'incoming' ? 'badge-online' : 'badge-info'}`}>
                                                            {sms.type === 'incoming' ? 'Received' : 'Sent'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {format(new Date(sms.timestamp), 'MMM d, HH:mm')}
                                                    </div>
                                                </div>

                                                {/* Message Bubble */}
                                                <div className={`p-4 rounded-2xl ${sms.type === 'incoming'
                                                    ? 'bg-[var(--bg-subtle)] rounded-tl-sm'
                                                    : 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-tr-sm border border-blue-500/10'
                                                    }`}>
                                                    <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                                                        {sms.body}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <button
                                onClick={() => fetchSms(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                                className="btn btn-secondary disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Previous</span>
                            </button>
                            <div className="flex items-center gap-2">
                                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => fetchSms(pageNum)}
                                            className={`w-10 h-10 rounded-xl font-semibold text-sm transition-all ${pagination.page === pageNum
                                                ? 'bg-[var(--primary)] text-white shadow-lg'
                                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--primary-glow)]'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                {pagination.pages > 5 && (
                                    <span className="text-[var(--text-muted)]">...</span>
                                )}
                            </div>
                            <button
                                onClick={() => fetchSms(pagination.page + 1)}
                                disabled={pagination.page >= pagination.pages}
                                className="btn btn-secondary disabled:opacity-30"
                            >
                                <span>Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
