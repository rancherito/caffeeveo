import { Component, signal, effect, inject, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoQueueService } from '../../services/video-queue.service';

@Component({
  selector: 'app-canvas-player',
  imports: [CommonModule],
  template: `
    <div class="canvas-player">
      <canvas #canvasElement class="video-canvas"></canvas>
      
      @if (currentVideo() && currentVideo()!.isProcessing) {
        <div class="processing-overlay">
          <div class="processing-content">
            <div class="spinner"></div>
            <p>Procesando frames...</p>
            <p class="progress-text">{{ currentVideo()!.processingProgress.toFixed(0) }}%</p>
          </div>
        </div>
      }
      
      <div class="controls">
        <button 
          (click)="togglePlay()" 
          [disabled]="!canPlay()">
          {{ isPlaying() ? '⏸ Pausar' : '▶ Reproducir' }}
        </button>
        
        <button 
          (click)="previous()" 
          [disabled]="!hasPrevious()">
          ⏮ Anterior
        </button>
        
        <button 
          (click)="next()" 
          [disabled]="!hasNext()">
          Siguiente ⏭
        </button>
        
        <div class="progress-info">
          <span>Video {{ currentIndex() + 1 }} de {{ totalVideos() }}</span>
          <span>Frame {{ currentFrame() }} / {{ totalFrames() }}</span>
          <span>{{ formatTime(currentTime()) }} / {{ formatTime(currentDuration()) }}</span>
        </div>
      </div>
      
      <div class="progress-bar" (click)="seek($event)">
        <div 
          class="progress-fill" 
          [style.width.%]="progressPercent()">
        </div>
      </div>
    </div>
  `,
  styles: [`
    .canvas-player {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      position: relative;
    }

    .video-canvas {
      width: 100%;
      aspect-ratio: 9 / 16;
      background: #000;
      border-radius: 8px;
      display: block;
    }

    .processing-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 60px;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      z-index: 10;
    }

    .processing-content {
      text-align: center;
      color: white;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .progress-text {
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0.5rem 0;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      background: #007bff;
      color: white;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }

    button:hover:not(:disabled) {
      background: #0056b3;
    }

    button:disabled {
      background: #6c757d;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .progress-info {
      margin-left: auto;
      display: flex;
      gap: 1rem;
      font-size: 0.9rem;
      color: #666;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e0e0e0;
      border-radius: 3px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #007bff;
      transition: width 0.1s linear;
    }
  `]
})
export class CanvasPlayerComponent {
  private videoQueueService = inject(VideoQueueService);
  
  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  
  readonly currentVideo = this.videoQueueService.currentVideo;
  readonly state = this.videoQueueService.state;
  readonly hasNext = this.videoQueueService.hasNext;
  readonly hasPrevious = this.videoQueueService.hasPrevious;
  
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly currentDuration = signal(0);
  readonly currentIndex = signal(0);
  readonly totalVideos = signal(0);
  readonly currentFrame = signal(0);
  readonly totalFrames = signal(0);
  
  readonly progressPercent = signal(0);
  
  readonly canPlay = () => {
    const video = this.currentVideo();
    return video && !video.isProcessing && video.frames.length > 0;
  };

  constructor() {
    // Sincronizar estado cuando cambia el video
    effect(() => {
      const video = this.currentVideo();
      if (video) {
        this.loadVideo(video);
      }
    });

    effect(() => {
      this.currentIndex.set(this.state().currentIndex);
      this.totalVideos.set(this.videoQueueService.videoList().length);
    });
  }

  private loadVideo(video: any): void {
    this.stopPlayback();
    
    this.currentDuration.set(video.duration);
    this.totalFrames.set(video.totalFrames);
    this.currentTime.set(0);
    this.currentFrame.set(0);
    this.progressPercent.set(0);
    this.isPlaying.set(false);
    
    this.setupCanvas(video);
    
    // Renderizar el primer frame
    if (video.frames.length > 0) {
      this.renderFrameAtIndex(0);
    }
  }

  private setupCanvas(video: any): void {
    const canvasEl = this.canvas().nativeElement;
    
    // Formato TikTok: 9:16 (1080x1920 o proporcional)
    const targetWidth = 1080;
    const targetHeight = 1920;
    
    canvasEl.width = targetWidth;
    canvasEl.height = targetHeight;
  }

  private renderFrameAtIndex(frameIndex: number): void {
    const video = this.currentVideo();
    if (!video || video.frames.length === 0) return;
    
    // Asegurar que el índice esté en rango
    const clampedIndex = Math.max(0, Math.min(frameIndex, video.frames.length - 1));
    
    const canvasEl = this.canvas().nativeElement;
    const ctx = canvasEl.getContext('2d');
    
    if (ctx && video.frames[clampedIndex]) {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      
      const frame = video.frames[clampedIndex];
      const canvasAspect = canvasEl.width / canvasEl.height; // 9:16 = 0.5625
      const frameAspect = frame.width / frame.height;
      
      let drawWidth, drawHeight, offsetX, offsetY;
      
      // Ajuste tipo "cover" - rellena todo el canvas
      if (frameAspect > canvasAspect) {
        // Video más ancho que el canvas - ajustar por altura
        drawHeight = canvasEl.height;
        drawWidth = drawHeight * frameAspect;
        offsetX = (canvasEl.width - drawWidth) / 2;
        offsetY = 0;
      } else {
        // Video más alto o igual - ajustar por ancho
        drawWidth = canvasEl.width;
        drawHeight = drawWidth / frameAspect;
        offsetX = 0;
        offsetY = (canvasEl.height - drawHeight) / 2;
      }
      
      ctx.drawImage(frame, offsetX, offsetY, drawWidth, drawHeight);
    }
  }

  private animate = (timestamp: number): void => {
    if (!this.isPlaying()) return;
    
    const video = this.currentVideo();
    if (!video || video.frames.length === 0) return;
    
    if (this.startTime === 0) {
      this.startTime = timestamp;
    }
    
    // Calcular tiempo transcurrido
    const elapsed = (timestamp - this.startTime) / 1000;
    const newTime = this.currentTime() + elapsed;
    
    // Verificar si el video terminó
    if (newTime >= video.duration) {
      this.currentTime.set(video.duration);
      this.isPlaying.set(false);
      
      if (this.hasNext()) {
        this.next();
      } else {
        this.pause();
      }
      return;
    }
    
    // Actualizar tiempo y calcular frame correspondiente
    this.currentTime.set(newTime);
    const frameIndex = Math.floor(newTime * video.frameRate);
    this.currentFrame.set(frameIndex);
    
    // Actualizar progreso
    const percent = (newTime / video.duration) * 100;
    this.progressPercent.set(percent);
    
    // Actualizar en el servicio
    this.videoQueueService.updateCurrentTime(newTime);
    this.videoQueueService.updateCurrentFrame(frameIndex);
    
    // Renderizar frame
    this.renderFrameAtIndex(frameIndex);
    
    this.startTime = timestamp;
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    if (!this.canPlay()) return;
    
    this.isPlaying.set(true);
    this.videoQueueService.setPlaying(true);
    this.startTime = 0; // Reset para el próximo frame
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  pause(): void {
    this.isPlaying.set(false);
    this.videoQueueService.setPlaying(false);
    this.stopPlayback();
  }

  next(): void {
    this.stopPlayback();
    this.videoQueueService.next();
  }

  previous(): void {
    this.stopPlayback();
    this.videoQueueService.previous();
  }

  seek(event: MouseEvent): void {
    const video = this.currentVideo();
    if (!video || video.frames.length === 0) return;
    
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const time = percent * video.duration;
    
    // Calcular el frame correspondiente
    const frameIndex = Math.floor(time * video.frameRate);
    
    this.currentTime.set(time);
    this.currentFrame.set(frameIndex);
    this.progressPercent.set(percent * 100);
    
    this.videoQueueService.updateCurrentTime(time);
    this.videoQueueService.updateCurrentFrame(frameIndex);
    
    // Renderizar el frame en esa posición
    this.renderFrameAtIndex(frameIndex);
  }

  private stopPlayback(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.startTime = 0;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
