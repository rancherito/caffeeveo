import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Asset, Clip, Track, AssetType } from '../models/editor.models';
import { StorageService } from '../services/storage.service';

@Injectable({
    providedIn: 'root',
})
export class EditorStore {
    // State Signals
    readonly assets = signal<Asset[]>([]);
    readonly tracks = signal<Track[]>([
        { id: 'track-1', name: 'Video Track 1', type: 'video', isMuted: false, isLocked: false },
        { id: 'track-2', name: 'Audio Track 1', type: 'audio', isMuted: false, isLocked: false },
    ]);
    readonly clips = signal<Clip[]>([]);
    readonly currentTime = signal<number>(0);
    readonly isPlaying = signal<boolean>(false);
    readonly selectedClipId = signal<string | null>(null);
    readonly projectSettings = signal<{ width: number; height: number }>({
        width: 1080,
        height: 1920,
    });
    readonly isLoaded = signal<boolean>(false);

    private storage = inject(StorageService);

    constructor() {
        this.loadProject();

        effect(() => {
            if (!this.isLoaded()) return;

            const assets = this.assets();
            const sanitizedAssets = assets.map((a) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { frames, url, ...rest } = a;
                return { ...rest, url: '' };
            });
            this.storage.saveState('editor-assets', sanitizedAssets);
        });

        effect(() => {
            if (!this.isLoaded()) return;
            this.storage.saveState('editor-tracks', this.tracks());
        });

        effect(() => {
            if (!this.isLoaded()) return;
            this.storage.saveState('editor-clips', this.clips());
        });

        effect(() => {
            if (!this.isLoaded()) return;
            this.storage.saveState('editor-settings', this.projectSettings());
        });
    }

    // Computed
    readonly selectedClip = computed(
        () => this.clips().find((c) => c.id === this.selectedClipId()) || null
    );

    readonly totalDuration = computed(() => {
        const clips = this.clips();
        if (clips.length === 0) return 0;
        return Math.max(...clips.map((c) => c.startTime + c.duration));
    });

    // Actions
    async loadProject() {
        try {
            // Load Settings
            const settings = this.storage.loadState<{ width: number; height: number }>(
                'editor-settings'
            );
            if (settings) this.projectSettings.set(settings);

            // Load Tracks
            const tracks = this.storage.loadState<Track[]>('editor-tracks');
            if (tracks) this.tracks.set(tracks);

            // Load Clips
            const clips = this.storage.loadState<Clip[]>('editor-clips');
            if (clips) this.clips.set(clips);

            // Load Assets
            const savedAssets = this.storage.loadState<Asset[]>('editor-assets');
            if (savedAssets) {
                const restoredAssets: Asset[] = [];
                for (const asset of savedAssets) {
                    try {
                        const blob = await this.storage.getFile(asset.id);
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            restoredAssets.push({ ...asset, url, frames: [] });
                        } else {
                            console.warn(`Could not find file for asset ${asset.id}`);
                        }
                    } catch (e) {
                        console.error(`Error loading asset ${asset.id}`, e);
                    }
                }
                this.assets.set(restoredAssets);

                // Restart frame extraction for videos after setting the state
                restoredAssets.forEach((asset) => {
                    if (asset.type === 'video') {
                        this.extractFrames(asset.id);
                    }
                });
            }
        } catch (e) {
            console.error('Error loading project:', e);
        } finally {
            this.isLoaded.set(true);
        }
    }

    async addAsset(file: File, type: AssetType) {
        const url = URL.createObjectURL(file);

        if (type === 'video') {
            // Extraer metadatos primero
            const metadata = await this.extractVideoMetadata(file, url);

            // Guardar archivo en IndexedDB
            await this.storage.storeFile(metadata.id, file);

            this.assets.update((assets) => [...assets, metadata]);

            // Extraer frames en background
            this.extractFrames(metadata.id);
        } else if (type === 'image') {
            const asset: Asset = {
                id: crypto.randomUUID(),
                name: file.name,
                type,
                url,
                duration: 5,
                size: file.size,
            };
            await this.storage.storeFile(asset.id, file);
            this.assets.update((assets) => [...assets, asset]);
        } else if (type === 'audio') {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                const asset: Asset = {
                    id: crypto.randomUUID(),
                    name: file.name,
                    type,
                    url,
                    duration: audio.duration,
                    size: file.size,
                };
                this.storage.storeFile(asset.id, file).then(() => {
                    this.assets.update((assets) => [...assets, asset]);
                });
            };
            audio.src = url;
        }
    }

    private async extractVideoMetadata(file: File, url: string): Promise<Asset> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                const frameRate = 30;
                const totalFrames = Math.ceil(video.duration * frameRate);

                resolve({
                    id: crypto.randomUUID(),
                    name: file.name,
                    type: 'video',
                    url,
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    size: file.size,
                    frames: [],
                    frameRate,
                    totalFrames,
                    isProcessing: true,
                    processingProgress: 0,
                });
            };

            video.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Error al cargar: ${file.name}`));
            };

            video.src = url;
        });
    }

    private async extractFrames(assetId: string): Promise<void> {
        const assetIndex = this.assets().findIndex((a) => a.id === assetId);
        if (assetIndex === -1) return;

        const asset = this.assets()[assetIndex];
        if (!asset.url || asset.type !== 'video') return;

        const video = document.createElement('video');
        video.src = asset.url;
        video.muted = true;

        await new Promise((resolve) => {
            video.onloadeddata = resolve;
            video.load();
        });

        const canvas = document.createElement('canvas');
        canvas.width = asset.width || 1920;
        canvas.height = asset.height || 1080;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        const frames: ImageBitmap[] = [];
        const frameInterval = 1 / (asset.frameRate || 30);

        for (let i = 0; i < (asset.totalFrames || 0); i++) {
            const time = i * frameInterval;

            await new Promise<void>((resolve) => {
                video.currentTime = time;
                video.onseeked = () => resolve();
            });

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageBitmap = await createImageBitmap(canvas);
            frames.push(imageBitmap);

            // Actualizar progreso
            this.assets.update((current) => {
                const updated = [...current];
                updated[assetIndex] = {
                    ...updated[assetIndex],
                    frames: [...frames],
                    processingProgress: ((i + 1) / (asset.totalFrames || 1)) * 100,
                };
                return updated;
            });
        }

        // Marcar como completado
        this.assets.update((current) => {
            const updated = [...current];
            updated[assetIndex] = {
                ...updated[assetIndex],
                isProcessing: false,
                processingProgress: 100,
            };
            return updated;
        });
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
            type: asset.type,
            scale: 1,
            rotation: 0,
            opacity: 1,
            x: 0,
            y: 0,
        };

        this.clips.update((clips) => [...clips, newClip]);
    }

    addTrack(type: AssetType) {
        const newTrack: Track = {
            id: crypto.randomUUID(),
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${
                this.tracks().filter((t) => t.type === type).length + 1
            }`,
            type,
            isMuted: false,
            isLocked: false,
        };
        this.tracks.update((tracks) => [...tracks, newTrack]);
    }

    removeClip(clipId: string) {
        this.clips.update((clips) => clips.filter((c) => c.id !== clipId));
        if (this.selectedClipId() === clipId) {
            this.selectedClipId.set(null);
        }
    }

    selectClip(clipId: string | null) {
        this.selectedClipId.set(clipId);
    }

    updateClip(clipId: string, changes: Partial<Clip>) {
        this.clips.update((clips) =>
            clips.map((c) => (c.id === clipId ? { ...c, ...changes } : c))
        );
    }

    setCurrentTime(time: number) {
        this.currentTime.set(time);
    }

    togglePlay() {
        this.isPlaying.update((p) => !p);
    }
}
