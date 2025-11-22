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
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { matFastRewind } from '@ng-icons/material-icons/baseline';
import { StorageService } from '../../services/storage.service';

interface SelectionBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

@Component({
    selector: 'timeline',
    standalone: true,
    imports: [CommonModule, NgIconComponent],
    viewProviders: [provideIcons({ matFastRewind })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="timeline-container">
            <div class="toolbar">
                <div class="zoom-controls">
                    <button (click)="zoomOut()">-</button>
                    <span class="zoom-label">{{ zoomLevel() | number : '1.0-0' }} px/s</span>
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
                                    [class.selected]="isClipSelected(clip.id)"
                                    [class.dragging]="dragState?.clipIds.includes(clip.id)"
                                    [style.left.px]="timeToPx(clip.startTime)"
                                    [style.width.px]="timeToPx(clip.duration)"
                                    (mousedown)="onClipMouseDown($event, clip)"
                                    (click)="selectClip($event, clip)"
                                    (contextmenu)="onClipContextMenu($event, clip)"
                                >
                                    <span class="clip-name">{{ clip.name }}</span>
                                    <div class="clip-icons">
                                        @if (clip.isReversed) {
                                        <ng-icon
                                            name="matFastRewind"
                                            class="icon reverse-icon"
                                            title="Reversed"
                                        ></ng-icon>
                                        }
                                    </div>
                                </div>
                                }
                            </div>
                            }
                        </div>

                        <!-- Selection Box -->
                        @if (selectionBox) {
                        <div
                            class="selection-box"
                            [style.left.px]="getSelectionBoxLeft()"
                            [style.top.px]="getSelectionBoxTop()"
                            [style.width.px]="getSelectionBoxWidth()"
                            [style.height.px]="getSelectionBoxHeight()"
                        ></div>
                        }
                    </div>
                </div>
            </div>

            <!-- Context Menu -->
            @if (contextMenu) {
            <div
                class="context-menu"
                [style.left.px]="contextMenu.x"
                [style.top.px]="contextMenu.y"
                (click)="closeContextMenu()"
            >
                @if (selectedClipIds().length > 1) {
                <div class="menu-item" (click)="copySelectedClips()">
                    Copy {{ selectedClipIds().length }} clips
                </div>
                <div class="menu-item" (click)="duplicateSelectedClips()">
                    Duplicate {{ selectedClipIds().length }} clips
                </div>
                <div class="menu-item delete" (click)="deleteSelectedClips()">
                    Delete {{ selectedClipIds().length }} clips
                </div>
                } @else {
                <div class="menu-item" (click)="copyClip(contextMenu.clipId)">Copy</div>
                <div class="menu-item" (click)="duplicateClip(contextMenu.clipId)">Duplicate</div>
                @if (isVideoClip(contextMenu.clipId)) {
                <div class="menu-item" (click)="reverseClip(contextMenu.clipId)">
                    {{ isClipReversed(contextMenu.clipId) ? 'Normal Speed' : 'Reverse Speed' }}
                </div>
                }
                <div class="menu-item delete" (click)="deleteClip(contextMenu.clipId)">Delete</div>
                } @if (clipboard().length > 0) {
                <div class="menu-divider"></div>
                <div class="menu-item" (click)="pasteClips()">
                    Paste {{ clipboard().length }} clip{{ clipboard().length > 1 ? 's' : '' }}
                </div>
                }
            </div>
            }

            <!-- Overlay to close menu -->
            @if (contextMenu) {
            <div class="menu-overlay" (click)="closeContextMenu()"></div>
            }
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
                overflow: auto;
                position: relative;
                background: var(--bg-dark);
            }

            .timeline-scroll-area::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }

            .timeline-scroll-area::-webkit-scrollbar-track {
                background: #1e1e1e;
                border-left: 1px solid #333;
                border-top: 1px solid #333;
            }

            .timeline-scroll-area::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 5px;
                border: 2px solid #1e1e1e;
            }

            .timeline-scroll-area::-webkit-scrollbar-thumb:hover {
                background: #555;
            }

            .timeline-scroll-area::-webkit-scrollbar-corner {
                background: #1e1e1e;
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

            .clip-icons {
                position: absolute;
                right: 4px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                gap: 4px;
                pointer-events: none;
            }

            .icon {
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .reverse-icon {
                color: #ffcc00;
            }

            .clip.selected {
                border-color: var(--accent);
                background: #264f78;
                z-index: 2;
                box-shadow: 0 0 0 2px var(--accent);
            }

            .clip.dragging {
                opacity: 0.9;
                cursor: grabbing;
                z-index: 100;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                transform: scale(1.02);
            }

            .context-menu {
                position: fixed;
                background: #252526;
                border: 1px solid #454545;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                padding: 4px 0;
                z-index: 1000;
                min-width: 150px;
            }

            .menu-item {
                padding: 8px 16px;
                cursor: pointer;
                font-size: 12px;
                color: #ccc;
            }

            .menu-item:hover {
                background: #094771;
                color: white;
            }

            .menu-item.delete {
                color: #ff4d4d;
            }

            .menu-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999;
                background: transparent;
            }

            .selection-box {
                position: absolute;
                border: 2px dashed var(--accent);
                background: rgba(0, 122, 204, 0.1);
                pointer-events: none;
                z-index: 50;
            }

            .menu-divider {
                height: 1px;
                background: #454545;
                margin: 4px 0;
            }
        `,
    ],
})
export class TimelineComponent {
    store = inject(EditorStore);
    private storage = inject(StorageService);

    // Signals
    zoomLevel = signal<number>(this.storage.loadState<number>('timeline-zoom') || 50);
    scrollLeft = signal<number>(0);
    selectedClipIds = signal<string[]>([]); // Multi-selection
    clipboard = signal<Clip[]>([]); // For copy/paste
    selectionBox = signal<SelectionBox | null>(null);

    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

    constructor() {
        effect(() => {
            this.storage.saveState('timeline-zoom', this.zoomLevel());
        });
    }

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
        clipIds: string[];
        startX: number;
        startY: number;
        initialPositions: Map<string, { startTime: number; trackId: string }>;
    } | null = null;

    contextMenu: {
        x: number;
        y: number;
        clipId: string;
    } | null = null;

    private lastSelectedClipId: string | null = null;

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

        // Start selection box if shift is held
        if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
            const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
            this.selectionBox.set({
                startX: event.clientX,
                startY: event.clientY,
                currentX: event.clientX,
                currentY: event.clientY,
            });
            return;
        }

        // Clear selection if clicking on empty space
        if (!event.ctrlKey && !event.metaKey) {
            this.selectedClipIds.set([]);
            this.lastSelectedClipId = null;
        }

        const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
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

    private isDragOperation = false;
    private handledSelectionInMouseDown = false;

    selectClip(event: MouseEvent, clip: Clip) {
        event.stopPropagation();

        // If we dragged, don't change selection
        if (this.isDragOperation) return;

        // If we already handled selection in mousedown (e.g. clicking unselected clip), don't do anything
        if (this.handledSelectionInMouseDown) return;

        // Handle clicking on an ALREADY selected clip
        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + Click: Toggle selection (Deselect)
            this.toggleClipSelection(clip.id);
        } else if (event.shiftKey && this.lastSelectedClipId) {
            // Shift + Click: Select range
            this.selectClipRange(this.lastSelectedClipId, clip.id);
        } else {
            // Normal click on selected clip: Select ONLY this clip (deselect others)
            this.selectedClipIds.set([clip.id]);
            this.lastSelectedClipId = clip.id;
        }

        // Update store's selected clip (for preview)
        this.store.selectClip(clip.id);
    }

    toggleClipSelection(clipId: string) {
        const current = this.selectedClipIds();
        if (current.includes(clipId)) {
            this.selectedClipIds.set(current.filter((id) => id !== clipId));
        } else {
            this.selectedClipIds.set([...current, clipId]);
            this.lastSelectedClipId = clipId;
        }
    }

    selectClipRange(startClipId: string, endClipId: string) {
        const clips = this.store.clips();
        const startIndex = clips.findIndex((c) => c.id === startClipId);
        const endIndex = clips.findIndex((c) => c.id === endClipId);

        if (startIndex === -1 || endIndex === -1) return;

        const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangeClipIds = clips.slice(from, to + 1).map((c) => c.id);

        this.selectedClipIds.set(rangeClipIds);
    }

    isClipSelected(clipId: string): boolean {
        return this.selectedClipIds().includes(clipId);
    }

    onClipMouseDown(event: MouseEvent, clip: Clip) {
        event.preventDefault();
        event.stopPropagation();

        this.isDragOperation = false;
        this.handledSelectionInMouseDown = false;

        // If clicking on an unselected clip, select it first (so we can drag it immediately)
        if (!this.isClipSelected(clip.id)) {
            this.handledSelectionInMouseDown = true;
            if (event.ctrlKey || event.metaKey) {
                this.toggleClipSelection(clip.id);
            } else if (event.shiftKey && this.lastSelectedClipId) {
                this.selectClipRange(this.lastSelectedClipId, clip.id);
            } else {
                this.selectedClipIds.set([clip.id]);
                this.lastSelectedClipId = clip.id;
            }
        }

        // Prepare drag state for all selected clips
        const selectedIds = this.selectedClipIds();
        const clipsToMove = this.store.clips().filter((c) => selectedIds.includes(c.id));
        const initialPositions = new Map<string, { startTime: number; trackId: string }>();

        clipsToMove.forEach((c) => {
            initialPositions.set(c.id, { startTime: c.startTime, trackId: c.trackId });
        });

        this.dragState = {
            clipIds: selectedIds,
            startX: event.clientX,
            startY: event.clientY,
            initialPositions,
        };

        this.store.selectClip(clip.id);
    }

    onClipContextMenu(event: MouseEvent, clip: Clip) {
        event.preventDefault();
        event.stopPropagation();

        // Ensure the right-clicked clip is selected
        if (!this.isClipSelected(clip.id)) {
            this.selectedClipIds.set([clip.id]);
            this.lastSelectedClipId = clip.id;
        }

        this.contextMenu = {
            x: event.clientX,
            y: event.clientY,
            clipId: clip.id,
        };
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        // Handle selection box
        if (this.selectionBox()) {
            this.selectionBox.update((box) => {
                if (!box) return null;
                return { ...box, currentX: event.clientX, currentY: event.clientY };
            });
            this.updateSelectionBoxClips();
            return;
        }

        // Handle clip dragging
        if (!this.dragState) return;

        // Check if we are actually dragging (moved more than threshold)
        if (!this.isDragOperation) {
            const moveX = Math.abs(event.clientX - this.dragState.startX);
            const moveY = Math.abs(event.clientY - this.dragState.startY);
            if (moveX > 3 || moveY > 3) {
                this.isDragOperation = true;
            } else {
                return; // Don't move yet
            }
        }

        const deltaX = event.clientX - this.dragState.startX;
        const deltaTime = this.pxToTime(deltaX);

        // Calculate track change
        const deltaY = event.clientY - this.dragState.startY;
        const trackHeight = 60; // Should match CSS --track-height
        const trackDelta = Math.round(deltaY / trackHeight);

        // Snapping Logic (only for the first clip)
        const SNAP_THRESHOLD_PX = 10;
        const snapThreshold = this.pxToTime(SNAP_THRESHOLD_PX);
        const firstClipId = this.dragState.clipIds[0];
        const firstClipInitial = this.dragState.initialPositions.get(firstClipId)!;
        let baseNewStartTime = Math.max(0, firstClipInitial.startTime + deltaTime);

        const otherClips = this.store
            .clips()
            .filter((c) => !this.dragState!.clipIds.includes(c.id));
        let snapped = false;

        // Snap to Playhead
        if (Math.abs(baseNewStartTime - this.store.currentTime()) < snapThreshold) {
            baseNewStartTime = this.store.currentTime();
            snapped = true;
        }

        if (!snapped) {
            for (const other of otherClips) {
                // Snap to end of other clip
                if (
                    Math.abs(baseNewStartTime - (other.startTime + other.duration)) < snapThreshold
                ) {
                    baseNewStartTime = other.startTime + other.duration;
                    break;
                }
                // Snap to start of other clip
                if (Math.abs(baseNewStartTime - other.startTime) < snapThreshold) {
                    baseNewStartTime = other.startTime;
                    break;
                }
            }
        }

        // Calculate the actual delta to apply
        const actualDeltaTime = baseNewStartTime - firstClipInitial.startTime;

        // Update all selected clips
        const tracks = this.store.tracks();
        this.dragState.clipIds.forEach((clipId) => {
            const initial = this.dragState!.initialPositions.get(clipId)!;
            const newStartTime = Math.max(0, initial.startTime + actualDeltaTime);

            // Calculate new track
            const currentTrackIndex = tracks.findIndex((t) => t.id === initial.trackId);
            const newTrackIndex = Math.max(
                0,
                Math.min(tracks.length - 1, currentTrackIndex + trackDelta)
            );
            const newTrackId = tracks[newTrackIndex]?.id || initial.trackId;

            this.store.updateClip(clipId, { startTime: newStartTime, trackId: newTrackId });
        });
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        this.dragState = null;
        if (this.selectionBox()) {
            this.selectionBox.set(null);
        }
    }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        // Ctrl/Cmd + A: Select all clips
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            event.preventDefault();
            this.selectAllClips();
        }

        // Ctrl/Cmd + C: Copy selected clips
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            event.preventDefault();
            this.copySelectedClips();
        }

        // Ctrl/Cmd + V: Paste clips
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            event.preventDefault();
            this.pasteClips();
        }

        // Ctrl/Cmd + D: Duplicate selected clips
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            this.duplicateSelectedClips();
        }

        // Delete or Backspace: Delete selected clips
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            this.deleteSelectedClips();
        }

        // Escape: Clear selection
        if (event.key === 'Escape') {
            this.selectedClipIds.set([]);
            this.lastSelectedClipId = null;
        }
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

    closeContextMenu() {
        this.contextMenu = null;
    }

    duplicateClip(clipId: string) {
        this.store.duplicateClip(clipId);
        this.closeContextMenu();
    }

    duplicateSelectedClips() {
        const selectedIds = this.selectedClipIds();
        if (selectedIds.length === 0) return;

        const clips = this.store.clips().filter((c) => selectedIds.includes(c.id));
        const minStartTime = Math.min(...clips.map((c) => c.startTime));
        const maxEndTime = Math.max(...clips.map((c) => c.startTime + c.duration));
        const offset = maxEndTime - minStartTime;

        const newClipIds: string[] = [];

        clips.forEach((clip) => {
            const newClip: Clip = {
                ...clip,
                id: crypto.randomUUID(),
                startTime: clip.startTime + offset,
                name: `${clip.name} (Copy)`,
            };
            this.store.clips.update((clips) => [...clips, newClip]);
            newClipIds.push(newClip.id);
        });

        // Select the new clips
        this.selectedClipIds.set(newClipIds);
        this.closeContextMenu();
    }

    copyClip(clipId: string) {
        const clip = this.store.clips().find((c) => c.id === clipId);
        if (clip) {
            this.clipboard.set([clip]);
        }
        this.closeContextMenu();
    }

    copySelectedClips() {
        const selectedIds = this.selectedClipIds();
        const clips = this.store.clips().filter((c) => selectedIds.includes(c.id));
        this.clipboard.set(clips);
        this.closeContextMenu();
    }

    pasteClips() {
        const clipsToPaste = this.clipboard();
        if (clipsToPaste.length === 0) return;

        // Calculate offset to paste at current time
        const minStartTime = Math.min(...clipsToPaste.map((c) => c.startTime));
        const offset = this.store.currentTime() - minStartTime;

        const newClipIds: string[] = [];

        clipsToPaste.forEach((clip) => {
            const newClip: Clip = {
                ...clip,
                id: crypto.randomUUID(),
                startTime: clip.startTime + offset,
                name: clip.name.replace(' (Copy)', '') + ' (Copy)',
            };
            this.store.clips.update((clips) => [...clips, newClip]);
            newClipIds.push(newClip.id);
        });

        // Select the pasted clips
        this.selectedClipIds.set(newClipIds);
        this.closeContextMenu();
    }

    deleteSelectedClips() {
        const selectedIds = this.selectedClipIds();
        selectedIds.forEach((id) => this.store.removeClip(id));
        this.selectedClipIds.set([]);
        this.lastSelectedClipId = null;
        this.closeContextMenu();
    }

    selectAllClips() {
        const allClipIds = this.store.clips().map((c) => c.id);
        this.selectedClipIds.set(allClipIds);
    }

    updateSelectionBoxClips() {
        const box = this.selectionBox();
        if (!box) return;

        const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
        const scrollLeft = this.scrollContainer.nativeElement.scrollLeft;
        const scrollTop = this.scrollContainer.nativeElement.scrollTop;

        const boxLeft = Math.min(box.startX, box.currentX) - rect.left + scrollLeft;
        const boxRight = Math.max(box.startX, box.currentX) - rect.left + scrollLeft;
        const boxTop = Math.min(box.startY, box.currentY) - rect.top + scrollTop;
        const boxBottom = Math.max(box.startY, box.currentY) - rect.top + scrollTop;

        const selectedIds: string[] = [];
        const trackHeight = 60;
        const rulerHeight = 30;

        this.store.clips().forEach((clip) => {
            const clipLeft = this.timeToPx(clip.startTime);
            const clipRight = this.timeToPx(clip.startTime + clip.duration);

            // Find track index
            const trackIndex = this.store.tracks().findIndex((t) => t.id === clip.trackId);
            const clipTop = rulerHeight + trackIndex * trackHeight;
            const clipBottom = clipTop + trackHeight;

            // Check if clip intersects with selection box
            if (
                clipRight >= boxLeft &&
                clipLeft <= boxRight &&
                clipBottom >= boxTop &&
                clipTop <= boxBottom
            ) {
                selectedIds.push(clip.id);
            }
        });

        this.selectedClipIds.set(selectedIds);
    }

    getSelectionBoxLeft(): number {
        const box = this.selectionBox();
        if (!box) return 0;
        const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
        return Math.min(box.startX, box.currentX) - rect.left;
    }

    getSelectionBoxTop(): number {
        const box = this.selectionBox();
        if (!box) return 0;
        const rect = this.scrollContainer.nativeElement.getBoundingClientRect();
        return Math.min(box.startY, box.currentY) - rect.top;
    }

    getSelectionBoxWidth(): number {
        const box = this.selectionBox();
        if (!box) return 0;
        return Math.abs(box.currentX - box.startX);
    }

    getSelectionBoxHeight(): number {
        const box = this.selectionBox();
        if (!box) return 0;
        return Math.abs(box.currentY - box.startY);
    }

    reverseClip(clipId: string) {
        this.store.reverseClip(clipId);
        this.closeContextMenu();
    }

    deleteClip(clipId: string) {
        this.store.removeClip(clipId);
        this.closeContextMenu();
    }

    isVideoClip(clipId: string): boolean {
        const clip = this.store.clips().find((c) => c.id === clipId);
        return clip?.type === 'video';
    }

    isClipReversed(clipId: string): boolean {
        const clip = this.store.clips().find((c) => c.id === clipId);
        return !!clip?.isReversed;
    }
}
