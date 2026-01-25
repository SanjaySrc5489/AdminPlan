'use client';

import { useAuthStore } from '@/lib/store';
import { Shield, AlertCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SessionTimeoutModal() {
    const router = useRouter();
    const { showSessionTimeout, setShowSessionTimeout, logout } = useAuthStore();

    if (!showSessionTimeout) return null;

    const handleLoginAgain = () => {
        setShowSessionTimeout(false);
        logout();
        router.push('/login?reason=expired');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 lg:p-10 border border-slate-200 shadow-2xl animate-scale-up">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-50 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Session Expired</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                        Your secure session has ended for your protection. Please login again to regain access to the control panel.
                    </p>

                    <button
                        onClick={handleLoginAgain}
                        className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 transition-all hover:-translate-y-1 shadow-xl shadow-slate-900/10 active:scale-95 flex items-center justify-center gap-3"
                    >
                        <LogOut className="w-5 h-5" />
                        Login Again
                    </button>

                    <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4 text-violet-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ParentGuard Security</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-up {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-scale-up { animation: scale-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
}
