export type AssetType = 'video' | 'image' | 'audio';

export interface Asset {
    id: string;
    name: string;
    type: AssetType;
    url: string;
    duration?: number; // in seconds
    thumbnail?: string;
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
