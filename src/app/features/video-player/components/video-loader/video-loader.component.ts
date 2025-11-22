import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasPlayerComponent } from '../canvas-player/canvas-player.component';
import { VideoQueueService } from '../../services/video-queue.service';

@Component({
    selector: 'video-loader',
    imports: [CommonModule],
    template: `
        <div class="video-loader">
            <div class="upload-area" (click)="fileInput.click()">
                <input
                    #fileInput
                    type="file"
                    accept="video/*"
                    multiple
                    (change)="onFilesSelected($event)"
                    style="display: none"
                />

                <div class="upload-content">
                    <span class="upload-icon">📹</span>
                    <h3>Cargar Videos</h3>
                    <p>Click para seleccionar videos o arrastra aquí</p>
                    <p class="hint">Soporta MP4, WebM, MOV, etc.</p>
                </div>
            </div>

            @if (videos().length > 0) {
            <div class="video-list">
                <div class="list-header">
                    <h3>Videos cargados ({{ videos().length }})</h3>
                    <button (click)="clearAll()" class="btn-clear">🗑️ Limpiar todo</button>
                </div>

                @for (video of videos(); track video.id) {
                <div
                    class="video-item"
                    [class.active]="isCurrentVideo(video.id)"
                    [class.processing]="video.isProcessing"
                >
                    <div class="video-info">
                        <span class="video-name">{{ video.name }}</span>
                        <span class="video-meta">
                            {{ formatDuration(video.duration) }} · {{ video.width }}x{{
                                video.height
                            }}
                            ·
                            {{ formatSize(video.size) }}
                            @if (video.isProcessing) { · Procesando frames... } @else { ·
                            {{ video.frames.length }} frames }
                        </span>
                        @if (video.isProcessing) {
                        <div class="processing-bar">
                            <div
                                class="processing-fill"
                                [style.width.%]="video.processingProgress"
                            ></div>
                        </div>
                        }
                    </div>
                    <div class="video-actions">
                        <button
                            (click)="playVideo($index)"
                            class="btn-play"
                            [disabled]="video.isProcessing"
                        >
                            ▶
                        </button>
                        <button (click)="removeVideo(video.id)" class="btn-remove">✕</button>
                    </div>
                </div>
                }

                <div class="total-duration">
                    Duración total: {{ formatDuration(totalDuration()) }}
                </div>
            </div>
            }
        </div>
    `,
    styles: [
        `
            .video-loader {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            .upload-area {
                border: 2px dashed #007bff;
                border-radius: 8px;
                padding: 3rem;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s;
                background: #f8f9fa;
            }

            .upload-area:hover {
                border-color: #0056b3;
                background: #e7f3ff;
            }

            .upload-content {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                align-items: center;
            }

            .upload-icon {
                font-size: 3rem;
            }

            .upload-content h3 {
                margin: 0;
                color: #333;
            }

            .upload-content p {
                margin: 0;
                color: #666;
            }

            .hint {
                font-size: 0.85rem;
                color: #999;
            }

            .video-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .list-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }

            .list-header h3 {
                margin: 0;
                color: #333;
            }

            .btn-clear {
                padding: 0.4rem 0.8rem;
                border: none;
                border-radius: 4px;
                background: #dc3545;
                color: white;
                cursor: pointer;
                font-size: 0.85rem;
            }

            .btn-clear:hover {
                background: #c82333;
            }

            .video-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                transition: all 0.2s;
            }

            .video-item:hover {
                border-color: #007bff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .video-item.active {
                border-color: #28a745;
                background: #f1f8f4;
            }

            .video-item.processing {
                opacity: 0.7;
            }

            .video-info {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
                flex: 1;
            }

            .video-name {
                font-weight: 500;
                color: #333;
            }

            .video-meta {
                font-size: 0.85rem;
                color: #666;
            }

            .processing-bar {
                width: 100%;
                height: 4px;
                background: #e0e0e0;
                border-radius: 2px;
                margin-top: 0.5rem;
                overflow: hidden;
            }

            .processing-fill {
                height: 100%;
                background: linear-gradient(90deg, #007bff, #0056b3);
                transition: width 0.3s ease;
            }

            .video-actions {
                display: flex;
                gap: 0.5rem;
            }

            .btn-play,
            .btn-remove {
                width: 32px;
                height: 32px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.9rem;
            }

            .btn-play {
                background: #007bff;
                color: white;
            }

            .btn-play:hover:not(:disabled) {
                background: #0056b3;
            }

            .btn-play:disabled {
                background: #6c757d;
                cursor: not-allowed;
                opacity: 0.6;
            }

            .btn-remove {
                background: #6c757d;
                color: white;
            }

            .btn-remove:hover {
                background: #545b62;
            }

            .total-duration {
                padding: 0.75rem;
                background: #e7f3ff;
                border-radius: 4px;
                text-align: center;
                font-weight: 500;
                color: #0056b3;
            }
        `,
    ],
})
export class VideoLoaderComponent {
    private videoQueueService = inject(VideoQueueService);

    readonly videos = this.videoQueueService.videoList;
    readonly state = this.videoQueueService.state;

    readonly totalDuration = signal(0);

    constructor() {
        // Actualizar duración total cuando cambien los videos
        this.videoQueueService.videoList;
    }

    async onFilesSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        try {
            await this.videoQueueService.addVideos(input.files);
            this.updateTotalDuration();
            input.value = ''; // Reset input
        } catch (error) {
            console.error('Error al cargar videos:', error);
            alert('Error al cargar algunos videos. Por favor, intenta de nuevo.');
        }
    }

    removeVideo(id: string): void {
        this.videoQueueService.removeVideo(id);
        this.updateTotalDuration();
    }

    clearAll(): void {
        if (confirm('¿Estás seguro de que quieres eliminar todos los videos?')) {
            this.videoQueueService.clearVideos();
            this.totalDuration.set(0);
        }
    }

    playVideo(index: number): void {
        this.videoQueueService.setCurrentIndex(index);
    }

    isCurrentVideo(id: string): boolean {
        const current = this.videoQueueService.currentVideo();
        return current?.id === id;
    }

    formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatSize(bytes: number): string {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    private updateTotalDuration(): void {
        const total = this.videos().reduce((sum, video) => sum + video.duration, 0);
        this.totalDuration.set(total);
    }
}
