export interface VideoMetadata {
  id: string;
  file: File;
  duration: number;
  width: number;
  height: number;
  size: number;
  type: string;
  name: string;
  url: string;
  frames: ImageBitmap[];
  frameRate: number;
  totalFrames: number;
  isProcessing: boolean;
  processingProgress: number;
}

export interface VideoPlayerState {
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  totalDuration: number;
  currentTime: number;
  currentFrame: number;
}

export interface FrameExtractionProgress {
  videoId: string;
  currentFrame: number;
  totalFrames: number;
  percentage: number;
}
