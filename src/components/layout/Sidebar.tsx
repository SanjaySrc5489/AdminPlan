'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Smartphone,
    LogOut,
    Menu,
    X,
    Shield,
    Zap,
    Users,
    Settings,
    ChevronRight,
    Bell,
    Sparkles,
    MessageCircle,
    Headphones,
    Send,
    Crown,
    Heart,
    Star,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import NotificationListener from '../notifications/NotificationListener';

// Only essential nav items for mobile
const mobileNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
    { href: '/devices', label: 'Devices', icon: Smartphone, description: 'Manage devices' },
];

// Full nav for desktop and More menu (without Messages and Live Map)
const baseNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
    { href: '/devices', label: 'Devices', icon: Smartphone, description: 'Manage devices' },
];

const adminNavItems = [
    { href: '/users', label: 'Users', icon: Users, description: 'User management' },
];

const commonNavItems = [
    { href: '/settings', label: 'Settings', icon: Settings, description: 'Preferences' },
];

function Sidebar() {
    return (
        <Suspense fallback={null}>
            <SidebarContent />
        </Suspense>
    );
}

function SidebarContent() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { logout, isAdmin, user } = useAuthStore();

    const navItems = [
        ...baseNavItems,
        ...(isAdmin ? adminNavItems : []),
        ...commonNavItems,
    ];

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const openTelegramSupport = () => {
        window.open('https://t.me/Yeti_Pro', '_blank');
    };

    return (
        <>
            <NotificationListener />
            {/* 📱 Compact Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-2 safe-area-bottom">
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl px-1 py-1.5">
                    <div className="flex items-center justify-around">
                        {mobileNavItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200 ${active
                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                        : 'text-slate-400 active:scale-95'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className={`text-[10px] font-bold tracking-tight ${active ? 'text-white' : ''}`}>
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}

                        {/* Animated More Button */}
                        <button
                            onClick={() => setIsOpen(true)}
                            className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-slate-400 transition-all active:scale-95 group"
                        >
                            <div className="relative">
                                <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                {/* Notification dot */}
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full border border-slate-900" />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight">More</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Desktop Sidebar - Premium Glassmorphism Design */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 flex-col">
                {/* Background with gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-r border-slate-200/50" />

                {/* Decorative gradient orb */}
                <div className="absolute top-0 -right-20 w-40 h-40 bg-gradient-to-br from-violet-500/20 to-purple-500/10 rounded-full blur-3xl" />

                <div className="relative flex flex-col h-full">
                    {/* Logo Section */}
                    <div className="p-6">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30 transition-transform group-hover:scale-105">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-white shadow-lg">
                                    <Zap className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">
                                    ParentGuard
                                </h1>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[11px] font-semibold text-emerald-600">
                                        Live Monitoring
                                    </p>
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* User Profile Card */}
                    {user && (
                        <div className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border border-purple-500/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/25">
                                    {user.username?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-[var(--text-primary)] truncate">
                                        {user.username || 'User'}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        {isAdmin ? 'Administrator' : 'User'}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                    <Bell className="w-4 h-4 text-[var(--text-muted)]" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                        <p className="px-4 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            Main Menu
                        </p>
                        {navItems.map((item, index) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${active
                                        ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                                        }`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${active
                                        ? 'bg-white/20'
                                        : 'bg-[var(--bg-subtle)] group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]'
                                        }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="block">{item.label}</span>
                                        {!active && (
                                            <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">
                                                {item.description}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-all ${active
                                        ? 'text-white/70'
                                        : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                                        }`} />
                                </Link>
                            );
                        })}

                        {/* Help & Support */}
                        <div className="pt-4">
                            <p className="px-4 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                Support
                            </p>
                            <button
                                onClick={openTelegramSupport}
                                className="w-full group flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-[var(--text-secondary)] hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 transition-all"
                            >
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                                    <Send className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="block">Help & Support</span>
                                    <span className="text-[10px] text-[var(--text-muted)]">@Yeti_Pro on Telegram</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </nav>

                    {/* Pro Upgrade Card */}
                    <div className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-bold">ParentGuard Pro</span>
                        </div>
                        <p className="text-sm text-white/80 mb-3">
                            Unlock advanced features and unlimited devices
                        </p>
                        <button className="w-full py-2.5 rounded-xl bg-white text-purple-600 font-semibold text-sm hover:bg-white/90 transition-colors">
                            Upgrade Now
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200/50">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all group"
                        >
                            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                                <LogOut className="w-5 h-5" />
                            </div>
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Slide-out Menu Overlay */}
            <div
                className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-md transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* ✨ ULTRA PREMIUM Mobile Slide-out Menu */}
            <aside
                className={`fixed inset-y-0 right-0 z-[70] w-[85%] max-w-sm transform transition-all duration-500 lg:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Glassmorphism background */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/10" />

                {/* Animated orbs */}
                <div className="absolute top-20 -left-10 w-40 h-40 bg-violet-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-40 -right-10 w-32 h-32 bg-fuchsia-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                <div className="relative flex flex-col h-full text-white">
                    {/* Premium Header with Animation */}
                    <div className="relative p-6 border-b border-white/10">
                        {/* Sparkle decorations */}
                        <div className="absolute top-4 right-20">
                            <Star className="w-3 h-3 text-amber-400 animate-pulse" />
                        </div>
                        <div className="absolute top-10 right-12">
                            <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Animated Logo */}
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-purple-500/50 animate-pulse">
                                        <Shield className="w-7 h-7 text-white" />
                                    </div>
                                    {/* Crown badge */}
                                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-slate-900 shadow-lg">
                                        <Crown className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="font-bold text-xl bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                                        ParentGuard
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-xs font-medium text-emerald-400">Premium Active</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 active:scale-95"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* User Card with Animation */}
                    {user && (
                        <div className="mx-5 mt-6 p-5 rounded-2xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/40">
                                        {user.username?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    {/* Online indicator */}
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-lg text-white">
                                        {user.username || 'User'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {isAdmin && <Crown className="w-3 h-3 text-amber-400" />}
                                        <span className="text-sm text-white/60">
                                            {isAdmin ? 'Administrator' : 'User'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation with Staggered Animation */}
                    <div className="flex-1 px-5 py-6 space-y-2 overflow-y-auto">
                        <p className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                            Quick Navigation
                        </p>
                        {navItems.map((item, index) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all duration-300 ${active
                                        ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/30'
                                        : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
                                        }`}
                                    style={{
                                        animationDelay: `${index * 100}ms`,
                                        transform: isOpen ? 'translateX(0)' : 'translateX(20px)',
                                        opacity: isOpen ? 1 : 0,
                                        transition: `all 0.3s ease ${index * 0.05}s`
                                    }}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${active
                                        ? 'bg-white/20'
                                        : 'bg-gradient-to-br from-white/10 to-white/5'
                                        }`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="block text-base font-semibold">{item.label}</span>
                                        <span className={`text-xs ${active ? 'text-white/70' : 'text-white/40'}`}>
                                            {item.description}
                                        </span>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 ${active ? 'text-white/70' : 'text-white/30'}`} />
                                </Link>
                            );
                        })}
                    </div>

                    {/* Premium Help & Support Section */}
                    <div className="px-5 py-4 space-y-3">
                        {/* Telegram Support Button */}
                        <button
                            onClick={openTelegramSupport}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Send className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 text-left">
                                <span className="block font-bold text-white flex items-center gap-2">
                                    Help & Support
                                    <Heart className="w-4 h-4 text-pink-400 animate-pulse" />
                                </span>
                                <span className="text-sm text-blue-300">@Yeti_Pro on Telegram</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/30 to-red-600/30 flex items-center justify-center">
                                <LogOut className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="font-semibold text-red-400">Logout</span>
                        </button>
                    </div>

                    {/* Branding Footer */}
                    <div className="p-5 border-t border-white/10">
                        <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                            <Shield className="w-4 h-4" />
                            <span>ParentGuard v2.0</span>
                            <span>•</span>
                            <span>Made with</span>
                            <Heart className="w-3 h-3 text-pink-500 animate-pulse" />
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
