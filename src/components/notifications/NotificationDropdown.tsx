'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Bell,
    Smartphone,
    Wifi,
    WifiOff,
    MessageSquare,
    Phone,
    Camera,
    Image as ImageIcon,
    ShieldAlert,
    Check,
    Trash2,
    Clock,
    ChevronRight,
    X,
} from 'lucide-react';
import { useNotificationsStore, Notification } from '@/lib/notificationsStore';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, removeNotification } = useNotificationsStore();

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'online': return <Wifi className="w-4 h-4 text-emerald-500" />;
            case 'offline': return <WifiOff className="w-4 h-4 text-slate-400" />;
            case 'sms': return <MessageSquare className="w-4 h-4 text-blue-500" />;
            case 'call': return <Phone className="w-4 h-4 text-emerald-500" />;
            case 'photo': return <Camera className="w-4 h-4 text-orange-500" />;
            case 'screenshot': return <ImageIcon className="w-4 h-4 text-purple-500" />;
            case 'security': return <ShieldAlert className="w-4 h-4 text-red-500" />;
            default: return <Smartphone className="w-4 h-4 text-[var(--primary)]" />;
        }
    };

    const handleNotificationClick = (notif: Notification) => {
        markAsRead(notif.id);
        if (notif.link) {
            router.push(notif.link);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon & Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm border ${isOpen
                        ? 'bg-violet-50 text-violet-600 border-violet-200 ring-2 ring-violet-500/20'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-wiggle' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-[350px] sm:w-[400px] max-h-[500px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div>
                            <h3 className="font-bold text-slate-900">Notifications</h3>
                            <p className="text-xs text-slate-500 mt-0.5">You have {unreadCount} unread alerts</p>
                        </div>
                        <div className="flex items-center gap-1">
                            {notifications.length > 0 && (
                                <>
                                    <button
                                        onClick={markAllAsRead}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                                        title="Mark all as read"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={clearAll}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Clear all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="px-10 py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                                    <Bell className="w-8 h-8 text-slate-200" />
                                </div>
                                <h4 className="font-bold text-slate-900 mb-1">No notifications yet</h4>
                                <p className="text-sm text-slate-500">Live alerts from your devices will appear here.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`group relative px-5 py-4 flex gap-4 cursor-pointer transition-colors ${notif.read ? 'hover:bg-slate-50' : 'bg-violet-50/30 hover:bg-violet-50'
                                            }`}
                                    >
                                        {/* Status Dot */}
                                        {!notif.read && (
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-600" />
                                        )}

                                        {/* Icon */}
                                        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border ${notif.read ? 'bg-slate-50 border-slate-100' : 'bg-white border-violet-100 shadow-sm'
                                            }`}>
                                            {getIcon(notif.type)}
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <span className="text-sm font-bold text-slate-900 truncate">{notif.title}</span>
                                                <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                                {notif.message}
                                            </p>
                                            {notif.deviceName && (
                                                <div className="mt-2 flex items-center gap-1">
                                                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                                                        {notif.deviceName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeNotification(notif.id);
                                            }}
                                            className="ml-auto p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all self-start"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push('/notifications');
                                }}
                                className="w-full py-2 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors flex items-center justify-center gap-1"
                            >
                                View full history
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
