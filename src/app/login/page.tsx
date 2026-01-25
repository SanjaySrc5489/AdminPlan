'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Shield, User, Lock, AlertCircle, Loader2, Sparkles, Zap, Eye, EyeOff,
    Clock, CheckCircle, ArrowRight, Smartphone, Activity, Radio, Mic,
    MessageCircle, FileText, MapPin, ChevronDown, Menu, X, Users, Heart, Gavel,
    Camera, ChevronRight, Bell, Wifi
} from 'lucide-react';
import { login as apiLogin } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();
    const { login, isAuthenticated, isHydrated } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const loginRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const reason = searchParams.get('reason');

    useEffect(() => {
        if (reason === 'expired') {
            setError('Your session has expired. Please login again to continue.');
        } else if (reason === 'conflict') {
            setError('Account logged in from another location. Access revoked.');
        }
    }, [reason]);

    useEffect(() => {
        if (isHydrated && isAuthenticated) {
            router.push('/');
        }
    }, [isHydrated, isAuthenticated, router]);

    const scrollToLogin = () => {
        loginRef.current?.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await apiLogin(username, password);
            if (data.success) {
                login(
                    data.token,
                    data.refreshToken,
                    data.user,
                    data.signatureSecret
                );
                router.push('/');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message || 'Connection failed';
            if (errorMessage.includes('expired')) {
                setError('Your account has expired. Please contact the administrator.');
            } else if (errorMessage.includes('disabled')) {
                setError('Your account has been disabled. Please contact the administrator.');
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { icon: Smartphone, title: 'Live Stream', desc: 'Real-time camera & screen feed with low latency.', color: 'emerald' },
        { icon: Mic, title: 'Silent Audio', desc: 'Monitor surroundings with high-quality audio streaming.', color: 'violet' },
        { icon: MessageCircle, title: 'Social Sync', desc: 'Track SMS, WhatsApp, and social media activities.', color: 'blue' },
        { icon: MapPin, title: 'GPS History', desc: 'Precision location tracking with historical path maps.', color: 'orange' },
        { icon: FileText, title: 'Call Intelligence', desc: 'Detailed call logs with duration and contact info.', color: 'pink' },
        { icon: Shield, title: 'App Control', desc: 'View installed apps and manage device permissions.', color: 'cyan' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-violet-100 selection:text-violet-600">
            {/* ✨ Premium Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 lg:h-20">
                        {/* Logo */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">ParentGuard</span>
                                <div className="text-[10px] uppercase tracking-widest text-violet-600 font-bold -mt-1 underline decoration-violet-300 underline-offset-2">Enterprise</div>
                            </div>
                        </div>

                        {/* Desktop Links */}
                        <div className="hidden lg:flex items-center gap-10">
                            {['Features', 'Privacy', 'Legal'].map((item) => (
                                <button
                                    key={item}
                                    onClick={() => document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-sm font-semibold text-slate-600 hover:text-violet-600 transition-colors"
                                >
                                    {item}
                                </button>
                            ))}
                            <button
                                onClick={scrollToLogin}
                                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                            >
                                Login Panel
                            </button>
                        </div>

                        {/* Mobile Toggle */}
                        <button className="lg:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="lg:hidden bg-white border-b border-slate-100 animate-slide-down">
                        <div className="px-4 pt-2 pb-6 space-y-1">
                            {['Features', 'Privacy', 'Legal'].map((item) => (
                                <button
                                    key={item}
                                    onClick={() => document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })}
                                    className="block w-full text-left px-4 py-3 text-base font-semibold text-slate-600"
                                >
                                    {item}
                                </button>
                            ))}
                            <button
                                onClick={scrollToLogin}
                                className="w-full mt-4 bg-violet-600 text-white py-4 rounded-2xl font-bold"
                            >
                                Access Control Panel
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* 🚀 Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-200/30 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-200/20 rounded-full blur-3xl" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-100 text-violet-600 font-bold text-xs uppercase tracking-widest mb-8 animate-fade-in shadow-sm">
                        <Sparkles className="w-4 h-4" />
                        Next-Gen Monitoring System
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-black text-slate-900 mb-6 tracking-tight animate-fade-in">
                        Protect Your Family <br />
                        <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">In Real-Time</span>
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed font-medium animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        Advanced parental guard and device tracking platform designed for the safety of your loved ones. Premium monitoring with bank-grade security.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <button onClick={scrollToLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 transition-all hover:-translate-y-1 shadow-2xl shadow-slate-900/20 active:scale-[0.98]">
                            Go to Console
                        </button>
                        <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-lg hover:border-violet-500 hover:text-violet-600 transition-all shadow-sm">
                            Explore Features
                        </button>
                    </div>

                    {/* Dashboard Preview Mockup - LIVE DYNAMIC VERSION */}
                    <div className="mt-20 relative px-4 lg:px-0 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="relative mx-auto max-w-5xl rounded-[2.5rem] bg-white p-2 shadow-2xl border border-slate-200 overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 pointer-events-none" />
                            <div className="bg-slate-50 rounded-[2rem] overflow-hidden flex flex-col relative min-h-[500px]">
                                {/* Mock Header */}
                                <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                                            <Shield className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-900 leading-none">ParentGuard</span>
                                            <span className="text-[6px] font-black text-violet-600 uppercase tracking-tighter">Enterprise</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                                            <Bell className="w-4 h-4" />
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                                            <User className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-1 overflow-hidden">
                                    {/* Mock Sidebar */}
                                    <div className="w-20 lg:w-64 bg-white border-r border-slate-200 p-4 space-y-4 hidden sm:block">
                                        <div className="h-10 bg-violet-50 rounded-xl border border-violet-100 flex items-center gap-3 px-3">
                                            <Activity className="w-5 h-5 text-violet-600" />
                                            <div className="h-3 w-20 bg-violet-200 rounded-full hidden lg:block" />
                                        </div>
                                        {[Smartphone, MapPin, MessageCircle, FileText, Camera, Shield].map((Icon, i) => (
                                            <div key={i} className="h-10 hover:bg-slate-50 rounded-xl flex items-center gap-3 px-3 transition-colors">
                                                <Icon className="w-5 h-5 text-slate-400" />
                                                <div className="h-3 w-24 bg-slate-100 rounded-full hidden lg:block" />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Mock Main Content */}
                                    <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-hidden">
                                        {/* Mock Stats */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            {[
                                                { label: 'Devices', val: '12', color: 'violet', icon: Smartphone },
                                                { label: 'Online', val: '08', color: 'emerald', icon: Wifi },
                                                { label: 'Alerts', val: '24', color: 'orange', icon: Bell },
                                                { label: 'Logs', val: '1.2k', color: 'blue', icon: FileText }
                                            ].map((s, i) => (
                                                <div key={i} className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                                                    <div className={`w-8 h-8 rounded-lg bg-${s.color}-500/10 flex items-center justify-center mb-2`}>
                                                        <s.icon className={`w-4 h-4 text-${s.color}-600`} />
                                                    </div>
                                                    <div className="text-xl font-bold text-slate-900">{s.val}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Mock Device List */}
                                        <div className="space-y-3">
                                            {[
                                                { name: 'Samsung S24 Ultra', status: 'Online', battery: '82%', time: 'Now' },
                                                { name: 'iPhone 15 Pro', status: 'Online', battery: '45%', time: '2m ago' },
                                                { name: 'Pixel 8 Pro', status: 'Offline', battery: '12%', time: '1h ago' }
                                            ].map((dev, i) => (
                                                <div key={i} className={`bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 transition-all hover:scale-[1.01] hover:shadow-md ${i === 0 ? 'ring-2 ring-violet-500/20 bg-violet-50/10' : ''}`}>
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dev.status === 'Online' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Smartphone className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-slate-900 text-sm">{dev.name}</div>
                                                            {dev.status === 'Online' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                                        </div>
                                                        <div className="text-xs text-slate-400 font-medium">Last seen: {dev.time}</div>
                                                    </div>
                                                    <div className="hidden sm:flex items-center gap-4 lg:gap-8 px-4 border-l border-slate-100 ml-4">
                                                        <div className="text-center">
                                                            <div className="text-xs font-bold text-slate-700">{dev.battery}</div>
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Battery</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-xs font-bold text-slate-700">{i * 12 + 42}</div>
                                                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Logs</div>
                                                        </div>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                                        <ChevronRight className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Floating Notification Snippet */}
                                        <div className="absolute bottom-10 right-10 w-64 bg-slate-900 rounded-2xl p-4 shadow-2xl animate-float border border-white/10 hidden lg:block">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                                                    <Zap className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="text-white text-xs font-bold">New Security Alert</div>
                                            </div>
                                            <p className="text-slate-400 text-[10px] font-medium italic">Unusual activity detected on "Samsung S24". Precision GPS lock engaged.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 py-4 lg:py-6 text-center bg-white/90 backdrop-blur-sm border-t border-slate-100">
                                <p className="text-slate-900 font-black text-[10px] lg:text-sm uppercase tracking-[0.1em] lg:tracking-widest flex items-center justify-center gap-2 lg:gap-3">
                                    <span className="relative flex h-2.5 w-2.5 lg:h-3 lg:w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 lg:h-3 lg:w-3 bg-emerald-500"></span>
                                    </span>
                                    Live Interactive Dashboard Preview
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 🛠️ Features Grid */}
            <section id="features" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-xs uppercase tracking-[0.2em] font-black text-violet-600 mb-4 px-4 py-2 border border-violet-100 rounded-lg inline-block">Features Overflow</h2>
                        <h3 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">Complete Visibility & Control</h3>
                        <p className="text-lg text-slate-500 font-medium">Every tool you need to ensure digital safety, packed into one single enterprise dashboard.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((f, i) => (
                            <div key={i} className="group p-8 rounded-[2rem] bg-white border border-slate-100 hover:border-violet-100 hover:shadow-2xl hover:shadow-violet-500/5 transition-all duration-500 flex flex-col items-center text-center">
                                <div className={`w-16 h-16 rounded-2xl bg-${f.color}-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                                    <f.icon className={`w-8 h-8 text-${f.color}-600`} />
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h4>
                                <p className="text-slate-500 font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ⚖️ Legal & Privacy Section */}
            <section id="privacy" className="py-24 bg-slate-50 overflow-hidden relative">
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="lg:flex items-stretch gap-12">
                        {/* Policy Side */}
                        <div className="lg:w-1/2 space-y-8">
                            <div id="legal">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold uppercase mb-4">
                                    <Shield className="w-3 h-3" />
                                    Security First
                                </div>
                                <h3 className="text-4xl font-bold text-slate-900 mb-6">Built for Ethical <br /> Monitoring</h3>
                                <div className="space-y-6">
                                    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-900 mb-1">Strict Privacy & Encryption</h5>
                                                <p className="text-sm text-slate-500 leading-relaxed font-medium">All monitored data, including live streams and recordings, is protected by military-grade AES-256 encryption. We implement a zero-knowledge architecture where only you hold the keys to view your family's data.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                                                <Gavel className="w-5 h-5 text-orange-600" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-900 mb-1">Fair Use & Ethical Compliance</h5>
                                                <p className="text-sm text-slate-500 leading-relaxed font-medium">ParentGuard operations adhere to strict "Fair Use" guidelines for child safety and elder care. Use of this software for non-consensual surveillance is a violation of our Terms of Service and may be illegal in your jurisdiction.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                                                <Shield className="w-5 h-5 text-violet-600" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-900 mb-1">GDPR & COPPA Ready</h5>
                                                <p className="text-sm text-slate-500 leading-relaxed font-medium">Our platform is designed with global safety standards in mind, ensuring that children's digital footprints are handled with the highest level of care and regulatory compliance.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Legal Card */}
                        <div className="lg:w-1/2 mt-12 lg:mt-0">
                            <div className="h-full rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-slate-800 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px]" />
                                <div>
                                    <h4 className="text-3xl font-bold mb-6">Terms & Safety</h4>
                                    <div className="space-y-4 mb-10">
                                        <p className="text-slate-400 font-medium">To maintain a safe environment, users must agree to:</p>
                                        <ul className="space-y-3">
                                            {['Legal consent of the device owner', 'Compliance with local tracking laws', 'Notification of monitoring where required', 'Secure storage of admin credentials'].map((item, i) => (
                                                <li key={i} className="flex items-center gap-3 text-sm font-semibold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <div className="pt-8 border-t border-white/10 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-violet-400" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-300">Used by 50,000+ responsible guardians worldwide.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 🔐 Login Section */}
            <section ref={loginRef} className="py-24 bg-white relative">
                <div className="max-w-xl mx-auto px-4">
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-purple-500/20">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Access Control</h2>
                        <p className="text-slate-500 font-bold">Authorized Personnel Only</p>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 border border-slate-200 shadow-2xl shadow-slate-200/50">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 animate-shake">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm font-bold">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Admin Username</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-violet-50 transition-colors">
                                        <User className="w-5 h-5 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter username"
                                        className="w-full pl-16 pr-4 py-4.5 rounded-2xl border border-slate-200 text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/5 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-3">Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-violet-50 transition-colors">
                                        <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="w-full pl-16 pr-14 py-4.5 rounded-2xl border border-slate-200 text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/5 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5 text-slate-400" /> : <Eye className="w-5 h-5 text-slate-400" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-16 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black text-lg shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 hover:-translate-y-1 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                                        Verifying Credentials...
                                    </>
                                ) : (
                                    <>
                                        Sign In To Panel
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            {/* 💬 Footer */}
            <footer className="py-20 bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="lg:flex justify-between items-start border-b border-white/5 pb-16">
                        <div className="max-w-xs mb-12 lg:mb-0">
                            <div className="flex items-center gap-3 mb-6">
                                <Shield className="w-8 h-8 text-violet-400" />
                                <span className="text-2xl font-bold tracking-tight">ParentGuard</span>
                            </div>
                            <p className="text-slate-400 font-medium leading-relaxed">
                                Redefining digital parenting with real-time intelligence and ethical monitoring tools.
                            </p>
                            <div className="flex gap-4 mt-8">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5" />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-12 text-sm">
                            <div>
                                <h6 className="font-bold uppercase tracking-widest text-slate-500 mb-6">Product</h6>
                                <ul className="space-y-4 font-semibold text-slate-300">
                                    <li><Link href="#" className="hover:text-violet-400 transition-colors">Features</Link></li>
                                    <li><Link href="#" className="hover:text-violet-400 transition-colors">Admin Panel</Link></li>
                                    <li><Link href="#" className="hover:text-violet-400 transition-colors">Pricing</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h6 className="font-bold uppercase tracking-widest text-slate-500 mb-6">Policies</h6>
                                <ul className="space-y-4 font-semibold text-slate-300">
                                    <li><Link href="#privacy" className="hover:text-violet-400 transition-colors">Privacy Policy</Link></li>
                                    <li><Link href="#legal" className="hover:text-violet-400 transition-colors">Terms of Service</Link></li>
                                    <li><Link href="#" className="hover:text-violet-400 transition-colors">Fair Use</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h6 className="font-bold uppercase tracking-widest text-slate-500 mb-6">Safety</h6>
                                <ul className="space-y-4 font-semibold text-slate-300">
                                    <li className="flex items-center gap-2">
                                        <Heart className="w-4 h-4 text-rose-500" />
                                        Made for families
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-emerald-500" />
                                        AES-256 Encrypted
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="pt-10 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 text-xs font-bold uppercase tracking-widest">
                        <p>© 2024 ParentGuard System. All Rights Reserved.</p>
                        <div className="flex gap-8">
                            <span>Status: Operational</span>
                            <span>Version: 4.2.0-stable</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Styling for animations */}
            <style jsx global>{`
                @keyframes slide-down {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
                .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-shake { animation: shake 0.2s ease-in-out 2; }
            `}</style>
        </div>
    );
}
