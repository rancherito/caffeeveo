export type AssetType = 'video' | 'image' | 'audio';

export interface Asset {
    id: string;
    name: string;
    type: AssetType;
    url: string;
    duration?: number; // in seconds
    thumbnail?: string;
    // Frame-based video handling
    frames?: ImageBitmap[];
    frameRate?: number;
    totalFrames?: number;
    width?: number;
    height?: number;
    size?: number;
    isProcessing?: boolean;
    processingProgress?: number;
}

export interface Clip {
    id: string;
    assetId: string;
    startTime: number; // where it starts on the timeline (seconds)
    duration: number; // how long it plays (seconds)
    offset: number; // start point within the source asset (seconds)
    trackId: string;
    name: string;
    type: AssetType;
    // Transform properties for video editing
    scale?: number;
    rotation?: number;
    opacity?: number;
    x?: number;
    y?: number;
    isReversed?: boolean;
}

export interface Track {
    id: string;
    name: string;
    type: AssetType; // 'video' tracks can hold images too
    isMuted: boolean;
    isLocked: boolean;
}

export interface EditorState {
    assets: Asset[];
    tracks: Track[];
    clips: Clip[];
    currentTime: number;
    isPlaying: boolean;
    selectedClipId: string | null;
    duration: number; // Total timeline duration
}
