import { Component, inject, effect, ElementRef, ViewChild, OnDestroy, PLATFORM_ID, ChangeDetectionStrategy, AfterViewInit, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { EditorStore } from '../../store/editor.store';

@Component({
    selector: 'app-preview-player',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="preview-container">
            <div class="screen">
                @if (activeVisualClip(); as clip) {
                    <div class="clip-info">Clip: {{ clip.name }} ({{ clip.type }})</div>
                    @if (clip.type === 'video') {
                        <video 
                            #videoElement
                            [src]="getAssetUrl(clip.assetId)"
                            class="media-display"
                            playsinline
                            (loadedmetadata)="onVideoLoaded($event)"
                            (error)="onVideoError($event)">
                        </video>
                    } @else if (clip.type === 'image') {
                        <img 
                            [src]="getAssetUrl(clip.assetId)"
                            class="media-display"
                            alt="Preview">
                    }
                } @else {
                    <div class="no-content">Sin contenido en tiempo {{ formatTime(store.currentTime()) }}</div>
                }
            </div>
            
            <!-- Hidden Audio Elements -->
            <div style="display: none;">
                @for (clip of activeAudioClips(); track clip.id) {
                    <audio 
                        [src]="getAssetUrl(clip.assetId)"
                        [id]="'audio-' + clip.id"
                        class="audio-element">
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
            overflow: hidden;
        }
        .screen {
            flex: 1;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1a1a1a;
        }
        .clip-info {
            position: absolute;
            top: 10px;
            left: 10px;
            color: #00ff00;
            background: rgba(0,0,0,0.7);
            padding: 5px 10px;
            font-size: 12px;
            z-index: 10;
        }
        .media-display {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
            background: #000;
            border: 2px solid #00ff00;
        }
        .no-content {
            color: #666;
            font-size: 18px;
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
        button {
            padding: 0.5rem 1rem;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        }
        button:hover {
            background: #0052a3;
        }
        button:active {
            background: #003d7a;
        }
        .time {
            font-family: monospace;
            font-size: 14px;
        }
    `]
})
export class PreviewPlayerComponent implements AfterViewInit, OnDestroy {
    store = inject(EditorStore);
    private platformId = inject(PLATFORM_ID);
    private cdr = inject(ChangeDetectorRef);

    @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

    private animationFrameId: number | null = null;
    private audioElements: Map<string, HTMLAudioElement> = new Map();
    private lastFrameTime: number | null = null;

    // Computed signals for active clips
    activeVisualClip = computed(() => {
        const time = this.store.currentTime();
        const allClips = this.store.clips();
        const clips = allClips.filter(c =>
            (c.type === 'video' || c.type === 'image') &&
            time >= c.startTime && time < c.startTime + c.duration
        );
        const result = clips[clips.length - 1] || null;
        console.log('activeVisualClip computed at time', time, ':', result);
        return result;
    });

    activeAudioClips = computed(() => {
        const time = this.store.currentTime();
        return this.store.clips().filter(c =>
            c.type === 'audio' &&
            time >= c.startTime && time < c.startTime + c.duration
        );
    });

    constructor() {
        console.log('PreviewPlayerComponent constructor');
        if (!isPlatformBrowser(this.platformId)) return;

        effect(() => {
            const isPlaying = this.store.isPlaying();
            console.log('isPlaying changed:', isPlaying);
            if (isPlaying) {
                this.startPlayback();
            } else {
                this.stopPlayback();
            }
        });

        effect(() => {
            const time = this.store.currentTime();
            console.log('currentTime changed:', time);
            if (!this.store.isPlaying()) {
                this.seek(time);
            }
        });

        effect(() => {
            const clips = this.store.clips();
            console.log('clips changed, count:', clips.length, clips);
            this.cdr.markForCheck();
        });
    }

    ngAfterViewInit(): void {
        console.log('ngAfterViewInit, videoElement:', this.videoElement);
        console.log('Current time:', this.store.currentTime());
        console.log('Total clips:', this.store.clips().length);
        setTimeout(() => {
            this.seek(this.store.currentTime());
            this.cdr.detectChanges();
        }, 100);
    }

    private startPlayback(): void {
        this.lastFrameTime = performance.now();
        this.loop();
    }

    private stopPlayback(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.pauseAllMedia();
    }

    private loop(): void {
        if (!this.store.isPlaying()) return;

        const now = performance.now();
        const delta = (now - (this.lastFrameTime || now)) / 1000;
        this.lastFrameTime = now;

        const currentTime = this.store.currentTime();
        const newTime = currentTime + delta;

        if (newTime >= this.store.totalDuration()) {
            this.store.setCurrentTime(this.store.totalDuration());
            this.store.togglePlay();
        } else {
            this.store.setCurrentTime(newTime);
            this.syncMedia(newTime);
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        }
    }

    private syncMedia(time: number): void {
        // Sync video
        const videoClip = this.activeVisualClip();
        if (videoClip?.type === 'video' && this.videoElement) {
            const video = this.videoElement.nativeElement;
            const clipTime = (time - videoClip.startTime) + videoClip.offset;

            if (video.paused) {
                video.currentTime = clipTime;
                video.play().catch(e => console.warn('Video play failed:', e));
            } else if (Math.abs(video.currentTime - clipTime) > 0.1) {
                video.currentTime = clipTime;
            }
        }

        // Sync audio
        const audioClips = this.activeAudioClips();
        audioClips.forEach(clip => {
            const audioEl = this.getOrCreateAudioElement(clip.id, this.getAssetUrl(clip.assetId));
            const clipTime = (time - clip.startTime) + clip.offset;

            if (audioEl.paused) {
                audioEl.currentTime = clipTime;
                audioEl.play().catch(e => console.warn('Audio play failed:', e));
            }
        });
    }

    private seek(time: number): void {
        console.log('Seeking to time:', time);
        const visualClip = this.activeVisualClip();
        
        if (this.videoElement && visualClip?.type === 'video') {
            const video = this.videoElement.nativeElement;
            const clipTime = (time - visualClip.startTime) + visualClip.offset;
            console.log('Setting video time to:', clipTime, 'video src:', video.src);
            video.currentTime = clipTime;
        }

        const audioClips = this.activeAudioClips();
        audioClips.forEach(clip => {
            const audioEl = this.getOrCreateAudioElement(clip.id, this.getAssetUrl(clip.assetId));
            audioEl.currentTime = (time - clip.startTime) + clip.offset;
        });
    }

    private pauseAllMedia(): void {
        if (this.videoElement) {
            this.videoElement.nativeElement.pause();
        }
        this.audioElements.forEach(audio => audio.pause());
    }

    private getOrCreateAudioElement(clipId: string, url: string): HTMLAudioElement {
        if (!this.audioElements.has(clipId)) {
            const audio = new Audio();
            audio.src = url;
            audio.muted = false;
            this.audioElements.set(clipId, audio);
        }
        return this.audioElements.get(clipId)!;
    }

    onVideoLoaded(event: Event): void {
        const video = event.target as HTMLVideoElement;
        console.log('Video loaded!', {
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            src: video.src
        });
    }

    onVideoError(event: Event): void {
        const video = event.target as HTMLVideoElement;
        console.error('Video error!', video.error, video.src);
    }

    togglePlay(): void {
        this.lastFrameTime = null;
        this.store.togglePlay();
    }

    getAssetUrl(assetId: string): string {
        const asset = this.store.assets().find(a => a.id === assetId);
        const url = asset?.url || '';
        console.log('getAssetUrl for', assetId, ':', url);
        return url;
    }

    formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    ngOnDestroy(): void {
        this.stopPlayback();
        this.audioElements.forEach(audio => audio.pause());
        this.audioElements.clear();
    }
}
