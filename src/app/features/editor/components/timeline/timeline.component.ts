import {
    Component,
    inject,
    computed,
    ElementRef,
    ViewChild,
    HostListener,
    ChangeDetectionStrategy,
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
                <button (click)="zoomIn()">Zoom In</button>
                <button (click)="zoomOut()">Zoom Out</button>
                <button (click)="addTrack('video')">Add Video Track</button>
                <button (click)="addTrack('audio')">Add Audio Track</button>
            </div>

            <div class="timeline-content">
                <!-- Track Headers -->
                <div class="track-headers">
                    @for (track of store.tracks(); track track.id) {
                    <div
                        class="track-header"
                        (dragover)="onTrackDragOver($event, track)"
                        (drop)="onTrackDrop($event, track)"
                    >
                        {{ track.name }}
                    </div>
                    }
                </div>

                <!-- Tracks Area -->
                <div class="tracks-area" #tracksArea (click)="onTimelineClick($event)">
                    <!-- Playhead -->
                    <div class="playhead" [style.left.px]="getPlayheadPosition()"></div>

                    <!-- Tracks -->
                    @for (track of store.tracks(); track track.id) {
                    <div
                        class="track-lane"
                        (dragover)="onTrackDragOver($event, track)"
                        (drop)="onTrackDrop($event, track)"
                    >
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
                            {{ clip.name }}
                        </div>
                        }
                    </div>
                    }
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .timeline-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #1e1e1e;
                color: white;
                border-top: 1px solid #333;
            }
            .toolbar {
                height: 30px;
                border-bottom: 1px solid #333;
                display: flex;
                align-items: center;
                padding: 0 1rem;
                gap: 1rem;
            }
            .timeline-content {
                flex: 1;
                display: flex;
                overflow: hidden;
            }
            .track-headers {
                width: 150px;
                border-right: 1px solid #333;
                background: #252526;
            }
            .track-header {
                height: 50px;
                border-bottom: 1px solid #333;
                display: flex;
                align-items: center;
                padding: 0 1rem;
                font-size: 0.8rem;
            }
            .tracks-area {
                flex: 1;
                overflow-x: auto;
                position: relative;
                background: #1e1e1e;
            }
            .track-lane {
                height: 50px;
                border-bottom: 1px solid #333;
                position: relative;
            }
            .clip {
                position: absolute;
                top: 5px;
                height: 40px;
                background: #3a3d41;
                border: 1px solid #555;
                border-radius: 4px;
                padding: 0 0.5rem;
                font-size: 0.7rem;
                display: flex;
                align-items: center;
                overflow: hidden;
                white-space: nowrap;
                cursor: pointer;
                user-select: none;
                z-index: 1;
            }
            .clip.selected {
                border-color: #007acc;
                background: #264f78;
                z-index: 2;
            }
            .clip.dragging {
                opacity: 0.8;
                cursor: grabbing;
                z-index: 100;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
            }
            .playhead {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 2px;
                background: red;
                z-index: 10;
                pointer-events: none;
            }
        `,
    ],
})
export class TimelineComponent {
    store = inject(EditorStore);
    zoomLevel = 20; // pixels per second

    @ViewChild('tracksArea') tracksArea!: ElementRef;

    dragState: {
        clipId: string;
        startX: number;
        startStartTime: number;
        startTrackId: string;
    } | null = null;

    getClipsForTrack(trackId: string): Clip[] {
        return this.store.clips().filter((c) => c.trackId === trackId);
    }

    timeToPx(seconds: number): number {
        return seconds * this.zoomLevel;
    }

    pxToTime(px: number): number {
        return px / this.zoomLevel;
    }

    getPlayheadPosition(): number {
        return this.timeToPx(this.store.currentTime());
    }

    onTimelineClick(event: MouseEvent) {
        // If clicking on empty space, move playhead
        // We need to account for scroll position if we implement scrolling
        const rect = this.tracksArea.nativeElement.getBoundingClientRect();
        const clickX = event.clientX - rect.left + this.tracksArea.nativeElement.scrollLeft;
        const time = this.pxToTime(clickX);
        this.store.setCurrentTime(Math.max(0, time));
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
        const SNAP_THRESHOLD_PX = 15;
        const snapThreshold = this.pxToTime(SNAP_THRESHOLD_PX);
        let snapped = false;

        const otherClips = this.store.clips().filter((c) => c.id !== this.dragState!.clipId);

        for (const other of otherClips) {
            // Snap to end of other clip
            if (Math.abs(newStartTime - (other.startTime + other.duration)) < snapThreshold) {
                newStartTime = other.startTime + other.duration;
                snapped = true;
                break;
            }
            // Snap to start of other clip
            if (Math.abs(newStartTime - other.startTime) < snapThreshold) {
                newStartTime = other.startTime;
                snapped = true;
                break;
            }
        }

        // Update clip position horizontally
        this.store.updateClip(this.dragState.clipId, { startTime: newStartTime });
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        this.dragState = null;
    }

    // Track Drag & Drop (for moving clips between tracks)
    // Note: This is a simplified version. For full drag & drop between tracks while moving time,
    // we would need to calculate the track under the mouse in onMouseMove.
    // For now, let's rely on the user dragging the clip to the track lane.
    // However, since we are using absolute positioning for clips, the standard drag events might interfere
    // with our custom mouse move logic.
    // Let's implement track switching inside onMouseMove by checking elementFromPoint if needed,
    // or simpler: just allow horizontal move for now as requested "mover en el time line".
    // But user also said "acomodar una pista justo despues de otra", which implies horizontal.
    // If they want to move vertical, we can add that later or use a specific handle.
    //
    // Actually, to support vertical movement (changing tracks), we can check the Y position.
    // But since we don't have the track layout in memory easily, let's stick to horizontal + snapping first.
    // If the user needs to change tracks, they might expect to drag it up/down.

    // Let's try to implement basic track switching based on mouse Y relative to tracksArea
    // This requires knowing the track height (50px).

    onTrackDragOver(event: DragEvent, track: Track) {
        event.preventDefault();
    }

    onTrackDrop(event: DragEvent, track: Track) {
        // This handles native drag drop, but we are using custom mouse events.
        // So this might not fire if we don't set draggable="true".
    }

    zoomIn() {
        this.zoomLevel = Math.min(200, this.zoomLevel * 1.2);
    }

    zoomOut() {
        this.zoomLevel = Math.max(5, this.zoomLevel / 1.2);
    }

    addTrack(type: AssetType) {
        this.store.addTrack(type);
    }
}
