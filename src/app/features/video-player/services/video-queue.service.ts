import { Injectable, signal, computed } from '@angular/core';
import type { VideoMetadata, VideoPlayerState, FrameExtractionProgress } from '../models/video.models';

@Injectable({
  providedIn: 'root'
})
export class VideoQueueService {
  private videos = signal<VideoMetadata[]>([]);
  private playerState = signal<VideoPlayerState>({
    currentIndex: 0,
    isPlaying: false,
    progress: 0,
    totalDuration: 0,
    currentTime: 0,
    currentFrame: 0
  });
  private extractionProgress = signal<FrameExtractionProgress | null>(null);

  readonly videoList = this.videos.asReadonly();
  readonly state = this.playerState.asReadonly();
  readonly progress = this.extractionProgress.asReadonly();
  
  readonly currentVideo = computed(() => {
    const videos = this.videos();
    const index = this.playerState().currentIndex;
    return videos[index] || null;
  });

  readonly hasNext = computed(() => {
    return this.playerState().currentIndex < this.videos().length - 1;
  });

  readonly hasPrevious = computed(() => {
    return this.playerState().currentIndex > 0;
  });

  async addVideos(files: FileList | File[]): Promise<void> {
    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter(file => file.type.startsWith('video/'));
    
    for (const file of videoFiles) {
      const metadata = await this.extractVideoMetadata(file);
      this.videos.update(current => [...current, metadata]);
      this.updateTotalDuration();
      
      // Extraer frames en segundo plano
      this.extractFrames(metadata.id);
    }
  }

  private async extractVideoMetadata(file: File): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        // Calcular frame rate (usualmente 30 fps para editores de video)
        const frameRate = 30;
        const totalFrames = Math.ceil(video.duration * frameRate);
        
        resolve({
          id: crypto.randomUUID(),
          file,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size,
          type: file.type,
          name: file.name,
          url,
          frames: [],
          frameRate,
          totalFrames,
          isProcessing: true,
          processingProgress: 0
        });
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Error al cargar el video: ${file.name}`));
      };
      
      video.src = url;
    });
  }

  private async extractFrames(videoId: string): Promise<void> {
    const videoIndex = this.videos().findIndex(v => v.id === videoId);
    if (videoIndex === -1) return;
    
    const videoData = this.videos()[videoIndex];
    const video = document.createElement('video');
    video.src = videoData.url;
    video.muted = true;
    
    await new Promise((resolve) => {
      video.onloadeddata = resolve;
      video.load();
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = videoData.width;
    canvas.height = videoData.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    const frames: ImageBitmap[] = [];
    const frameInterval = 1 / videoData.frameRate;
    
    for (let i = 0; i < videoData.totalFrames; i++) {
      const time = i * frameInterval;
      
      // Actualizar progreso
      this.extractionProgress.set({
        videoId,
        currentFrame: i + 1,
        totalFrames: videoData.totalFrames,
        percentage: ((i + 1) / videoData.totalFrames) * 100
      });
      
      await new Promise<void>((resolve) => {
        video.currentTime = time;
        video.onseeked = () => resolve();
      });
      
      // Dibujar frame en canvas y convertir a ImageBitmap
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBitmap = await createImageBitmap(canvas);
      frames.push(imageBitmap);
      
      // Actualizar el video con el frame
      this.videos.update(current => {
        const updated = [...current];
        updated[videoIndex] = {
          ...updated[videoIndex],
          frames: [...frames],
          processingProgress: ((i + 1) / videoData.totalFrames) * 100
        };
        return updated;
      });
    }
    
    // Marcar como procesado
    this.videos.update(current => {
      const updated = [...current];
      updated[videoIndex] = {
        ...updated[videoIndex],
        isProcessing: false,
        processingProgress: 100
      };
      return updated;
    });
    
    this.extractionProgress.set(null);
  }

  removeVideo(id: string): void {
    const videos = this.videos();
    const index = videos.findIndex(v => v.id === id);
    
    if (index !== -1) {
      // Limpiar ImageBitmaps
      videos[index].frames.forEach(frame => frame.close());
      URL.revokeObjectURL(videos[index].url);
      this.videos.update(current => current.filter(v => v.id !== id));
      
      if (this.playerState().currentIndex >= index && this.playerState().currentIndex > 0) {
        this.playerState.update(state => ({
          ...state,
          currentIndex: state.currentIndex - 1
        }));
      }
      
      this.updateTotalDuration();
    }
  }

  clearVideos(): void {
    this.videos().forEach(video => {
      video.frames.forEach(frame => frame.close());
      URL.revokeObjectURL(video.url);
    });
    this.videos.set([]);
    this.playerState.set({
      currentIndex: 0,
      isPlaying: false,
      progress: 0,
      totalDuration: 0,
      currentTime: 0,
      currentFrame: 0
    });
  }

  next(): void {
    if (this.hasNext()) {
      this.playerState.update(state => ({
        ...state,
        currentIndex: state.currentIndex + 1,
        progress: 0
      }));
    }
  }

  previous(): void {
    if (this.hasPrevious()) {
      this.playerState.update(state => ({
        ...state,
        currentIndex: state.currentIndex - 1,
        progress: 0
      }));
    }
  }

  setPlaying(isPlaying: boolean): void {
    this.playerState.update(state => ({ ...state, isPlaying }));
  }

  updateProgress(progress: number): void {
    this.playerState.update(state => ({ ...state, progress }));
  }

  updateCurrentTime(time: number): void {
    this.playerState.update(state => ({ ...state, currentTime: time }));
  }

  updateCurrentFrame(frame: number): void {
    this.playerState.update(state => ({ ...state, currentFrame: frame }));
  }

  setCurrentIndex(index: number): void {
    if (index >= 0 && index < this.videos().length) {
      this.playerState.update(state => ({
        ...state,
        currentIndex: index,
        progress: 0
      }));
    }
  }

  private updateTotalDuration(): void {
    const total = this.videos().reduce((sum, video) => sum + video.duration, 0);
    this.playerState.update(state => ({ ...state, totalDuration: total }));
  }
}
