import { Component, inject, effect, ElementRef, ViewChild, OnDestroy, PLATFORM_ID, ChangeDetectionStrategy, ViewChildren, QueryList } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { EditorStore } from '../../store/editor.store';
import { Clip } from '../../models/editor.models';

@Component({
    selector: 'app-preview-player',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="preview-container">
            <div class="screen">
                <!-- Render active visual clips -->
                @for (clip of activeVisualClips(); track clip.id) {
                    <div class="clip-layer" [style.z-index]="getTrackIndex(clip.trackId)">
                        @if (clip.type === 'video') {
                            <video [src]="getAssetUrl(clip.assetId)" 
                                   class="media-element visual-media"
                                   [id]="'media-' + clip.id">
                            </video>
                        } @else if (clip.type === 'image') {
                            <img [src]="getAssetUrl(clip.assetId)" class="media-element">
                        }
                    </div>
                }
            </div>
            
            <!-- Hidden Audio Elements -->
            <div class="audio-container" style="display: none;">
                @for (clip of activeAudioClips(); track clip.id) {
                    <audio [src]="getAssetUrl(clip.assetId)"
                           class="media-element audio-media"
                           [id]="'media-' + clip.id">
                    </audio>
                }
            </div>

            <div class="controls">
                <button (click)="togglePlay()">{{ store.isPlaying() ? 'Pause' : 'Play' }}</button>
                <span class="time">{{ formatTime(store.currentTime()) }}</span>
            </div>
        </div>
    `,
    styles: [`
        .preview-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #000;
        }
        .screen {
            flex: 1;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .clip-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none; 
        }
        .media-element {
            max-width: 100%;
            max-height: 100%;
        }
        .controls {
            height: 50px;
            background: #222;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            color: white;
        }
    `]
})
export class PreviewPlayerComponent implements OnDestroy {
    store = inject(EditorStore);
    private platformId = inject(PLATFORM_ID);
    private animationFrameId: number | null = null;
    private lastTime: number = 0;

    constructor() {
        // Effect to handle playback loop
        effect(() => {
            if (!isPlatformBrowser(this.platformId)) return;

            if (this.store.isPlaying()) {
                this.lastTime = performance.now();
                this.loop();
            } else {
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                // Pause all media when stopping
                this.pauseAllMedia();
            }
        });

        // Effect for scrubbing (when paused)
        effect(() => {
            const time = this.store.currentTime();
            const isPlaying = this.store.isPlaying();
            
            if (!isPlaying && isPlatformBrowser(this.platformId)) {
                // Use setTimeout to allow DOM to update with new active clips
                setTimeout(() => {
                    this.syncMedia(time);
                }, 0);
            }
        });
    }

    loop() {
        if (!isPlatformBrowser(this.platformId)) return;
        
        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;

        const newTime = this.store.currentTime() + delta;
        
        if (newTime >= this.store.totalDuration()) {
            this.store.togglePlay(); // Stop at end
            this.store.setCurrentTime(0); // Reset or stay at end
        } else {
            this.store.setCurrentTime(newTime);
            this.syncMedia(newTime);
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        }
    }

    syncMedia(globalTime: number) {
        // Find all media elements in the DOM
        const mediaElements = document.querySelectorAll('.media-element') as NodeListOf<HTMLMediaElement>;
        
        mediaElements.forEach(el => {
            if (el.tagName === 'IMG') return;

            const clipId = el.id.replace('media-', '');
            const clip = this.store.clips().find(c => c.id === clipId);
            
            if (clip) {
                const targetTime = (globalTime - clip.startTime) + clip.offset;
                
                // If the element is not playing, play it
                if (el.paused) {
                    el.play().catch(() => {}); // Ignore play errors (e.g. user interaction required)
                }

                // Sync if drifted too much (> 0.2s)
                if (Math.abs(el.currentTime - targetTime) > 0.2) {
                    el.currentTime = targetTime;
                }
            }
        });
    }

    pauseAllMedia() {
        const mediaElements = document.querySelectorAll('.media-element') as NodeListOf<HTMLMediaElement>;
        mediaElements.forEach(el => {
            if (el.tagName !== 'IMG' && !el.paused) {
                el.pause();
            }
        });
    }

    activeVisualClips() {
        const time = this.store.currentTime();
        return this.store.clips().filter(c => 
            (c.type === 'video' || c.type === 'image') &&
            time >= c.startTime && 
            time < (c.startTime + c.duration)
        );
    }

    activeAudioClips() {
        const time = this.store.currentTime();
        return this.store.clips().filter(c => 
            c.type === 'audio' &&
            time >= c.startTime && 
            time < (c.startTime + c.duration)
        );
    }

    getTrackIndex(trackId: string): number {
        return this.store.tracks().findIndex(t => t.id === trackId);
    }

    getAssetUrl(assetId: string): string {
        const asset = this.store.assets().find(a => a.id === assetId);
        return asset ? asset.url : '';
    }

    getCurrentClipTime(clip: Clip): number {
        // Calculate where we are in the clip source
        // (Current Timeline Time - Clip Start Time) + Clip Offset
        return (this.store.currentTime() - clip.startTime) + clip.offset;
    }

    togglePlay() {
        this.store.togglePlay();
    }

    formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    ngOnDestroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}
