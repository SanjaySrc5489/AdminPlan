'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useNotificationsStore, Notification } from '@/lib/notificationsStore';
import { useDevicesStore } from '@/lib/store';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import {
    Bell,
    Wifi,
    WifiOff,
    MessageSquare,
    Phone,
    Camera,
    Image as ImageIcon,
    ShieldAlert,
    Smartphone,
    Trash2,
    Check,
    Clock,
    X,
    Filter,
    ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
    return (
        <Suspense fallback={null}>
            <NotificationsContent />
        </Suspense>
    );
}

function NotificationsContent() {
    const { notifications, markAsRead, markAllAsRead, clearAll, removeNotification } = useNotificationsStore();
    const { devices } = useDevicesStore();
    const [filter, setFilter] = useState<string>('all');

    // Multitenancy safety: Only show notifications for devices that are currently in the store
    // (In case old notifications from deleted/unassigned devices are in local persistence)
    const authorizedNotifications = useMemo(() => {
        return notifications.filter(n => devices.some(d => d.deviceId === n.deviceId));
    }, [notifications, devices]);

    const filteredNotifications = useMemo(() => {
        if (filter === 'all') return authorizedNotifications;
        return authorizedNotifications.filter(n => n.type === filter);
    }, [authorizedNotifications, filter]);

    const groupedNotifications = useMemo(() => {
        const groups: Record<string, Notification[]> = {};

        filteredNotifications.forEach(notif => {
            const date = startOfDay(new Date(notif.timestamp)).toISOString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(notif);
        });

        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [filteredNotifications]);

    const getIcon = (type: Notification['type']) => {
        const iconClass = "w-5 h-5";
        switch (type) {
            case 'online': return <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center"><Wifi className={`${iconClass} text-emerald-500`} /></div>;
            case 'offline': return <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center"><WifiOff className={`${iconClass} text-slate-400`} /></div>;
            case 'sms': return <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><MessageSquare className={`${iconClass} text-blue-500`} /></div>;
            case 'call': return <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center"><Phone className={`${iconClass} text-emerald-500`} /></div>;
            case 'photo': return <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center"><Camera className={`${iconClass} text-orange-500`} /></div>;
            case 'screenshot': return <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center"><ImageIcon className={`${iconClass} text-purple-500`} /></div>;
            case 'security': return <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center"><ShieldAlert className={`${iconClass} text-red-500`} /></div>;
            default: return <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center"><Smartphone className={`${iconClass} text-violet-500`} /></div>;
        }
    };

    const getDateLabel = (dateISO: string) => {
        const date = new Date(dateISO);
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'MMMM d, yyyy');
    };

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            <Sidebar />
            <main className="flex-1 lg:ml-72">
                <Header
                    title="Notifications"
                    subtitle="History of all device alerts and activity"
                />

                <div className="p-4 lg:p-8 max-w-4xl mx-auto animate-fade-in">
                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            {['all', 'sms', 'call', 'photo', 'screenshot', 'security', 'online', 'offline'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilter(type)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${filter === type
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                >
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                            ))}
                        </div>

                        {authorizedNotifications.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={markAllAsRead}
                                    className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Mark All Read
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear History
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Notifications List */}
                    {groupedNotifications.length === 0 ? (
                        <div className="card bg-white p-16 text-center shadow-sm">
                            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
                                <Bell className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">No notifications found</h3>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                {filter === 'all'
                                    ? "We haven't captured any alerts from your devices yet. They'll appear here as soon as something happens."
                                    : `You don't have any ${filter} notifications at the moment.`
                                }
                            </p>
                            {filter !== 'all' && (
                                <button
                                    onClick={() => setFilter('all')}
                                    className="mt-6 font-bold text-violet-600 hover:text-violet-700"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {groupedNotifications.map(([date, notifs]) => (
                                <section key={date}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest bg-white px-4 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                            {getDateLabel(date)}
                                        </h2>
                                        <div className="h-px flex-1 bg-slate-200/60" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {notifs.length} Alerts
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {notifs.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`group relative card bg-white p-0 overflow-hidden transition-all border-l-4 ${notif.read ? 'border-transparent' : 'border-violet-500'
                                                    } hover:shadow-lg`}
                                            >
                                                <div className="p-4 sm:p-5 flex gap-4 sm:gap-6">
                                                    {/* Icon Section */}
                                                    <div className="shrink-0">
                                                        {getIcon(notif.type)}
                                                    </div>

                                                    {/* Content Section */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className={`font-bold text-slate-900 ${notif.read ? 'opacity-70' : ''}`}>
                                                                    {notif.title}
                                                                </h3>
                                                                {!notif.read && (
                                                                    <span className="w-2 h-2 rounded-full bg-violet-500 shadow-sm shadow-violet-500/50" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                                <Clock className="w-3 h-3" />
                                                                {format(notif.timestamp, 'HH:mm')}
                                                                <span className="sm:hidden">•</span>
                                                                <span className="sm:hidden">{format(notif.timestamp, 'MMM d')}</span>
                                                            </div>
                                                        </div>

                                                        <p className={`text-sm leading-relaxed mb-4 ${notif.read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                                                            {notif.message}
                                                        </p>

                                                        <div className="flex flex-wrap items-center gap-3">
                                                            {notif.deviceName && (
                                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                                                    <Smartphone className="w-3 h-3" />
                                                                    {notif.deviceName}
                                                                </div>
                                                            )}

                                                            {notif.link && (
                                                                <Link
                                                                    href={notif.link}
                                                                    onClick={() => markAsRead(notif.id)}
                                                                    className="text-[10px] font-black text-violet-600 uppercase hover:text-violet-700 underline underline-offset-4 tracking-tighter"
                                                                >
                                                                    View Details
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex flex-col gap-2">
                                                        {!notif.read && (
                                                            <button
                                                                onClick={() => markAsRead(notif.id)}
                                                                className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-sm"
                                                                title="Mark as read"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => removeNotification(notif.id)}
                                                            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                                            title="Delete"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
