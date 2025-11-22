import { Injectable, signal } from '@angular/core';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Clip, Track, Asset } from '../models/editor.models';

export interface ExportProgress {
    stage:
        | 'initializing'
        | 'loading'
        | 'rendering'
        | 'extracting-audio'
        | 'encoding'
        | 'complete'
        | 'error';
    progress: number; // 0-100
    message: string;
}

export type ExportFormat = 'mp4' | 'webm' | 'mov';
export type VideoCodec = 'h264' | 'h265' | 'vp9';
export type AudioCodec = 'aac' | 'opus' | 'mp3';

export interface ExportOptions {
    format: ExportFormat;
    videoCodec: VideoCodec;
    audioCodec: AudioCodec;
    width: number;
    height: number;
    fps: number;
    videoBitrate?: string;
    audioBitrate?: string;
}

@Injectable({
    providedIn: 'root',
})
export class ExportService {
    private ffmpeg: FFmpeg | null = null;
    private isLoaded = false;

    exportProgress = signal<ExportProgress>({
        stage: 'initializing',
        progress: 0,
        message: 'Listo para exportar',
    });

    async initialize(): Promise<void> {
        if (this.isLoaded) {
            console.log('✅ FFmpeg ya está cargado');
            return;
        }

        console.log('📦 Iniciando carga de FFmpeg...');

        this.exportProgress.set({
            stage: 'initializing',
            progress: 10,
            message: 'Inicializando FFmpeg...',
        });

        // Timeout de 2 minutos para descargas
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(
                    new Error(
                        'Timeout: FFmpeg tardó más de 2 minutos en cargar. Revisa tu conexión a internet o intenta recargar la página.'
                    )
                );
            }, 120000);
        });

        try {
            await Promise.race([this.loadFFmpeg(), timeout]);
        } catch (error) {
            console.error('❌ Error loading FFmpeg:', error);
            console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
            this.exportProgress.set({
                stage: 'error',
                progress: 0,
                message: `Error al cargar FFmpeg: ${
                    error instanceof Error ? error.message : 'Error desconocido'
                }`,
            });
            throw error;
        }
    }

    private async loadFFmpeg(): Promise<void> {
        console.log('🔧 Creando instancia de FFmpeg...');
        this.ffmpeg = new FFmpeg();

        // Agregar listener de logs para debuggear
        this.ffmpeg.on('log', ({ message }) => {
            console.log('FF' + 'mpeg Log:', message);
        });

        console.log('🌐 Preparando URLs de FFmpeg desde unpkg.com...');
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

        console.log('⬇️ Descargando ffmpeg-core.js...');
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        console.log('✅ ffmpeg-core.js descargado');

        console.log('⬇️ Descargando ffmpeg-core.wasm (~31MB, puede tardar hasta 1 minuto)...');
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
        console.log('✅ ffmpeg-core.wasm descargado');

        this.exportProgress.set({
            stage: 'loading',
            progress: 50,
            message: 'Cargando FFmpeg en memoria...',
        });

        console.log('🚀 Cargando FFmpeg en memoria...');
        await this.ffmpeg.load({
            coreURL,
            wasmURL,
        });
        console.log('✅ FFmpeg cargado completamente!');

        this.isLoaded = true;

        this.exportProgress.set({
            stage: 'loading',
            progress: 100,
            message: 'FFmpeg cargado correctamente',
        });
    }

    async exportVideo(
        clips: Clip[],
        tracks: Track[],
        assets: Map<string, Asset>,
        options: ExportOptions
    ): Promise<Blob> {
        console.log('🎬 Iniciando exportación...', { clips: clips.length, tracks: tracks.length });

        if (!this.isLoaded) {
            console.log('📦 FFmpeg no cargado, inicializando...');
            await this.initialize();
        }

        if (!this.ffmpeg) {
            throw new Error('FFmpeg no está inicializado');
        }

        // Validación: verificar que hay clips
        if (!clips || clips.length === 0) {
            console.error('❌ No hay clips para exportar');
            throw new Error('No hay clips en el timeline para exportar');
        }

        try {
            console.log('✅ Iniciando renderizado de frames...');

            // Paso 1: Renderizar frames de video
            const videoFrames = await this.renderVideoFrames(clips, tracks, assets, options);
            console.log(`✅ ${videoFrames.length} frames renderizados`);

            // Paso 2: Extraer y mezclar audio (simplificado - sin audio por ahora)
            let audioTrackPath: string | null = null;

            // TEMPORALMENTE DESHABILITADO: El audio causa problemas
            // if (hasAudio) {
            //     audioTrackPath = await this.extractAndMixAudio(clips, tracks, assets, options);
            // }

            console.log('🎵 Audio:', audioTrackPath || 'Sin audio');

            // Paso 3: Codificar video final
            console.log('🔧 Iniciando codificación...');
            const videoBlob = await this.encodeVideo(videoFrames, audioTrackPath, options);
            console.log('✅ Video codificado correctamente');

            // Limpiar archivos temporales
            await this.cleanup(videoFrames.length, audioTrackPath);

            this.exportProgress.set({
                stage: 'complete',
                progress: 100,
                message: 'Exportación completada',
            });

            return videoBlob;
        } catch (error) {
            console.error('❌ Error during export:', error);
            this.exportProgress.set({
                stage: 'error',
                progress: 0,
                message: `Error: ${error}`,
            });
            throw error;
        }
    }

    private async renderVideoFrames(
        clips: Clip[],
        tracks: Track[],
        assets: Map<string, Asset>,
        options: ExportOptions
    ): Promise<Blob[]> {
        console.log('🎨 Renderizando frames...', { options });

        this.exportProgress.set({
            stage: 'rendering',
            progress: 0,
            message: 'Renderizando frames de video...',
        });

        const { width, height, fps } = options;

        // Calcular duración total - manejar caso cuando no hay clips
        const durations = clips.map((c) => c.startTime + c.duration);
        const totalDuration = durations.length > 0 ? Math.max(...durations) : 1;
        const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));

        console.log(
            `📊 Renderizando ${totalFrames} frames (${totalDuration.toFixed(2)}s @ ${fps}fps)`
        );

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        const frames: Blob[] = [];

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            const currentTime = frameIndex / fps;

            // Limpiar canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Renderizar clips de video/imagen por track
            const videoTracks = tracks.filter((t) => t.type === 'video');
            for (const track of videoTracks) {
                const trackClips = clips
                    .filter((c) => c.trackId === track.id && c.type !== 'audio')
                    .filter(
                        (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration
                    )
                    .sort((a, b) => a.startTime - b.startTime);

                for (const clip of trackClips) {
                    const asset = assets.get(clip.assetId);
                    if (!asset) {
                        console.warn(`⚠️ Asset no encontrado: ${clip.assetId}`);
                        continue;
                    }

                    const clipTime = currentTime - clip.startTime + clip.offset;

                    if (asset.type === 'video' && asset.frames && asset.frames.length > 0) {
                        const frameRate = asset.frameRate || 30;
                        let frameIdx = Math.floor(clipTime * frameRate);

                        // Soporte para clips invertidos
                        if (clip.isReversed) {
                            const clipDurationFrames = Math.floor(clip.duration * frameRate);
                            frameIdx = clipDurationFrames - frameIdx - 1;
                        }

                        frameIdx = Math.max(0, Math.min(frameIdx, asset.frames.length - 1));
                        const frame = asset.frames[frameIdx];

                        if (frame) {
                            this.drawClipToCanvas(ctx, frame, clip, width, height);
                        }
                    } else if (asset.type === 'image') {
                        const img = new Image();
                        img.src = asset.url;
                        await new Promise((resolve) => {
                            if (img.complete) {
                                resolve(null);
                            } else {
                                img.onload = () => resolve(null);
                                img.onerror = () => {
                                    console.error(`❌ Error loading image: ${asset.url}`);
                                    resolve(null);
                                };
                            }
                        });
                        this.drawClipToCanvas(ctx, img, clip, width, height);
                    }
                }
            }

            // Convertir canvas a blob
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) {
                        resolve(b);
                    } else {
                        reject(new Error('Error al convertir canvas a blob'));
                    }
                }, 'image/png');
            });
            frames.push(blob);

            // Actualizar progreso (0-40% para rendering)
            const progress = Math.floor((frameIndex / totalFrames) * 40);
            if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
                this.exportProgress.set({
                    stage: 'rendering',
                    progress,
                    message: `Renderizando frame ${frameIndex + 1}/${totalFrames}...`,
                });
                console.log(`📹 Frame ${frameIndex + 1}/${totalFrames} (${progress}%)`);
            }
        }

        console.log(`✅ Renderizado completo: ${frames.length} frames`);
        return frames;
    }

    private async encodeVideo(
        frames: Blob[],
        audioPath: string | null,
        options: ExportOptions
    ): Promise<Blob> {
        this.exportProgress.set({
            stage: 'encoding',
            progress: 50,
            message: 'Codificando video...',
        });

        if (!this.ffmpeg) throw new Error('FFmpeg no inicializado');

        // Escribir frames
        for (let i = 0; i < frames.length; i++) {
            const frameData = await fetchFile(frames[i]);
            await this.ffmpeg.writeFile(`frame${i.toString().padStart(5, '0')}.png`, frameData);

            if (i % 10 === 0) {
                const progress = 50 + Math.floor((i / frames.length) * 30);
                this.exportProgress.set({
                    stage: 'encoding',
                    progress,
                    message: `Preparando frames ${i}/${frames.length}...`,
                });
            }
        }

        // Construir comando FFmpeg según formato y codecs
        const command = this.buildFFmpegCommand(frames.length, audioPath, options);

        this.exportProgress.set({
            stage: 'encoding',
            progress: 80,
            message: 'Codificando video final...',
        });

        await this.ffmpeg.exec(command);

        this.exportProgress.set({
            stage: 'encoding',
            progress: 95,
            message: 'Finalizando exportación...',
        });

        // Leer archivo de salida
        const outputFile = this.getOutputFileName(options.format);
        const data = (await this.ffmpeg.readFile(outputFile)) as Uint8Array;
        const mimeType = this.getMimeType(options.format);
        const videoBlob = new Blob([new Uint8Array(data)], { type: mimeType });

        return videoBlob;
    }

    private buildFFmpegCommand(
        frameCount: number,
        audioPath: string | null,
        options: ExportOptions
    ): string[] {
        const { format, videoCodec, audioCodec, fps, videoBitrate, audioBitrate } = options;
        const outputFile = this.getOutputFileName(format);

        const command: string[] = ['-framerate', fps.toString(), '-i', 'frame%05d.png'];

        // Agregar audio si existe
        if (audioPath) {
            command.push('-i', audioPath);
        }

        // Configuración de video según codec
        switch (videoCodec) {
            case 'h264':
                command.push(
                    '-c:v',
                    'libx264',
                    '-preset',
                    'medium',
                    '-crf',
                    '23',
                    '-pix_fmt',
                    'yuv420p'
                );
                break;
            case 'h265':
                command.push(
                    '-c:v',
                    'libx265',
                    '-preset',
                    'medium',
                    '-crf',
                    '28',
                    '-pix_fmt',
                    'yuv420p'
                );
                break;
            case 'vp9':
                command.push(
                    '-c:v',
                    'libvpx-vp9',
                    '-b:v',
                    videoBitrate || '2M',
                    '-crf',
                    '30',
                    '-pix_fmt',
                    'yuv420p'
                );
                break;
        }

        // Configuración de audio si existe
        if (audioPath) {
            switch (audioCodec) {
                case 'aac':
                    command.push('-c:a', 'aac', '-b:a', audioBitrate || '128k');
                    break;
                case 'opus':
                    command.push('-c:a', 'libopus', '-b:a', audioBitrate || '128k');
                    break;
                case 'mp3':
                    command.push('-c:a', 'libmp3lame', '-b:a', audioBitrate || '192k');
                    break;
            }
        } else {
            command.push('-an'); // Sin audio
        }

        // Configuraciones específicas por formato
        if (format === 'mp4') {
            command.push('-movflags', '+faststart'); // Optimización para streaming
        }

        command.push(outputFile);

        return command;
    }

    private getOutputFileName(format: ExportFormat): string {
        const extensions: Record<ExportFormat, string> = {
            mp4: 'output.mp4',
            webm: 'output.webm',
            mov: 'output.mov',
        };
        return extensions[format];
    }

    private getMimeType(format: ExportFormat): string {
        const mimeTypes: Record<ExportFormat, string> = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
        };
        return mimeTypes[format];
    }

    private async cleanup(frameCount: number, audioPath: string | null): Promise<void> {
        if (!this.ffmpeg) return;

        // Limpiar frames
        for (let i = 0; i < frameCount; i++) {
            try {
                await this.ffmpeg.deleteFile(`frame${i.toString().padStart(5, '0')}.png`);
            } catch (e) {
                // Ignorar errores de limpieza
            }
        }

        // Limpiar audio
        if (audioPath) {
            try {
                await this.ffmpeg.deleteFile(audioPath);
                await this.ffmpeg.deleteFile('input_audio.mp3');
            } catch (e) {
                // Ignorar errores
            }
        }

        // Limpiar output
        try {
            const formats: ExportFormat[] = ['mp4', 'webm', 'mov'];
            for (const format of formats) {
                await this.ffmpeg.deleteFile(this.getOutputFileName(format));
            }
        } catch (e) {
            // Ignorar errores
        }
    }

    private drawClipToCanvas(
        ctx: CanvasRenderingContext2D,
        source: ImageBitmap | HTMLImageElement,
        clip: Clip,
        canvasWidth: number,
        canvasHeight: number
    ): void {
        ctx.save();

        const x = clip.x || 0;
        const y = clip.y || 0;
        const scale = clip.scale || 1;
        const rotation = clip.rotation || 0;
        const opacity = clip.opacity !== undefined ? clip.opacity : 1;

        const sourceWidth = source.width;
        const sourceHeight = source.height;
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;

        const centerX = canvasWidth / 2 + x;
        const centerY = canvasHeight / 2 + y;

        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.globalAlpha = opacity;

        ctx.drawImage(source, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

        ctx.restore();
    }

    downloadVideo(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Métodos helper para obtener configuraciones predefinidas
    getPresetOptions(
        preset: 'youtube' | 'tiktok' | 'instagram',
        customOptions?: Partial<ExportOptions>
    ): ExportOptions {
        const presets: Record<string, ExportOptions> = {
            youtube: {
                format: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 1920,
                height: 1080,
                fps: 30,
                videoBitrate: '8M',
                audioBitrate: '192k',
            },
            tiktok: {
                format: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 1080,
                height: 1920,
                fps: 30,
                videoBitrate: '5M',
                audioBitrate: '128k',
            },
            instagram: {
                format: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 1080,
                height: 1080,
                fps: 30,
                videoBitrate: '5M',
                audioBitrate: '128k',
            },
        };

        return { ...presets[preset], ...customOptions };
    }
}
