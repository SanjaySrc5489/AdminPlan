'use client';

import Link from 'next/link';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Smartphone,
    MapPin,
    LogOut,
    Menu,
    X,
    Shield,
    Zap,
    Home,
    MessageCircle,
    Users,
    Settings,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';

const baseNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/devices', label: 'Devices', icon: Smartphone },
    { href: '/messages', label: 'Messages', icon: MessageCircle },
    { href: '/map', label: 'Live Map', icon: MapPin },
];

const adminNavItems = [
    { href: '/users', label: 'Users', icon: Users },
];

const commonNavItems = [
    { href: '/settings', label: 'Settings', icon: Settings },
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

    // Build nav items based on user role
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

    return (
        <>
            {/* Mobile Bottom Navigation Bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-elevated)] border-t border-[var(--border-light)] px-2 py-2 safe-area-bottom">
                <div className="flex items-center justify-around">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${active
                                    ? 'text-[var(--primary)] bg-[var(--primary-glow)]'
                                    : 'text-[var(--text-muted)]'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[10px] font-semibold">{item.label}</span>
                            </Link>
                        );
                    })}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-[var(--text-muted)]"
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">More</span>
                    </button>
                </div>
            </nav>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 flex-col bg-[var(--bg-elevated)] border-r border-[var(--border-light)] shadow-lg">
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-[var(--border-light)]">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="relative">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--aurora-violet)] to-[var(--aurora-purple)] flex items-center justify-center shadow-lg">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-[var(--aurora-emerald)] to-[var(--aurora-teal)] flex items-center justify-center border-2 border-[var(--bg-elevated)]">
                                    <Zap className="w-2.5 h-2.5 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="font-bold text-lg text-[var(--text-primary)] tracking-tight">ParentGuard</h1>
                                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Admin Panel</p>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        <p className="px-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Navigation</p>
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active
                                        ? 'bg-gradient-to-r from-[var(--aurora-violet)] to-[var(--aurora-purple)] text-white shadow-lg'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--primary-glow)] hover:text-[var(--primary)]'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--border-light)]">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--danger)] hover:bg-[var(--danger-glow)] transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Slide-out Menu Overlay */}
            <div
                className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Mobile Slide-out Menu */}
            <aside
                className={`fixed inset-y-0 right-0 z-[70] w-72 bg-[var(--bg-elevated)] shadow-2xl transform transition-transform lg:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
                        <h2 className="font-bold text-lg">Menu</h2>
                        <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg hover:bg-[var(--bg-subtle)]">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 p-4 space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active
                                        ? 'bg-[var(--primary-glow)] text-[var(--primary)]'
                                        : 'text-[var(--text-secondary)]'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>

                    <div className="p-4 border-t border-[var(--border-light)]">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--danger)] hover:bg-[var(--danger-glow)] transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;
