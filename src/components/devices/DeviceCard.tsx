'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
    Smartphone,
    MapPin,
    MessageSquare,
    Phone,
    Camera,
    Image,
    ChevronRight,
    Wifi,
    WifiOff,
    Clock,
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
    };
}

export default function DeviceCard({ device }: DeviceCardProps) {
    const lastSeenText = formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true });

    const stats = [
        { icon: MessageSquare, value: device.stats?.sms || 0, color: 'text-blue-500' },
        { icon: Phone, value: device.stats?.calls || 0, color: 'text-emerald-500' },
        { icon: Image, value: device.stats?.screenshots || 0, color: 'text-purple-500' },
        { icon: Camera, value: device.stats?.photos || 0, color: 'text-orange-500' },
    ];

    return (
        <Link href={`/devices/view/?id=${device.deviceId}`}>
            <div className="bg-white rounded-xl p-4 border border-[var(--border-light)] shadow-sm hover:shadow-md hover:border-[var(--primary)]/30 transition-all relative overflow-hidden">
                {/* Top accent */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${device.isOnline
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                    : 'bg-[var(--border-default)]'
                    }`} />

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${device.isOnline
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-400'
                        : 'bg-[var(--bg-subtle)]'
                        }`}>
                        <Smartphone className={`w-5 h-5 ${device.isOnline ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
                            {device.model || device.manufacturer || 'Unknown'}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-[var(--aurora-violet)] bg-[var(--aurora-violet)]/10 px-1.5 py-0.5 rounded">
                                Android {device.androidVersion || '?'}
                            </span>
                            <span className={`flex items-center gap-1 text-[10px] font-semibold ${device.isOnline ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`}>
                                {device.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {device.isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center py-2 rounded-lg bg-[var(--bg-subtle)]">
                            <stat.icon className={`w-4 h-4 mx-auto mb-0.5 ${stat.color}`} />
                            <span className="text-xs font-bold text-[var(--text-primary)]">{stat.value}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 text-[10px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {device.latestLocation ? (
                            <span className="font-mono">
                                {device.latestLocation.latitude.toFixed(2)}, {device.latestLocation.longitude.toFixed(2)}
                            </span>
                        ) : (
                            <span>No location</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{lastSeenText}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
