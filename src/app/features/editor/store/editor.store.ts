import { Injectable, signal, computed } from '@angular/core';
import { Asset, Clip, Track, AssetType } from '../models/editor.models';

@Injectable({
    providedIn: 'root'
})
export class EditorStore {
    // State Signals
    readonly assets = signal<Asset[]>([]);
    readonly tracks = signal<Track[]>([
        { id: 'track-1', name: 'Video Track 1', type: 'video', isMuted: false, isLocked: false },
        { id: 'track-2', name: 'Audio Track 1', type: 'audio', isMuted: false, isLocked: false }
    ]);
    readonly clips = signal<Clip[]>([]);
    readonly currentTime = signal<number>(0);
    readonly isPlaying = signal<boolean>(false);
    readonly selectedClipId = signal<string | null>(null);

    // Computed
    readonly selectedClip = computed(() => 
        this.clips().find(c => c.id === this.selectedClipId()) || null
    );

    readonly totalDuration = computed(() => {
        const clips = this.clips();
        if (clips.length === 0) return 0;
        return Math.max(...clips.map(c => c.startTime + c.duration));
    });

    // Actions
    addAsset(file: File, type: AssetType) {
        const url = URL.createObjectURL(file);
        const asset: Asset = {
            id: crypto.randomUUID(),
            name: file.name,
            type,
            url,
            duration: 0 // In a real app, we'd detect this
        };

        // For demo purposes, let's fake duration for video/audio
        if (type !== 'image') {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                asset.duration = video.duration;
                this.assets.update(assets => [...assets, asset]);
            };
            video.src = url;
        } else {
            asset.duration = 5; // Default image duration
            this.assets.update(assets => [...assets, asset]);
        }
    }

    addClipToTrack(asset: Asset, trackId: string, startTime: number) {
        const newClip: Clip = {
            id: crypto.randomUUID(),
            assetId: asset.id,
            startTime,
            duration: asset.duration || 5,
            offset: 0,
            trackId,
            name: asset.name,
            type: asset.type
        };

        this.clips.update(clips => [...clips, newClip]);
    }

    addTrack(type: AssetType) {
        const newTrack: Track = {
            id: crypto.randomUUID(),
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${this.tracks().filter(t => t.type === type).length + 1}`,
            type,
            isMuted: false,
            isLocked: false
        };
        this.tracks.update(tracks => [...tracks, newTrack]);
    }

    removeClip(clipId: string) {
        this.clips.update(clips => clips.filter(c => c.id !== clipId));
        if (this.selectedClipId() === clipId) {
            this.selectedClipId.set(null);
        }
    }

    selectClip(clipId: string | null) {
        this.selectedClipId.set(clipId);
    }

    updateClip(clipId: string, changes: Partial<Clip>) {
        this.clips.update(clips => 
            clips.map(c => c.id === clipId ? { ...c, ...changes } : c)
        );
    }

    setCurrentTime(time: number) {
        this.currentTime.set(time);
    }

    togglePlay() {
        this.isPlaying.update(p => !p);
    }
}
