'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getScreenshots, getPhotos } from '@/lib/api';
import { markSectionViewed } from '@/lib/lastViewed';
import { useAuthStore } from '@/lib/store';
import { format } from 'date-fns';
import {
    Image as ImageIcon,
    Camera,
    Monitor,
    X,
    ChevronLeft,
    ChevronRight,
    Download,
    Maximize2,
    ArrowLeft,
    ZoomIn,
    Grid,
    LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';

export default function GalleryPage() {
    return (
        <Suspense fallback={null}>
            <GalleryContent />
        </Suspense>
    );
}

function GalleryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [screenshots, setScreenshots] = useState<any[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'screenshots' | 'photos'>('screenshots');
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [gridSize, setGridSize] = useState<'small' | 'large'>('small');

    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    const fetchGallery = useCallback(async () => {
        try {
            setLoading(true);
            const [screenshotsData, photosData] = await Promise.all([
                getScreenshots(deviceId, 1, 100),
                getPhotos(deviceId, 1, 100),
            ]);

            if (screenshotsData.success) {
                setScreenshots(screenshotsData.data);
            }
            if (photosData.success) {
                setPhotos(photosData.data);
            }
        } catch (error) {
            console.error('Failed to fetch gallery:', error);
        } finally {
            setLoading(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (isAuthenticated && deviceId) {
            fetchGallery();
        }
    }, [isAuthenticated, deviceId, fetchGallery]);

    // Mark section as viewed to clear unread badge
    useEffect(() => {
        if (deviceId) {
            markSectionViewed(deviceId, 'gallery');
        }
    }, [deviceId]);

    const currentImages = activeTab === 'screenshots' ? screenshots : photos;

    const openLightbox = (image: any, index: number) => {
        setSelectedImage(image);
        setSelectedIndex(index);
    };

    const navigateLightbox = (direction: 'prev' | 'next') => {
        if (!currentImages.length) return;
        let newIndex = selectedIndex;
        if (direction === 'prev') {
            newIndex = selectedIndex > 0 ? selectedIndex - 1 : currentImages.length - 1;
        } else {
            newIndex = selectedIndex < currentImages.length - 1 ? selectedIndex + 1 : 0;
        }
        setSelectedIndex(newIndex);
        setSelectedImage(currentImages[newIndex]);
    };

    // Keyboard navigation for lightbox
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedImage) return;
            if (e.key === 'ArrowLeft') navigateLightbox('prev');
            if (e.key === 'ArrowRight') navigateLightbox('next');
            if (e.key === 'Escape') setSelectedImage(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImage, selectedIndex, currentImages]);

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="Gallery"
                    subtitle={`${screenshots.length + photos.length} visuals captured`}
                    onRefresh={fetchGallery}
                />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
                    {/* Header Actions */}
                    <div className="flex flex-col gap-4 mb-6">
                        <Link
                            href={`/devices/view/?id=${deviceId}`}
                            className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium w-fit group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center group-hover:bg-[var(--primary-glow)] transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                            </div>
                            Back to Device
                        </Link>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Tab Switcher */}
                            <div className="flex p-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-light)] shadow-sm">
                                <button
                                    onClick={() => setActiveTab('screenshots')}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab === 'screenshots'
                                        ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <Monitor className="w-4 h-4" />
                                    <span className="hidden sm:inline">Screenshots</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{screenshots.length}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('photos')}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab === 'photos'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <Camera className="w-4 h-4" />
                                    <span className="hidden sm:inline">Photos</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{photos.length}</span>
                                </button>
                            </div>

                            {/* Grid Size Toggle */}
                            <div className="flex items-center gap-2 p-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-light)]">
                                <button
                                    onClick={() => setGridSize('small')}
                                    className={`p-2 rounded-lg transition-all ${gridSize === 'small' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                                    title="Small Grid"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setGridSize('large')}
                                    className={`p-2 rounded-lg transition-all ${gridSize === 'large' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                                    title="Large Grid"
                                >
                                    <Grid className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Gallery Grid */}
                    {loading ? (
                        <div className={`grid gap-3 lg:gap-4 ${gridSize === 'small'
                            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                                <div key={i} className="aspect-square card skeleton rounded-2xl" />
                            ))}
                        </div>
                    ) : currentImages.length === 0 ? (
                        <div className="card bg-[var(--bg-elevated)] empty-state py-16">
                            <div className="empty-state-icon">
                                <ImageIcon className="w-12 h-12" />
                            </div>
                            <h3 className="empty-state-title">No {activeTab === 'screenshots' ? 'Screenshots' : 'Photos'} Found</h3>
                            <p className="empty-state-description">
                                The {activeTab} gallery is currently empty for this device.
                            </p>
                        </div>
                    ) : (
                        <div className={`grid gap-3 lg:gap-4 ${gridSize === 'small'
                            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                            {currentImages.map((image, index) => (
                                <div
                                    key={image.id}
                                    className="group relative aspect-square card bg-[var(--bg-elevated)] p-0 overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                                    onClick={() => openLightbox(image, index)}
                                >
                                    <img
                                        src={image.url}
                                        alt="Gallery Capture"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                                        <div className="flex justify-end">
                                            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                                <ZoomIn className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-white text-xs font-bold">
                                                {format(new Date(image.timestamp), 'MMM d, HH:mm')}
                                            </p>
                                            {image.camera && (
                                                <p className="text-white/70 text-[10px] font-medium mt-0.5">
                                                    {image.camera} Camera
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {/* Index Badge */}
                                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-white">
                                        {index + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Lightbox Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-12 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    {/* Navigation Arrows */}
                    <button
                        onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
                        className="absolute left-2 sm:left-4 lg:left-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all z-20"
                    >
                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
                        className="absolute right-2 sm:right-4 lg:right-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all z-20"
                    >
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Top Bar */}
                    <div className="absolute top-2 sm:top-4 lg:top-8 left-2 sm:left-4 lg:left-8 right-2 sm:right-4 lg:right-8 flex items-center justify-between z-20">
                        {/* Counter */}
                        <div className="px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold">
                            {selectedIndex + 1} / {currentImages.length}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 sm:gap-3">
                            <a
                                href={selectedImage.url}
                                download
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                            </a>
                            <button
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 hover:bg-red-500/80 border border-white/20 flex items-center justify-center text-white transition-all"
                                onClick={() => setSelectedImage(null)}
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Image */}
                    <div
                        className="max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4 pt-16 pb-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900 max-h-[calc(100vh-12rem)]">
                            <img
                                src={selectedImage.url}
                                alt="Gallery Preview"
                                className="max-w-full max-h-[calc(100vh-14rem)] object-contain mx-auto"
                            />
                        </div>

                        {/* Metadata */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-6 border border-white/20">
                            <div className="text-center sm:text-left">
                                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Captured</span>
                                <p className="text-white font-bold text-sm sm:text-base">
                                    {format(new Date(selectedImage.timestamp), 'MMMM d, yyyy • HH:mm:ss')}
                                </p>
                            </div>
                            {selectedImage.camera && (
                                <>
                                    <div className="hidden sm:block w-px h-8 bg-white/20"></div>
                                    <div className="flex items-center gap-2 text-white/80">
                                        <Camera className="w-4 h-4" />
                                        <span className="text-sm font-medium">{selectedImage.camera} Camera</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
