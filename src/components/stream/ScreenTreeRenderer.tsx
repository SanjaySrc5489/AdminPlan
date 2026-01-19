'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Screen node data structure from Android accessibility
 */
export interface ScreenNode {
    bounds: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
    text?: string;
    desc?: string;
    hint?: string;
    type: string;
    clickable?: boolean;
    longClickable?: boolean;
    editable?: boolean;
    scrollable?: boolean;
    checkable?: boolean;
    checked?: boolean;
    focused?: boolean;
    selected?: boolean;
    password?: boolean;
    children?: ScreenNode[];
}

export interface ScreenTreeData {
    deviceId: string;
    timestamp: number;
    screenWidth: number;
    screenHeight: number;
    packageName: string;
    nodes: ScreenNode;
}

// Gesture types
export type GestureType = 'tap' | 'longpress' | 'swipe' | 'drag' | 'double_tap' | 'doodle';

export interface GestureEvent {
    type: GestureType;
    // Normalized coordinates (0-1)
    startX: number;
    startY: number;
    endX?: number;
    endY?: number;
    // For swipes
    direction?: 'up' | 'down' | 'left' | 'right';
    // Duration in ms
    duration?: number;
    // For doodle gestures - array of points
    points?: { x: number; y: number }[];
}

interface ScreenTreeRendererProps {
    data: ScreenTreeData | null;
    onGesture?: (gesture: GestureEvent) => void;
    // Legacy support
    onTouch?: (x: number, y: number, type: 'tap' | 'longpress') => void;
    className?: string;
    showDebugInfo?: boolean;
    backgroundImage?: string | null;
    // Doodle mode for pattern unlock
    doodleMode?: boolean;
    // Pattern grid size (3-9, default 3)
    patternGridSize?: number;
}

// Color palette for different node types
const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    'Button': { bg: 'rgba(99, 102, 241, 0.4)', border: '#6366f1', text: '#ffffff' },
    'ImageButton': { bg: 'rgba(99, 102, 241, 0.4)', border: '#6366f1', text: '#ffffff' },
    'EditText': { bg: 'rgba(16, 185, 129, 0.3)', border: '#10b981', text: '#ffffff' },
    'TextView': { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255,255,255,0.2)', text: '#ffffff' },
    'ImageView': { bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.3)', text: '#9ca3af' },
    'CheckBox': { bg: 'rgba(245, 158, 11, 0.3)', border: '#f59e0b', text: '#ffffff' },
    'RadioButton': { bg: 'rgba(245, 158, 11, 0.3)', border: '#f59e0b', text: '#ffffff' },
    'Switch': { bg: 'rgba(59, 130, 246, 0.3)', border: '#3b82f6', text: '#ffffff' },
    'default': { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(156, 163, 175, 0.3)', text: '#d1d5db' },
    'clickable': { bg: 'rgba(99, 102, 241, 0.25)', border: '#6366f1', text: '#a5b4fc' },
};

const LAYOUT_TYPES = ['FrameLayout', 'LinearLayout', 'RelativeLayout', 'ConstraintLayout', 'ViewGroup', 'RecyclerView', 'ScrollView', 'ListView'];

// Gesture detection thresholds
const SWIPE_THRESHOLD = 30; // Minimum pixels to count as swipe
const LONG_PRESS_DURATION = 500; // ms
const DOUBLE_TAP_TIMEOUT = 300; // ms

/**
 * Canvas-based renderer with full gesture support
 */
export default function ScreenTreeRenderer({
    data,
    onGesture,
    onTouch,
    className = '',
    showDebugInfo = false,
    backgroundImage = null,
    doodleMode = false,
    patternGridSize = 3
}: ScreenTreeRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scaleXRef = useRef(1);
    const scaleYRef = useRef(1);
    const [bgImageLoaded, setBgImageLoaded] = useState<HTMLImageElement | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 360, height: 780 });

    // Gesture tracking state
    const mouseDownPos = useRef<{ x: number; y: number; time: number } | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const lastTapTime = useRef<number>(0);
    const isDragging = useRef(false);
    const currentPos = useRef<{ x: number; y: number } | null>(null);
    const [gestureVisual, setGestureVisual] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    // Doodle mode: track all points during gesture
    const doodlePoints = useRef<{ x: number; y: number }[]>([]);
    const [doodlePath, setDoodlePath] = useState<{ x: number; y: number }[]>([]);

    /**
     * Get color scheme for a node
     */
    const getNodeColors = useCallback((node: ScreenNode) => {
        if (node.type && LAYOUT_TYPES.some(t => node.type.includes(t)) && !node.clickable && !node.text && !node.desc) {
            return null;
        }
        if (node.type && NODE_COLORS[node.type]) {
            return NODE_COLORS[node.type];
        }
        if (node.clickable || node.longClickable) {
            return NODE_COLORS['clickable'];
        }
        return NODE_COLORS['default'];
    }, []);

    /**
     * Render a single node
     */
    const renderNode = useCallback((
        ctx: CanvasRenderingContext2D,
        node: ScreenNode,
        scaleX: number,
        scaleY: number,
        depth: number = 0
    ) => {
        if (!node.bounds) return;

        const { bounds, text, desc, hint, type, clickable, editable, checked, focused, password } = node;

        const x = bounds.left * scaleX;
        const y = bounds.top * scaleY;
        const width = (bounds.right - bounds.left) * scaleX;
        const height = (bounds.bottom - bounds.top) * scaleY;

        if (width < 3 || height < 3) {
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    renderNode(ctx, child, scaleX, scaleY, depth + 1);
                }
            }
            return;
        }

        const colors = getNodeColors(node);
        const displayText = text || desc || hint || '';

        if (colors) {
            const hasContent = displayText || clickable || editable || node.checkable;

            if (hasContent && colors.bg !== 'transparent') {
                ctx.fillStyle = colors.bg;
                ctx.fillRect(x, y, width, height);

                if (colors.border !== 'transparent') {
                    ctx.strokeStyle = colors.border;
                    ctx.lineWidth = clickable || editable ? 2 : 1;
                    ctx.strokeRect(x, y, width, height);
                }
            }

            if (focused) {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
            }

            if (node.checkable) {
                const indicatorSize = Math.min(14, height * 0.5);
                const indicatorX = x + 3;
                const indicatorY = y + (height - indicatorSize) / 2;

                ctx.strokeStyle = checked ? '#10b981' : '#6b7280';
                ctx.lineWidth = 2;
                ctx.strokeRect(indicatorX, indicatorY, indicatorSize, indicatorSize);

                if (checked) {
                    ctx.fillStyle = '#10b981';
                    ctx.fillRect(indicatorX + 2, indicatorY + 2, indicatorSize - 4, indicatorSize - 4);
                }
            }

            if (displayText && height > 10) {
                ctx.fillStyle = colors.text;
                const fontSize = Math.min(Math.max(height * 0.4, 10), 14);
                ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

                const maxWidth = width - 8;
                let truncatedText = displayText;
                if (maxWidth > 20 && ctx.measureText(displayText).width > maxWidth) {
                    while (truncatedText.length > 3 && ctx.measureText(truncatedText + '…').width > maxWidth) {
                        truncatedText = truncatedText.slice(0, -1);
                    }
                    truncatedText += '…';
                }

                const textY = y + height / 2 + fontSize / 3;
                const textX = node.checkable ? x + 20 : x + 4;

                if (password && displayText.length > 0) {
                    ctx.fillText('•'.repeat(Math.min(displayText.length, 12)), textX, textY);
                } else if (maxWidth > 15) {
                    ctx.fillText(truncatedText, textX, textY);
                }
            }
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                renderNode(ctx, child, scaleX, scaleY, depth + 1);
            }
        }
    }, [getNodeColors]);

    /**
     * Update canvas size
     */
    const updateCanvasSize = useCallback(() => {
        const container = containerRef.current;
        if (!container || !data) return;

        const containerWidth = container.clientWidth || 400;
        const containerHeight = container.clientHeight || 700;
        const deviceAspect = data.screenWidth / data.screenHeight;

        let canvasWidth: number;
        let canvasHeight: number;

        if (containerHeight * deviceAspect <= containerWidth) {
            canvasHeight = containerHeight;
            canvasWidth = containerHeight * deviceAspect;
        } else {
            canvasWidth = containerWidth;
            canvasHeight = containerWidth / deviceAspect;
        }

        setCanvasSize({
            width: Math.round(canvasWidth),
            height: Math.round(canvasHeight)
        });
    }, [data]);

    /**
     * Main render function
     */
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !data) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const canvasWidth = canvasSize.width;
        const canvasHeight = canvasSize.height;

        const scaleX = canvasWidth / data.screenWidth;
        const scaleY = canvasHeight / data.screenHeight;
        scaleXRef.current = scaleX;
        scaleYRef.current = scaleY;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (bgImageLoaded) {
            ctx.drawImage(bgImageLoaded, 0, 0, canvasWidth, canvasHeight);
            ctx.globalAlpha = 0.6;
        } else {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        if (data.nodes) {
            renderNode(ctx, data.nodes, scaleX, scaleY);
        }

        ctx.globalAlpha = 1.0;

        // Draw gesture visual feedback
        if (gestureVisual) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(gestureVisual.startX, gestureVisual.startY);
            ctx.lineTo(gestureVisual.endX, gestureVisual.endY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw arrow at end
            const angle = Math.atan2(gestureVisual.endY - gestureVisual.startY, gestureVisual.endX - gestureVisual.startX);
            const arrowSize = 10;
            ctx.beginPath();
            ctx.moveTo(gestureVisual.endX, gestureVisual.endY);
            ctx.lineTo(
                gestureVisual.endX - arrowSize * Math.cos(angle - Math.PI / 6),
                gestureVisual.endY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(gestureVisual.endX, gestureVisual.endY);
            ctx.lineTo(
                gestureVisual.endX - arrowSize * Math.cos(angle + Math.PI / 6),
                gestureVisual.endY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
        }

        // Draw doodle path visual feedback
        if (doodlePath.length >= 2 && data) {
            ctx.strokeStyle = '#06b6d4'; // Cyan for doodle
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            // Convert normalized points to canvas coordinates
            const firstPoint = doodlePath[0];
            const firstX = firstPoint.x * data.screenWidth * scaleX;
            const firstY = firstPoint.y * data.screenHeight * scaleY;
            ctx.moveTo(firstX, firstY);

            for (let i = 1; i < doodlePath.length; i++) {
                const point = doodlePath[i];
                const px = point.x * data.screenWidth * scaleX;
                const py = point.y * data.screenHeight * scaleY;
                ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Draw dots at each point
            ctx.fillStyle = '#06b6d4';
            for (const point of doodlePath) {
                const px = point.x * data.screenWidth * scaleX;
                const py = point.y * data.screenHeight * scaleY;
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Detect if this is a pattern lock screen and find pattern bounds
        const patternInfo = (() => {
            if (!data) return null;
            const patternKeywords = ['pattern', 'draw pattern', 'set pattern', 'confirm pattern', 'draw your pattern', 'unlock pattern', 'try again'];
            let isPattern = false;
            let patternBounds: { left: number; top: number; right: number; bottom: number } | null = null;

            // Search for pattern keywords and pattern view bounds
            const searchNodes = (node: ScreenNode): void => {
                const text = (node.text || node.desc || node.hint || '').toLowerCase();
                const nodeType = (node.type || '').toLowerCase();

                if (patternKeywords.some(kw => text.includes(kw))) {
                    isPattern = true;
                }

                // Look for pattern view by type or by being a large square-ish clickable area
                if (nodeType.includes('lockpattern') || nodeType.includes('patternview') ||
                    (nodeType.includes('view') && node.bounds)) {
                    const bounds = node.bounds;
                    const width = bounds.right - bounds.left;
                    const height = bounds.bottom - bounds.top;
                    // Pattern view is usually square-ish and in lower half
                    if (width > data.screenWidth * 0.4 && height > data.screenHeight * 0.2 &&
                        Math.abs(width - height) < Math.max(width, height) * 0.3 &&
                        bounds.top > data.screenHeight * 0.2) {
                        if (!patternBounds || (width * height > (patternBounds.right - patternBounds.left) * (patternBounds.bottom - patternBounds.top))) {
                            patternBounds = bounds;
                        }
                    }
                }

                if (node.children) {
                    for (const child of node.children) {
                        searchNodes(child);
                    }
                }
            };

            searchNodes(data.nodes);
            return isPattern ? { isPattern, bounds: patternBounds } : null;
        })();

        // Draw pattern grid when doodle mode is on and pattern screen detected
        if (doodleMode && patternInfo?.isPattern) {
            const gridCount = Math.max(3, Math.min(9, patternGridSize));
            let gridX: number, gridY: number, gridSize: number;

            // Use detected bounds if available, otherwise use default position
            const pBounds = patternInfo.bounds as { left: number; top: number; right: number; bottom: number } | null;
            if (pBounds) {
                gridX = pBounds.left * scaleX;
                gridY = pBounds.top * scaleY;
                const boundsWidth = (pBounds.right - pBounds.left) * scaleX;
                const boundsHeight = (pBounds.bottom - pBounds.top) * scaleY;
                gridSize = Math.min(boundsWidth, boundsHeight);
                // Center within bounds
                gridX += (boundsWidth - gridSize) / 2;
                gridY += (boundsHeight - gridSize) / 2;
            } else {
                // Default positioning
                gridSize = Math.min(canvasWidth * 0.7, canvasHeight * 0.35);
                gridX = (canvasWidth - gridSize) / 2;
                gridY = canvasHeight * 0.45;
            }

            const cellSize = gridSize / gridCount;
            const dotRadius = Math.min(cellSize * 0.12, 12);

            // Draw guide grid border
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(gridX, gridY, gridSize, gridSize);
            ctx.setLineDash([]);

            // Draw dots for NxN pattern
            ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
            ctx.strokeStyle = 'rgba(6, 182, 212, 1)';
            ctx.lineWidth = 2;

            for (let row = 0; row < gridCount; row++) {
                for (let col = 0; col < gridCount; col++) {
                    const dotX = gridX + cellSize * (col + 0.5);
                    const dotY = gridY + cellSize * (row + 0.5);

                    // Outer ring
                    ctx.beginPath();
                    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
                    ctx.stroke();

                    // Inner dot
                    ctx.beginPath();
                    ctx.arc(dotX, dotY, dotRadius * 0.35, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Label
            ctx.fillStyle = '#06b6d4';
            ctx.font = 'bold 11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(`${gridCount}×${gridCount} Pattern`, canvasWidth / 2, gridY - 8);
            ctx.textAlign = 'left';
        }

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

        if (showDebugInfo) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px monospace';
            ctx.fillText(`${data.screenWidth}x${data.screenHeight}`, 8, canvasHeight - 8);
            ctx.fillText(`Scale: X=${scaleX.toFixed(3)} Y=${scaleY.toFixed(3)}`, 8, canvasHeight - 22);
        }
    }, [data, renderNode, showDebugInfo, canvasSize, bgImageLoaded, gestureVisual, doodlePath, doodleMode]);

    /**
     * Convert canvas coordinates to normalized device coordinates
     */
    const canvasToNormalized = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas || !data) return null;

        const rect = canvas.getBoundingClientRect();
        const cssScaleX = canvas.width / rect.width;
        const cssScaleY = canvas.height / rect.height;

        const canvasX = (clientX - rect.left) * cssScaleX;
        const canvasY = (clientY - rect.top) * cssScaleY;

        const screenX = canvasX / scaleXRef.current;
        const screenY = canvasY / scaleYRef.current;

        if (screenX >= 0 && screenX <= data.screenWidth &&
            screenY >= 0 && screenY <= data.screenHeight) {
            return {
                x: screenX / data.screenWidth,
                y: screenY / data.screenHeight
            };
        }
        return null;
    }, [data]);

    /**
     * Get canvas coordinates from event
     */
    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const cssScaleX = canvas.width / rect.width;
        const cssScaleY = canvas.height / rect.height;

        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) * cssScaleX,
            y: (clientY - rect.top) * cssScaleY
        };
    }, []);

    /**
     * Calculate swipe direction
     */
    const getSwipeDirection = useCallback((startX: number, startY: number, endX: number, endY: number): 'up' | 'down' | 'left' | 'right' => {
        const dx = endX - startX;
        const dy = endY - startY;

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }, []);

    /**
     * Emit gesture event
     */
    const emitGesture = useCallback((gesture: GestureEvent) => {
        if (onGesture) {
            onGesture(gesture);
        }
        // Legacy support
        if (onTouch && (gesture.type === 'tap' || gesture.type === 'longpress')) {
            onTouch(gesture.startX, gesture.startY, gesture.type);
        }
    }, [onGesture, onTouch]);

    /**
     * Handle mouse/touch down
     */
    const handlePointerDown = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        // Prevent touch events from also firing mouse events (fixes double-click on mobile)
        if ('touches' in e) {
            e.preventDefault();
        }

        const coords = getCanvasCoords(e);
        if (!coords) return;

        mouseDownPos.current = { x: coords.x, y: coords.y, time: Date.now() };
        currentPos.current = coords;
        isDragging.current = false;

        // Initialize doodle points for doodle mode
        if (doodleMode) {
            const normalized = canvasToNormalized(
                'touches' in e ? e.touches[0].clientX : e.clientX,
                'touches' in e ? e.touches[0].clientY : e.clientY
            );
            if (normalized) {
                doodlePoints.current = [normalized];
                setDoodlePath([normalized]);
            }
        }

        // Start long press timer (only if not in doodle mode)
        if (!doodleMode) {
            longPressTimer.current = setTimeout(() => {
                const normalized = canvasToNormalized(
                    'touches' in e ? e.touches[0].clientX : e.clientX,
                    'touches' in e ? e.touches[0].clientY : e.clientY
                );
                if (normalized && !isDragging.current) {
                    emitGesture({
                        type: 'longpress',
                        startX: normalized.x,
                        startY: normalized.y
                    });
                }
            }, LONG_PRESS_DURATION);
        }
    }, [getCanvasCoords, canvasToNormalized, emitGesture, doodleMode]);

    /**
     * Handle mouse/touch move
     */
    const handlePointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        // Prevent touch events from also firing mouse events (fixes double-click on mobile)
        if ('touches' in e) {
            e.preventDefault();
        }

        if (!mouseDownPos.current) return;

        const coords = getCanvasCoords(e);
        if (!coords) return;

        currentPos.current = coords;
        const dx = coords.x - mouseDownPos.current.x;
        const dy = coords.y - mouseDownPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // In doodle mode, collect points ALWAYS during movement (regardless of threshold)
        if (doodleMode && doodlePoints.current.length > 0) {
            const normalized = canvasToNormalized(
                'touches' in e ? e.touches[0].clientX : e.clientX,
                'touches' in e ? e.touches[0].clientY : e.clientY
            );
            if (normalized) {
                // Only add point if it's sufficiently different from the last one
                const lastPoint = doodlePoints.current[doodlePoints.current.length - 1];
                const pointDist = Math.sqrt(
                    Math.pow(normalized.x - lastPoint.x, 2) +
                    Math.pow(normalized.y - lastPoint.y, 2)
                );
                if (pointDist > 0.003) { // Smaller threshold for smoother paths
                    doodlePoints.current.push(normalized);
                    setDoodlePath([...doodlePoints.current]);
                    isDragging.current = true;
                }
            }
            // Cancel long press timer in doodle mode if we moved
            if (distance > 5 && longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            return; // Don't do regular swipe visual in doodle mode
        }

        // Regular mode: only track after threshold
        if (distance > SWIPE_THRESHOLD) {
            isDragging.current = true;
            // Cancel long press if moved too far
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }

            // Update gesture visual (for regular swipes)
            setGestureVisual({
                startX: mouseDownPos.current.x,
                startY: mouseDownPos.current.y,
                endX: coords.x,
                endY: coords.y
            });
        }
    }, [getCanvasCoords, doodleMode, canvasToNormalized]);

    /**
     * Handle mouse/touch up
     */
    const handlePointerUp = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        // Prevent touch events from also firing mouse events (fixes double-click on mobile)
        if ('touches' in e) {
            e.preventDefault();
        }

        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        setGestureVisual(null);

        if (!mouseDownPos.current) return;

        // Handle doodle mode gesture - only if we have enough points for a pattern
        if (doodleMode && doodlePoints.current.length >= 2) {
            const duration = Date.now() - mouseDownPos.current.time;
            emitGesture({
                type: 'doodle',
                startX: doodlePoints.current[0].x,
                startY: doodlePoints.current[0].y,
                points: [...doodlePoints.current],
                duration: Math.max(duration, 500) // Minimum 500ms for pattern
            });
            doodlePoints.current = [];
            setDoodlePath([]);
            mouseDownPos.current = null;
            currentPos.current = null;
            isDragging.current = false;
            return;
        }

        // Clear doodle path and fall through to regular gesture handling
        // This allows taps to work even in doodle mode
        doodlePoints.current = [];
        setDoodlePath([]);

        const endCoords = currentPos.current || mouseDownPos.current;
        const startNormalized = canvasToNormalized(
            mouseDownPos.current.x / (canvasRef.current?.width || 1) * (canvasRef.current?.getBoundingClientRect().width || 1) + (canvasRef.current?.getBoundingClientRect().left || 0),
            mouseDownPos.current.y / (canvasRef.current?.height || 1) * (canvasRef.current?.getBoundingClientRect().height || 1) + (canvasRef.current?.getBoundingClientRect().top || 0)
        );

        // Calculate normalized coordinates directly from canvas coordinates
        const canvas = canvasRef.current;
        if (!canvas || !data) {
            mouseDownPos.current = null;
            currentPos.current = null;
            return;
        }

        const startX = (mouseDownPos.current.x / scaleXRef.current) / data.screenWidth;
        const startY = (mouseDownPos.current.y / scaleYRef.current) / data.screenHeight;
        const endX = (endCoords.x / scaleXRef.current) / data.screenWidth;
        const endY = (endCoords.y / scaleYRef.current) / data.screenHeight;

        const dx = endCoords.x - mouseDownPos.current.x;
        const dy = endCoords.y - mouseDownPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = Date.now() - mouseDownPos.current.time;

        if (distance > SWIPE_THRESHOLD) {
            // It's a swipe
            const direction = getSwipeDirection(mouseDownPos.current.x, mouseDownPos.current.y, endCoords.x, endCoords.y);
            emitGesture({
                type: 'swipe',
                startX: Math.max(0, Math.min(1, startX)),
                startY: Math.max(0, Math.min(1, startY)),
                endX: Math.max(0, Math.min(1, endX)),
                endY: Math.max(0, Math.min(1, endY)),
                direction,
                duration
            });
        } else if (duration < LONG_PRESS_DURATION) {
            // It's a tap - check for double tap
            const now = Date.now();
            if (now - lastTapTime.current < DOUBLE_TAP_TIMEOUT) {
                emitGesture({
                    type: 'double_tap',
                    startX: Math.max(0, Math.min(1, startX)),
                    startY: Math.max(0, Math.min(1, startY))
                });
                lastTapTime.current = 0;
            } else {
                emitGesture({
                    type: 'tap',
                    startX: Math.max(0, Math.min(1, startX)),
                    startY: Math.max(0, Math.min(1, startY))
                });
                lastTapTime.current = now;
            }
        }

        mouseDownPos.current = null;
        currentPos.current = null;
        isDragging.current = false;
    }, [data, canvasToNormalized, getSwipeDirection, emitGesture, doodleMode]);

    /**
     * Handle pointer leave/cancel
     */
    const handlePointerLeave = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        mouseDownPos.current = null;
        currentPos.current = null;
        isDragging.current = false;
        setGestureVisual(null);
        // Clear doodle path on leave
        doodlePoints.current = [];
        setDoodlePath([]);
    }, []);

    // Effects
    useEffect(() => {
        updateCanvasSize();
        const handleResize = () => updateCanvasSize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateCanvasSize]);

    useEffect(() => {
        if (backgroundImage) {
            const img = new Image();
            img.onload = () => setBgImageLoaded(img);
            img.src = backgroundImage;
        } else {
            setBgImageLoaded(null);
        }
    }, [backgroundImage]);

    useEffect(() => {
        render();
    }, [render]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full flex items-center justify-center ${className}`}
            style={{ minHeight: '500px' }}
        >
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerLeave}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                onTouchCancel={handlePointerLeave}
                className="cursor-crosshair rounded-lg shadow-2xl"
                style={{ touchAction: 'none' }}
            />

            {!data && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
                    <div className="text-center text-white">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-400">Waiting for screen data...</p>
                        <p className="text-xs text-slate-500 mt-1">Start silent capture from controls</p>
                    </div>
                </div>
            )}
        </div>
    );
}
