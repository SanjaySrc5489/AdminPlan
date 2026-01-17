'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store';
import { connectSocket } from '@/lib/socket';
import { dispatchCommand } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import {
    Folder,
    File,
    Image,
    Video,
    Music,
    FileText,
    Archive,
    Code,
    Package,
    Download,
    ChevronRight,
    Home,
    HardDrive,
    ArrowLeft,
    Loader2,
    FolderOpen,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    History,
    X,
    Trash2,
} from 'lucide-react';
import Link from 'next/link';

export default function FilesPage() {
    return (
        <Suspense fallback={null}>
            <FilesContent />
        </Suspense>
    );
}

interface FileItem {
    name: string;
    path: string;
    isDirectory: boolean;
    isRoot?: boolean;
    isShortcut?: boolean;
    size: number;
    lastModified: number;
    mimeType?: string;
    extension?: string;
    readable?: boolean;
    writable?: boolean;
}

interface DownloadItem {
    id: string;
    fileName: string;
    filePath: string;
    size: number;
    status: 'pending' | 'downloading' | 'success' | 'failed';
    downloadUrl?: string;
    error?: string;
    startedAt: number;
    completedAt?: number;
}

function FilesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deviceId = searchParams.get('id') as string;
    const { isAuthenticated, isHydrated } = useAuthStore();

    const [files, setFiles] = useState<FileItem[]>([]);
    const [currentPath, setCurrentPath] = useState('/');
    const [parentPath, setParentPath] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination - show 10 files at a time
    const [displayLimit, setDisplayLimit] = useState(10);

    // Download management - persisted to localStorage
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [currentDownload, setCurrentDownload] = useState<string | null>(null);
    const [showDownloads, setShowDownloads] = useState(false);

    // Load downloads from localStorage on mount
    useEffect(() => {
        if (!deviceId) return;
        const storageKey = `fileDownloads_${deviceId}`;
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as DownloadItem[];
                // Reset any stuck 'downloading' status to 'failed'
                const fixed = parsed.map(d =>
                    d.status === 'downloading' || d.status === 'pending'
                        ? { ...d, status: 'failed' as const, error: 'Interrupted' }
                        : d
                );
                setDownloads(fixed);
            }
        } catch (e) {
            console.error('Failed to load downloads from localStorage:', e);
        }
    }, [deviceId]);

    // Save downloads to localStorage whenever they change
    useEffect(() => {
        if (!deviceId || downloads.length === 0) return;
        const storageKey = `fileDownloads_${deviceId}`;
        try {
            // Only keep last 50 downloads to prevent localStorage bloat
            const toSave = downloads.slice(0, 50);
            localStorage.setItem(storageKey, JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save downloads to localStorage:', e);
        }
    }, [downloads, deviceId]);

    useEffect(() => {
        if (isHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [isHydrated, isAuthenticated, router]);

    // Browse files via socket command
    const browseFiles = useCallback(async (path: string = '/') => {
        if (!deviceId) return;

        setLoading(true);
        setError(null);

        try {
            await dispatchCommand(deviceId, 'browse_files', { path });
        } catch (err: any) {
            setError(err.message || 'Failed to browse files');
            setLoading(false);
        }
    }, [deviceId]);

    // Listen for file listing responses
    useEffect(() => {
        if (!isAuthenticated || !deviceId) return;

        const socket = connectSocket();

        const handleFilesList = (data: any) => {
            if (data.deviceId !== deviceId) return;

            try {
                const fileList = typeof data.files === 'string'
                    ? JSON.parse(data.files)
                    : data.files;

                setFiles(fileList || []);
                setCurrentPath(data.path || '/');
                setParentPath(data.parentPath || null);
                setDisplayLimit(10); // Reset pagination when folder changes
                setLoading(false);
                setError(null);
            } catch (e) {
                console.error('Failed to parse file list:', e);
                setError('Failed to parse file list');
                setLoading(false);
            }
        };

        // Handle download ready - file is on server, ready to download
        const handleDownloadReady = (data: any) => {
            if (data.deviceId !== deviceId) return;

            // Build full download URL with server base
            const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const fullDownloadUrl = data.downloadUrl?.startsWith('http')
                ? data.downloadUrl
                : `${serverUrl}${data.downloadUrl}`;

            console.log('Download ready:', data.fileName, '->', fullDownloadUrl);

            // Update download status
            setDownloads(prev => prev.map(d =>
                d.filePath === data.filePath
                    ? {
                        ...d,
                        status: 'success' as const,
                        downloadUrl: fullDownloadUrl,
                        completedAt: Date.now()
                    }
                    : d
            ));

            // Trigger browser download
            const link = document.createElement('a');
            link.href = fullDownloadUrl;
            link.download = data.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clear current download to allow next
            setCurrentDownload(null);
        };

        socket.on('files:list', handleFilesList);
        socket.on('files:download_ready', handleDownloadReady);

        // Initial browse
        browseFiles('/');

        return () => {
            socket.off('files:list', handleFilesList);
            socket.off('files:download_ready', handleDownloadReady);
        };
    }, [isAuthenticated, deviceId, browseFiles]);

    // Process download queue
    useEffect(() => {
        if (currentDownload) return; // Already downloading something

        const pendingDownload = downloads.find(d => d.status === 'pending');
        if (!pendingDownload) return;

        // Start downloading
        setCurrentDownload(pendingDownload.filePath);
        setDownloads(prev => prev.map(d =>
            d.id === pendingDownload.id
                ? { ...d, status: 'downloading' as const }
                : d
        ));

        // Dispatch command
        dispatchCommand(deviceId, 'download_file', { path: pendingDownload.filePath })
            .catch((err) => {
                setDownloads(prev => prev.map(d =>
                    d.id === pendingDownload.id
                        ? { ...d, status: 'failed' as const, error: err.message, completedAt: Date.now() }
                        : d
                ));
                setCurrentDownload(null);
            });
    }, [downloads, currentDownload, deviceId]);

    // Timeout for stuck downloads (60 seconds)
    useEffect(() => {
        if (!currentDownload) return;

        const timeout = setTimeout(() => {
            setDownloads(prev => prev.map(d =>
                d.filePath === currentDownload && d.status === 'downloading'
                    ? { ...d, status: 'failed' as const, error: 'Download timed out', completedAt: Date.now() }
                    : d
            ));
            setCurrentDownload(null);
        }, 60000);

        return () => clearTimeout(timeout);
    }, [currentDownload]);

    const handleNavigate = (file: FileItem) => {
        if (file.isDirectory) {
            browseFiles(file.path);
        }
    };

    const handleGoBack = () => {
        if (parentPath) {
            browseFiles(parentPath);
        } else if (currentPath !== '/') {
            browseFiles('/');
        }
    };

    const handleDownload = (file: FileItem) => {
        if (!deviceId || file.isDirectory) return;

        // Check if already in queue or downloading
        const existing = downloads.find(d => d.filePath === file.path && (d.status === 'pending' || d.status === 'downloading'));
        if (existing) return;

        // Add to download queue
        const newDownload: DownloadItem = {
            id: `${Date.now()}-${file.path}`,
            fileName: file.name,
            filePath: file.path,
            size: file.size,
            status: 'pending',
            startedAt: Date.now()
        };

        setDownloads(prev => [newDownload, ...prev]);
        setShowDownloads(true);
    };

    const clearDownload = (id: string) => {
        setDownloads(prev => prev.filter(d => d.id !== id));
    };

    const clearAllCompleted = () => {
        setDownloads(prev => prev.filter(d => d.status === 'pending' || d.status === 'downloading'));
    };

    const retryDownload = (download: DownloadItem) => {
        setDownloads(prev => prev.map(d =>
            d.id === download.id
                ? { ...d, status: 'pending' as const, error: undefined, completedAt: undefined, startedAt: Date.now() }
                : d
        ));
    };

    const getFileIcon = (file: FileItem) => {
        if (file.isDirectory) {
            if (file.isRoot) return HardDrive;
            return Folder;
        }

        const ext = file.extension?.toLowerCase() || '';
        const mime = file.mimeType?.toLowerCase() || '';

        if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
            return Image;
        }
        if (mime.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
            return Video;
        }
        if (mime.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
            return Music;
        }
        if (mime.startsWith('text/') || ['txt', 'md', 'log', 'csv'].includes(ext)) {
            return FileText;
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return Archive;
        }
        if (['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'xml'].includes(ext)) {
            return Code;
        }
        if (ext === 'apk') {
            return Package;
        }

        return File;
    };

    const getFileIconColor = (file: FileItem) => {
        if (file.isDirectory) {
            if (file.isRoot) return 'from-indigo-500 to-purple-500';
            if (file.isShortcut) return 'from-amber-500 to-orange-500';
            return 'from-blue-500 to-cyan-500';
        }

        const ext = file.extension?.toLowerCase() || '';
        const mime = file.mimeType?.toLowerCase() || '';

        if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return 'from-pink-500 to-rose-500';
        }
        if (mime.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
            return 'from-red-500 to-orange-500';
        }
        if (mime.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac'].includes(ext)) {
            return 'from-purple-500 to-pink-500';
        }
        if (ext === 'apk') {
            return 'from-emerald-500 to-green-500';
        }
        if (['zip', 'rar', '7z'].includes(ext)) {
            return 'from-yellow-500 to-amber-500';
        }

        return 'from-slate-500 to-gray-500';
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const getBreadcrumbs = () => {
        if (currentPath === '/') return [{ name: 'Storage', path: '/' }];

        const parts = currentPath.split('/').filter(Boolean);
        const crumbs = [{ name: 'Storage', path: '/' }];

        let accumulated = '';
        for (const part of parts) {
            accumulated += '/' + part;
            crumbs.push({ name: part, path: accumulated });
        }

        return crumbs;
    };

    const isFileDownloading = (filePath: string) => {
        return downloads.some(d => d.filePath === filePath && (d.status === 'pending' || d.status === 'downloading'));
    };

    const pendingCount = downloads.filter(d => d.status === 'pending' || d.status === 'downloading').length;

    if (!isHydrated || !isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-base)] pb-20 lg:pb-0">
            <Sidebar />
            <main className="lg:ml-72">
                <Header
                    title="File Manager"
                    subtitle={`${files.length} items`}
                    onRefresh={() => browseFiles(currentPath)}
                />

                <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
                    {/* Top Bar with Back and Downloads */}
                    <div className="flex items-center justify-between mb-6">
                        <Link
                            href={`/devices/view/?id=${deviceId}`}
                            className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors text-sm font-medium group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center group-hover:bg-[var(--primary-glow)] transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                            </div>
                            Back to Device
                        </Link>

                        {/* Downloads Button */}
                        <button
                            onClick={() => setShowDownloads(!showDownloads)}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${showDownloads
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                                }`}
                        >
                            <History className="w-4 h-4" />
                            Downloads
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Downloads Panel */}
                    {showDownloads && (
                        <div className="card bg-[var(--bg-elevated)] p-4 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                    <Download className="w-5 h-5" />
                                    Downloads ({downloads.length})
                                </h3>
                                {downloads.some(d => d.status === 'success' || d.status === 'failed') && (
                                    <button
                                        onClick={clearAllCompleted}
                                        className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                                    >
                                        Clear completed
                                    </button>
                                )}
                            </div>

                            {downloads.length === 0 ? (
                                <div className="text-center py-8 text-[var(--text-muted)]">
                                    <Download className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No downloads yet</p>
                                    <p className="text-sm">Click the download button on any file to start</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {downloads.map((download) => (
                                        <div
                                            key={download.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${download.status === 'downloading'
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                                : download.status === 'success'
                                                    ? 'bg-green-50 dark:bg-green-900/20'
                                                    : download.status === 'failed'
                                                        ? 'bg-red-50 dark:bg-red-900/20'
                                                        : 'bg-[var(--bg-subtle)]'
                                                }`}
                                        >
                                            {/* Status Icon */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${download.status === 'downloading' || download.status === 'pending'
                                                ? 'bg-blue-100 dark:bg-blue-800'
                                                : download.status === 'success'
                                                    ? 'bg-green-100 dark:bg-green-800'
                                                    : 'bg-red-100 dark:bg-red-800'
                                                }`}>
                                                {download.status === 'downloading' && (
                                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                                )}
                                                {download.status === 'pending' && (
                                                    <Clock className="w-5 h-5 text-blue-600" />
                                                )}
                                                {download.status === 'success' && (
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                )}
                                                {download.status === 'failed' && (
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                )}
                                            </div>

                                            {/* File Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                                                    {download.fileName}
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] truncate">
                                                    {formatFileSize(download.size)}
                                                    {download.status === 'downloading' && ' • Downloading...'}
                                                    {download.status === 'pending' && ' • Waiting in queue...'}
                                                    {download.status === 'success' && download.completedAt &&
                                                        ` • Completed ${formatDistanceToNow(download.completedAt, { addSuffix: true })}`}
                                                    {download.status === 'failed' && download.error &&
                                                        ` • ${download.error}`}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {download.status === 'failed' && (
                                                    <button
                                                        onClick={() => retryDownload(download)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 transition-colors"
                                                        title="Retry"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                        Retry
                                                    </button>
                                                )}
                                                {download.status === 'success' && download.downloadUrl && (
                                                    <a
                                                        href={download.downloadUrl}
                                                        download={download.fileName}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                                                        title="Download to your device"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Save
                                                    </a>
                                                )}
                                                {download.status === 'success' && !download.downloadUrl && (
                                                    <button
                                                        onClick={() => retryDownload(download)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium hover:bg-amber-200 transition-colors"
                                                        title="Re-download from device"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                        Re-fetch
                                                    </button>
                                                )}
                                                {(download.status === 'success' || download.status === 'failed') && (
                                                    <button
                                                        onClick={() => clearDownload(download.id)}
                                                        className="w-8 h-8 rounded-lg bg-[var(--bg-base)] flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                                                        title="Remove"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Breadcrumbs */}
                    <div className="card bg-[var(--bg-elevated)] p-4 mb-6">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {getBreadcrumbs().map((crumb, i) => (
                                <div key={crumb.path} className="flex items-center gap-2 flex-shrink-0">
                                    {i > 0 && <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
                                    <button
                                        onClick={() => browseFiles(crumb.path)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${crumb.path === currentPath
                                            ? 'bg-[var(--primary)] text-white font-semibold'
                                            : 'text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-subtle)]'
                                            }`}
                                    >
                                        {i === 0 && <Home className="w-4 h-4" />}
                                        <span className="text-sm">{crumb.name}</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="card bg-red-50 border-red-200 p-6 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-red-700">Error</h3>
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                                <button
                                    onClick={() => browseFiles(currentPath)}
                                    className="ml-auto btn btn-secondary"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                                <div key={i} className="card bg-[var(--bg-elevated)] p-4 h-32 skeleton" />
                            ))}
                        </div>
                    ) : files.length === 0 ? (
                        <div className="card bg-[var(--bg-elevated)] empty-state py-16">
                            <div className="empty-state-icon">
                                <FolderOpen className="w-12 h-12" />
                            </div>
                            <h3 className="empty-state-title">Empty Folder</h3>
                            <p className="empty-state-description">This directory is empty.</p>
                            {currentPath !== '/' && (
                                <button
                                    onClick={handleGoBack}
                                    className="btn btn-primary mt-4"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Go Back
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {/* Go Up Item */}
                                {currentPath !== '/' && parentPath && (
                                    <button
                                        onClick={handleGoBack}
                                        className="card bg-[var(--bg-elevated)] p-4 flex flex-col items-center gap-3 text-center group hover:shadow-lg transition-all"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <ArrowLeft className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="font-semibold text-sm text-[var(--text-primary)] truncate w-full">..</span>
                                        <span className="text-xs text-[var(--text-muted)]">Go up</span>
                                    </button>
                                )}

                                {/* File Items - paginated */}
                                {files.slice(0, displayLimit).map((file) => {
                                    const Icon = getFileIcon(file);
                                    const isDownloading = isFileDownloading(file.path);

                                    return (
                                        <div
                                            key={file.path}
                                            className="card bg-[var(--bg-elevated)] p-4 flex flex-col items-center gap-3 text-center group hover:shadow-lg transition-all relative"
                                        >
                                            {/* Click target for navigation */}
                                            <button
                                                onClick={() => handleNavigate(file)}
                                                disabled={!file.isDirectory}
                                                className="w-full flex flex-col items-center gap-3 cursor-pointer disabled:cursor-default"
                                            >
                                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getFileIconColor(file)} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                                    <Icon className="w-6 h-6 text-white" />
                                                </div>
                                                <div className="w-full">
                                                    <span className="font-semibold text-sm text-[var(--text-primary)] truncate block" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-muted)]">
                                                        {file.isDirectory ? 'Folder' : formatFileSize(file.size)}
                                                    </span>
                                                </div>
                                            </button>

                                            {/* Download button for files */}
                                            {!file.isDirectory && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isDownloading) handleDownload(file);
                                                    }}
                                                    disabled={isDownloading}
                                                    className={`absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDownloading
                                                            ? 'bg-blue-100 text-blue-600'
                                                            : 'bg-[var(--bg-subtle)] hover:bg-[var(--primary)] hover:text-white text-[var(--text-muted)]'
                                                        }`}
                                                    title={isDownloading ? 'Downloading...' : 'Download'}
                                                >
                                                    {isDownloading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Download className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Load More Button */}
                            {files.length > displayLimit && (
                                <div className="text-center mt-6">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 10)}
                                        className="btn btn-secondary px-6 py-3 font-medium"
                                    >
                                        Load More ({displayLimit} of {files.length} shown)
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
