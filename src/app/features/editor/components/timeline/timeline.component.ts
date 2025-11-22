import {
    Component,
    inject,
    computed,
    ElementRef,
    ViewChild,
    HostListener,
    ChangeDetectionStrategy,
    signal,
    effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '../../store/editor.store';
import { Clip, Track, AssetType } from '../../models/editor.models';

@Component({
    selector: 'timeline',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="timeline-container">
            <div class="toolbar">
                <div class="zoom-controls">
                    <button (click)="zoomOut()">-</button>
                    <span class="zoom-label">{{ zoomLevel() }} px/s</span>
                    <button (click)="zoomIn()">+</button>
                </div>
                <div class="track-controls">
                    <button (click)="addTrack('video')">+ Video</button>
                    <button (click)="addTrack('audio')">+ Audio</button>
                </div>
            </div>

            <div class="timeline-body">
                <!-- Left Sidebar (Track Headers) -->
                <div class="sidebar">
                    <div class="ruler-corner"></div>
                    <!-- Empty space for ruler header -->
                    <div class="track-headers">
                        @for (track of store.tracks(); track track.id) {
                        <div
                            class="track-header"
                            [class.video]="track.type === 'video'"
                            [class.audio]="track.type === 'audio'"
                        >
                            <div class="track-name">{{ track.name }}</div>
                            <div class="track-actions">
                                <button (click)="toggleMute(track)" [class.active]="track.isMuted">
                                    M
                                </button>
                                <button (click)="toggleLock(track)" [class.active]="track.isLocked">
                                    L
                                </button>
                            </div>
                        </div>
                        }
                    </div>
                </div>

                <!-- Main Timeline Area (Scrollable) -->
                <div
                    class="timeline-scroll-area"
                    #scrollContainer
                    (scroll)="onScroll($event)"
                    (click)="onTimelineClick($event)"
                >
                    <div class="timeline-content-wrapper" [style.width.px]="totalWidth()">
                        <!-- Ruler -->
                        <div class="ruler" (click)="onRulerClick($event)">
                            @for (tick of rulerTicks(); track tick.time) {
                            <div
                                class="tick"
                                [class.major]="tick.isMajor"
                                [style.left.px]="tick.position"
                            >
                                @if (tick.isMajor) {
                                <span class="tick-label">{{ formatTime(tick.time) }}</span>
                                }
                            </div>
                            }
                        </div>

                        <!-- Playhead (Spans entire height) -->
                        <div class="playhead-line" [style.left.px]="playheadPosition()">
                            <div class="playhead-marker"></div>
                        </div>

                        <!-- Tracks -->
                        <div class="tracks-container">
                            @for (track of store.tracks(); track track.id) {
                            <div
                                class="track-lane"
                                (dragover)="onTrackDragOver($event, track)"
                                (drop)="onTrackDrop($event, track)"
                            >
                                <!-- Grid Lines (Optional, for visual guide) -->
                                <div class="grid-overlay"></div>

                                @for (clip of getClipsForTrack(track.id); track clip.id) {
                                <div
                                    class="clip"
                                    [class.selected]="store.selectedClipId() === clip.id"
                                    [class.dragging]="dragState?.clipId === clip.id"
                                    [style.left.px]="timeToPx(clip.startTime)"
                                    [style.width.px]="timeToPx(clip.duration)"
                                    (mousedown)="onClipMouseDown($event, clip)"
                                    (click)="selectClip($event, clip)"
                                >
                                    <span class="clip-name">{{ clip.name }}</span>
                                </div>
                                }
                            </div>
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
                width: 100%;
                box-sizing: border-box;
                --ruler-height: 30px;
                --track-height: 60px;
                --header-width: 200px;
                --border-color: #333;
                --bg-dark: #1e1e1e;
                --bg-darker: #181818;
                --accent: #007acc;
            }

            *,
            *:before,
            *:after {
                box-sizing: border-box;
            }

            .timeline-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--bg-dark);
                color: #ccc;
                font-family: 'Inter', sans-serif;
            }

            .toolbar {
                height: 40px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                padding: 0 1rem;
                justify-content: space-between;
                background: var(--bg-darker);
            }

            .zoom-controls,
            .track-controls {
                display: flex;
                gap: 0.5rem;
            }

            button {
                background: #333;
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            button:hover {
                background: #444;
            }

            .timeline-body {
                flex: 1;
                display: flex;
                overflow: hidden;
                position: relative;
            }

            .sidebar {
                width: var(--header-width);
                flex-shrink: 0;
                border-right: 1px solid var(--border-color);
                background: var(--bg-darker);
                display: flex;
                flex-direction: column;
                z-index: 20;
            }

            .ruler-corner {
                height: var(--ruler-height);
                border-bottom: 1px solid var(--border-color);
                background: var(--bg-darker);
            }

            .track-headers {
                flex: 1;
                overflow: hidden; /* Synced scroll would be better, but for now static */
            }

            .track-header {
                height: var(--track-height);
                border-bottom: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                padding: 0 1rem;
                justify-content: space-between;
                font-size: 12px;
            }

            .timeline-scroll-area {
                flex: 1;
                overflow: auto;
                position: relative;
                background: var(--bg-dark);
            }

            .timeline-content-wrapper {
                position: relative;
                min-width: 100%;
                /* Ensure height covers tracks */
            }

            .ruler {
                height: var(--ruler-height);
                border-bottom: 1px solid var(--border-color);
                position: sticky;
                top: 0;
                background: var(--bg-dark);
                z-index: 10;
                pointer-events: auto;
                overflow: hidden;
            }

            .tick {
                position: absolute;
                bottom: 0;
                width: 1px;
                background: #555;
                height: 5px;
            }

            .tick.major {
                height: 10px;
                background: #888;
            }

            .tick-label {
                position: absolute;
                bottom: 12px;
                left: 2px;
                font-size: 10px;
                color: #888;
                white-space: nowrap;
            }

            .playhead-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 1px;
                background: red;
                z-index: 100;
                pointer-events: none;
                height: 100%;
            }

            .playhead-marker {
                position: absolute;
                top: 0;
                left: -5px;
                width: 11px;
                height: 12px;
                background: red;
                clip-path: polygon(0 0, 100% 0, 50% 100%);
            }

            .tracks-container {
                position: relative;
            }

            .track-lane {
                height: var(--track-height);
                border-bottom: 1px solid var(--border-color);
                position: relative;
                background: var(--bg-dark);
            }

            .track-lane:nth-child(even) {
                background: #222;
            }

            .clip {
                position: absolute;
                top: 4px;
                bottom: 4px;
                background: #3a3d41;
                border: 1px solid #555;
                border-radius: 4px;
                padding: 0 0.5rem;
                font-size: 11px;
                display: flex;
                align-items: center;
                overflow: hidden;
                white-space: nowrap;
                cursor: pointer;
                user-select: none;
                z-index: 1;
                transition: box-shadow 0.1s, transform 0.1s;
            }

            .clip.selected {
                border-color: var(--accent);
                background: #264f78;
                z-index: 2;
                box-shadow: 0 0 0 1px var(--accent);
            }

            .clip.dragging {
                opacity: 0.9;
                cursor: grabbing;
                z-index: 100;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                transform: scale(1.02);
            }
        `,
    ],
})
export class TimelineComponent {
    store = inject(EditorStore);

    // Signals
    zoomLevel = signal<number>(50); // Start with a reasonable zoom
    scrollLeft = signal<number>(0);

    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

    // Computed
    totalWidth = computed(() => {
        // Ensure we have enough space for the longest clip + some padding
        const duration = this.store.totalDuration();
        const minWidth = 1000; // Minimum width to fill screen
        return Math.max(minWidth, (duration + 10) * this.zoomLevel());
    });

    playheadPosition = computed(() => {
        return this.store.currentTime() * this.zoomLevel();
    });

    rulerTicks = computed(() => {
        const zoom = this.zoomLevel();
        const width = this.totalWidth();
        const ticks = [];

        // Determine tick interval based on zoom
        let interval = 1; // 1 second
        if (zoom < 20) interval = 10;
        else if (zoom < 50) interval = 5;
        else if (zoom < 100) interval = 1;
        else interval = 0.5;

        for (let time = 0; time * zoom < width; time += interval) {
            ticks.push({
                time,
                position: time * zoom,
                isMajor: time % (interval * 5) === 0 || time === 0,
            });
        }
        return ticks;
    });

    dragState: {
        clipId: string;
        startX: number;
        startStartTime: number;
        startTrackId: string;
    } | null = null;

    // Methods
    getClipsForTrack(trackId: string): Clip[] {
        return this.store.clips().filter((c) => c.trackId === trackId);
    }

    timeToPx(seconds: number): number {
        return seconds * this.zoomLevel();
    }

    pxToTime(px: number): number {
        return px / this.zoomLevel();
    }

    formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // Event Handlers
    onScroll(event: Event) {
        const target = event.target as HTMLElement;
        this.scrollLeft.set(target.scrollLeft);
    }

    onTimelineClick(event: MouseEvent) {
        // Only handle if not dragging and not clicking a clip
        if (this.dragState) return;

        const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
        // Calculation: (Click X relative to viewport) - (Container Left) + (Scroll Amount)
        // We subtract sidebar width if the click is on the sidebar? No, the click listener is on scroll-area.
        // But wait, the sidebar is a sibling of scroll-area.
        // So scroll-area starts AFTER sidebar.

        const clickX = event.clientX - rect.left + this.scrollContainer.nativeElement.scrollLeft;
        const time = Math.max(0, this.pxToTime(clickX));
        this.store.setCurrentTime(time);
    }

    onRulerClick(event: MouseEvent) {
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const time = Math.max(0, this.pxToTime(clickX));
        this.store.setCurrentTime(time);
    }

    selectClip(event: MouseEvent, clip: Clip) {
        event.stopPropagation();
        this.store.selectClip(clip.id);
    }

    onClipMouseDown(event: MouseEvent, clip: Clip) {
        event.preventDefault();
        event.stopPropagation();

        this.dragState = {
            clipId: clip.id,
            startX: event.clientX,
            startStartTime: clip.startTime,
            startTrackId: clip.trackId,
        };

        this.store.selectClip(clip.id);
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (!this.dragState) return;

        const deltaX = event.clientX - this.dragState.startX;
        const deltaTime = this.pxToTime(deltaX);
        let newStartTime = Math.max(0, this.dragState.startStartTime + deltaTime);

        // Snapping Logic
        const SNAP_THRESHOLD_PX = 10;
        const snapThreshold = this.pxToTime(SNAP_THRESHOLD_PX);

        const otherClips = this.store.clips().filter((c) => c.id !== this.dragState!.clipId);
        let snapped = false;

        // Snap to Playhead
        if (Math.abs(newStartTime - this.store.currentTime()) < snapThreshold) {
            newStartTime = this.store.currentTime();
            snapped = true;
        }

        if (!snapped) {
            for (const other of otherClips) {
                // Snap to end of other clip
                if (Math.abs(newStartTime - (other.startTime + other.duration)) < snapThreshold) {
                    newStartTime = other.startTime + other.duration;
                    break;
                }
                // Snap to start of other clip
                if (Math.abs(newStartTime - other.startTime) < snapThreshold) {
                    newStartTime = other.startTime;
                    break;
                }
            }
        }

        this.store.updateClip(this.dragState.clipId, { startTime: newStartTime });
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        this.dragState = null;
    }

    onTrackDragOver(event: DragEvent, track: Track) {
        event.preventDefault();
    }

    onTrackDrop(event: DragEvent, track: Track) {
        // Handle drop
    }

    zoomIn() {
        this.zoomLevel.update((z) => Math.min(300, z * 1.2));
    }

    zoomOut() {
        this.zoomLevel.update((z) => Math.max(10, z / 1.2));
    }

    addTrack(type: AssetType) {
        this.store.addTrack(type);
    }

    toggleMute(track: Track) {
        // Implement in store
    }

    toggleLock(track: Track) {
        // Implement in store
    }
}
