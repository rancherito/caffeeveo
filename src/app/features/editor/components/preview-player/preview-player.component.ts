import {
    Component,
    inject,
    effect,
    ElementRef,
    viewChild,
    OnDestroy,
    PLATFORM_ID,
    ChangeDetectionStrategy,
    AfterViewInit,
    ChangeDetectorRef,
    computed,
    signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { EditorStore } from '../../store/editor.store';
import { Asset, Clip } from '../../models/editor.models';

@Component({
    selector: 'preview-player',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <canvas
            #canvasElement
            class="preview-canvas"
            [width]="store.projectSettings().width"
            [height]="store.projectSettings().height"
        ></canvas>

        <!-- Hidden Audio Elements -->
        <div style="display: none;">
            @for (clip of activeAudioClips(); track clip.id) {
            <audio
                [src]="getAssetUrl(clip.assetId)"
                [id]="'audio-' + clip.id"
                class="audio-element"
            ></audio>
            }
        </div>

        <div class="controls">
            <button (click)="togglePlay()">
                {{ store.isPlaying() ? '⏸ Pause' : '▶ Play' }}
            </button>
            <span class="time"
                >{{ formatTime(store.currentTime()) }} /
                {{ formatTime(store.totalDuration()) }}</span
            >
        </div>
    `,
    styles: [
        `
            :host {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #000;
                overflow: hidden;
                position: relative;
            }
            .preview-canvas {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                background: #000;
                margin: auto;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            }
            .clip-info {
                position: absolute;
                top: 10px;
                left: 10px;
                color: #00ff00;
                background: rgba(0, 0, 0, 0.7);
                padding: 5px 10px;
                font-size: 12px;
                z-index: 10;
                font-family: monospace;
            }
            .controls {
                height: 50px;
                background: #222;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                color: white;
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10;
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
        `,
    ],
})
export class PreviewPlayerComponent implements AfterViewInit, OnDestroy {
    store = inject(EditorStore);
    private platformId = inject(PLATFORM_ID);
    private cdr = inject(ChangeDetectorRef);

    private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');

    private animationFrameId: number | null = null;
    private audioElements: Map<string, HTMLAudioElement> = new Map();
    private lastFrameTime: number | null = null;
    private startTime: number = 0;

    readonly currentFrame = signal(0);

    // Computed signals for active clips
    activeVisualClip = computed(() => {
        const time = this.store.currentTime();
        const allClips = this.store.clips();
        const clips = allClips.filter(
            (c) =>
                (c.type === 'video' || c.type === 'image') &&
                time >= c.startTime &&
                time < c.startTime + c.duration
        );
        const result = clips[clips.length - 1] || null;
        console.log('activeVisualClip computed at time', time, ':', result);
        return result;
    });

    activeAudioClips = computed(() => {
        const time = this.store.currentTime();
        return this.store
            .clips()
            .filter(
                (c) => c.type === 'audio' && time >= c.startTime && time < c.startTime + c.duration
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
            const visualClip = this.activeVisualClip();
            if (visualClip) {
                this.renderCurrentFrame();
            }
        });

        effect(() => {
            const clips = this.store.clips();
            console.log('clips changed, count:', clips.length, clips);
            this.cdr.markForCheck();
        });
    }

    ngAfterViewInit(): void {
        console.log('ngAfterViewInit');
        this.setupCanvas();
        setTimeout(() => {
            this.renderCurrentFrame();
            this.cdr.detectChanges();
        }, 100);
    }

    private setupCanvas(): void {
        const canvasEl = this.canvas().nativeElement;
        // Formato TikTok 9:16 (1080x1920)
        canvasEl.width = 1080;
        canvasEl.height = 1920;
    }

    getTotalFrames(clip: Clip): number {
        const asset = this.getAsset(clip.assetId);
        return asset?.totalFrames || 0;
    }

    private getAsset(assetId: string): Asset | undefined {
        return this.store.assets().find((a) => a.id === assetId);
    }

    private startPlayback(): void {
        this.lastFrameTime = performance.now();
        this.startTime = 0;
        this.loop();
    }

    private stopPlayback(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.pauseAllMedia();
    }

    private loop = (): void => {
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
            this.renderCurrentFrame();
            this.syncAudio(newTime);
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    };

    private renderCurrentFrame(): void {
        const clip = this.activeVisualClip();
        if (!clip) {
            this.clearCanvas();
            return;
        }

        const asset = this.getAsset(clip.assetId);
        if (!asset) return;

        const canvasEl = this.canvas().nativeElement;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;

        const time = this.store.currentTime();
        const clipTime = time - clip.startTime + (clip.offset || 0);

        if (clip.type === 'video' && asset.frames && asset.frames.length > 0) {
            const frameRate = asset.frameRate || 30;
            const frameIndex = Math.floor(clipTime * frameRate);
            const clampedIndex = Math.max(0, Math.min(frameIndex, asset.frames.length - 1));

            this.currentFrame.set(clampedIndex);

            const frame = asset.frames[clampedIndex];
            if (frame) {
                this.renderFrameToCanvas(ctx, frame, canvasEl.width, canvasEl.height, clip);
            }
        } else if (clip.type === 'image') {
            // Renderizar imagen
            const img = new Image();
            img.src = asset.url;
            img.onload = () => {
                this.renderFrameToCanvas(ctx, img, canvasEl.width, canvasEl.height, clip);
            };
        }
    }

    private renderFrameToCanvas(
        ctx: CanvasRenderingContext2D,
        source: ImageBitmap | HTMLImageElement,
        canvasWidth: number,
        canvasHeight: number,
        clip: Clip
    ): void {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const canvasAspect = canvasWidth / canvasHeight;
        const sourceAspect = source.width / source.height;

        let drawWidth, drawHeight, offsetX, offsetY;

        // Ajuste tipo "cover" para formato TikTok
        if (sourceAspect > canvasAspect) {
            drawHeight = canvasHeight;
            drawWidth = drawHeight * sourceAspect;
            offsetX = (canvasWidth - drawWidth) / 2;
            offsetY = 0;
        } else {
            drawWidth = canvasWidth;
            drawHeight = drawWidth / sourceAspect;
            offsetX = 0;
            offsetY = (canvasHeight - drawHeight) / 2;
        }

        // Aplicar transformaciones del clip
        ctx.save();
        ctx.globalAlpha = clip.opacity || 1;

        const centerX = canvasWidth / 2 + (clip.x || 0);
        const centerY = canvasHeight / 2 + (clip.y || 0);

        ctx.translate(centerX, centerY);
        ctx.rotate(((clip.rotation || 0) * Math.PI) / 180);
        ctx.scale(clip.scale || 1, clip.scale || 1);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore();
    }

    private clearCanvas(): void {
        const canvasEl = this.canvas().nativeElement;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
        }
    }

    private syncAudio(time: number): void {
        const audioClips = this.activeAudioClips();
        audioClips.forEach((clip) => {
            const audioEl = this.getOrCreateAudioElement(clip.id, this.getAssetUrl(clip.assetId));
            const clipTime = time - clip.startTime + (clip.offset || 0);

            if (audioEl.paused) {
                audioEl.currentTime = clipTime;
                audioEl.play().catch((e: Error) => console.warn('Audio play failed:', e));
            }
        });
    }

    private pauseAllMedia(): void {
        this.audioElements.forEach((audio) => audio.pause());
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

    togglePlay(): void {
        this.lastFrameTime = null;
        this.store.togglePlay();
    }

    getAssetUrl(assetId: string): string {
        const asset = this.store.assets().find((a) => a.id === assetId);
        const url = asset?.url || '';
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
        this.audioElements.forEach((audio) => audio.pause());
        this.audioElements.clear();
    }
}
