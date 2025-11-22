import { Injectable, signal } from '@angular/core';
import { Clip, Track, Asset, AssetType } from '../models/editor.models';

export interface ExportProgress {
    stage: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
    progress: number; // 0-100
    message: string;
}

export type ExportFormat = 'mp4';

export interface ExportOptions {
    format: ExportFormat;
    width: number;
    height: number;
    fps: number;
    totalDuration?: number;
}

export interface ExportProjectData {
    clips: Clip[];
    tracks: Track[];
    assets: {
        id: string;
        type: 'video' | 'image' | 'audio';
        url: string;
        duration?: number;
        frameRate?: number;
    }[];
    options: ExportOptions;
}

@Injectable({
    providedIn: 'root',
})
export class ExportService {
    exportProgress = signal<ExportProgress>({
        stage: 'preparing',
        progress: 0,
        message: 'Listo para exportar',
    });

    async exportVideo(
        clips: Clip[],
        tracks: Track[],
        assets: Map<string, Asset>,
        options: ExportOptions
    ): Promise<Blob> {
        console.log('🎬 Preparando exportación...', { clips: clips.length, tracks: tracks.length });

        if (!clips || clips.length === 0) {
            throw new Error('No hay clips en el timeline para exportar');
        }

        try {
            // Calcular duración total del timeline
            const totalDuration = Math.max(...clips.map(c => c.startTime + c.duration));
            console.log(`⏱️ Duración total calculada: ${totalDuration.toFixed(2)}s`);

            // Paso 1: Preparar datos del proyecto
            this.exportProgress.set({
                stage: 'preparing',
                progress: 10,
                message: 'Preparando datos del proyecto...',
            });

            const projectData: ExportProjectData = {
                clips: clips.map((clip) => ({
                    id: clip.id,
                    assetId: clip.assetId,
                    trackId: clip.trackId,
                    startTime: clip.startTime,
                    duration: clip.duration,
                    offset: clip.offset,
                    type: clip.type,
                    name: clip.name,
                    x: clip.x,
                    y: clip.y,
                    scale: clip.scale,
                    rotation: clip.rotation,
                    opacity: clip.opacity,
                    isReversed: clip.isReversed,
                })),
                tracks: tracks.map((track) => ({
                    id: track.id,
                    type: track.type,
                    name: track.name,
                    isMuted: track.isMuted,
                    isLocked: track.isLocked,
                })),
                assets: Array.from(assets.values()).map((asset) => ({
                    id: asset.id,
                    type: asset.type,
                    url: asset.url,
                    duration: asset.duration,
                    frameRate: asset.frameRate,
                })),
                options: {
                    ...options,
                    totalDuration,
                },
            };

            console.log('📦 Datos del proyecto preparados:', projectData);

            // Paso 2: Preparar FormData con archivos
            this.exportProgress.set({
                stage: 'uploading',
                progress: 20,
                message: 'Preparando archivos...',
            });

            const formData = new FormData();
            
            // Agregar datos del proyecto como JSON
            formData.append('projectData', JSON.stringify(projectData));

            // Descargar y agregar cada asset como archivo
            let assetIndex = 0;
            for (const asset of assets.values()) {
                try {
                    console.log(`📥 Descargando asset: ${asset.name}`);
                    
                    // Descargar el asset desde su blob URL
                    const assetResponse = await fetch(asset.url);
                    if (!assetResponse.ok) {
                        throw new Error(`Error al descargar asset ${asset.name}`);
                    }
                    
                    const assetBlob = await assetResponse.blob();
                    const ext = this.getFileExtension(asset.url) || this.getExtensionFromType(asset.type);
                    const filename = `${asset.id}${ext}`;
                    
                    formData.append('assets', assetBlob, filename);
                    console.log(`✅ Asset agregado: ${filename} (${(assetBlob.size / 1024 / 1024).toFixed(2)} MB)`);
                    
                    assetIndex++;
                    this.exportProgress.set({
                        stage: 'uploading',
                        progress: 20 + (assetIndex / assets.size) * 50,
                        message: `Preparando archivos... (${assetIndex}/${assets.size})`,
                    });
                } catch (error) {
                    console.error(`❌ Error al procesar asset ${asset.name}:`, error);
                    throw new Error(`No se pudo procesar el asset: ${asset.name}`);
                }
            }

            // Paso 3: Enviar al servidor
            this.exportProgress.set({
                stage: 'uploading',
                progress: 70,
                message: 'Enviando al servidor...',
            });

            const response = await fetch('/api/export/render', {
                method: 'POST',
                body: formData,
                // NO enviar Content-Type header, el navegador lo establece automáticamente con el boundary
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ details: response.statusText }));
                throw new Error(error.details || 'Error al procesar en el servidor');
            }

            // Paso 4: Recibir video
            this.exportProgress.set({
                stage: 'processing',
                progress: 90,
                message: 'Descargando video...',
            });

            const videoBlob = await response.blob();
            console.log('✅ Video recibido:', videoBlob.size, 'bytes');

            this.exportProgress.set({
                stage: 'complete',
                progress: 100,
                message: 'Exportación completada',
            });

            return videoBlob;
        } catch (error) {
            console.error('❌ Error:', error);
            this.exportProgress.set({
                stage: 'error',
                progress: 0,
                message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            });
            throw error;
        }
    }

    downloadVideo(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    getPresetOptions(
        preset: 'youtube' | 'tiktok' | 'instagram',
        customOptions?: Partial<ExportOptions>
    ): ExportOptions {
        const presets: Record<string, ExportOptions> = {
            youtube: {
                format: 'mp4',
                width: 1920,
                height: 1080,
                fps: 24,
            },
            tiktok: {
                format: 'mp4',
                width: 1080,
                height: 1920,
                fps: 24,
            },
            instagram: {
                format: 'mp4',
                width: 1080,
                height: 1080,
                fps: 24,
            },
        };

        return { ...presets[preset], ...customOptions };
    }

    private getFileExtension(url: string): string | null {
        const match = url.match(/\.(mp4|webm|mov|png|jpg|jpeg|gif|mp3|wav)$/i);
        return match ? match[0] : null;
    }

    private getExtensionFromType(type: AssetType): string {
        switch (type) {
            case 'video':
                return '.mp4';
            case 'image':
                return '.png';
            case 'audio':
                return '.mp3';
            default:
                return '.dat';
        }
    }
}
