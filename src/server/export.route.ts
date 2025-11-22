import { Router } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Definir __dirname para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Polyfill global para __dirname (algunos módulos lo requieren)
if (typeof globalThis.__dirname === 'undefined') {
    globalThis.__dirname = __dirname;
}

// Configurar rutas de FFmpeg
function findFFmpeg(): string {
    // Primero intentar buscar en src/server/codec (carpeta local del proyecto)
    const projectRoot = process.cwd();
    const localFFmpegPath = join(projectRoot, 'src/server/codec/ffmpeg.exe');

    console.log(`🔍 Buscando FFmpeg en: ${localFFmpegPath}`);

    try {
        execSync(`"${localFFmpegPath}" -version`, { stdio: 'ignore' });
        console.log('✅ FFmpeg local encontrado en codec/');
        return localFFmpegPath;
    } catch (e) {
        console.log(`❌ No encontrado en codec/: ${e}`);
    }

    // También intentar en public/ffmpeg
    const publicFFmpegPath = join(projectRoot, 'public/ffmpeg/ffmpeg.exe');
    console.log(`🔍 Buscando FFmpeg en: ${publicFFmpegPath}`);

    try {
        execSync(`"${publicFFmpegPath}" -version`, { stdio: 'ignore' });
        console.log('✅ FFmpeg encontrado en public/ffmpeg/');
        return publicFFmpegPath;
    } catch (e) {
        console.log(`❌ No encontrado en public/ffmpeg/: ${e}`);
    }

    try {
        // Intentar encontrar ffmpeg en el PATH
        console.log('🔍 Buscando FFmpeg en PATH del sistema...');
        const result = execSync('where ffmpeg', { encoding: 'utf8' }).trim();
        console.log('✅ FFmpeg encontrado en PATH');
        return result.split('\n')[0]; // Retornar la primera coincidencia
    } catch (e) {
        console.log(`❌ No encontrado en PATH: ${e}`);
    }

    // Si no está en el PATH, intentar rutas comunes en Windows
    const commonPaths = [
        'C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files (x86)\\FFmpeg\\bin\\ffmpeg.exe',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
    ];

    for (const path of commonPaths) {
        console.log(`🔍 Buscando FFmpeg en: ${path}`);
        try {
            execSync(`"${path}" -version`, { stdio: 'ignore' });
            console.log(`✅ FFmpeg encontrado en: ${path}`);
            return path;
        } catch {
            console.log(`❌ No encontrado en: ${path}`);
        }
    }

    throw new Error('FFmpeg no encontrado en el sistema');
}

// Establecer rutas de FFmpeg
try {
    const ffmpegPath = findFFmpeg();
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log(`✅ FFmpeg encontrado: ${ffmpegPath}`);
} catch (error) {
    console.error('⚠️ Error configurando FFmpeg:', error);
}

export const exportRouter = Router();

// Configurar multer para manejo de archivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500 MB por archivo
    },
});

interface Clip {
    id: string;
    assetId: string;
    trackId: string;
    startTime: number;
    duration: number;
    offset: number;
    type: 'video' | 'image' | 'audio';
    name: string;
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
    isReversed?: boolean;
}

interface Track {
    id: string;
    type: 'video' | 'audio';
    name: string;
}

interface AssetData {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    duration?: number;
    frameRate?: number;
}

export interface ExportOptions {
    format: 'mp4';
    width: number;
    height: number;
    fps: number;
    totalDuration: number;
}

interface ProjectData {
    clips: Clip[];
    tracks: Track[];
    assets: AssetData[];
    options: ExportOptions;
}

// ===== ENDPOINTS DE PRUEBA =====

exportRouter.get('/hello', (req, res) => {
    console.log('👋 Endpoint /hello llamado');
    res.json({
        message: '¡Hola desde el backend!',
        timestamp: new Date().toISOString(),
        status: 'working',
    });
});

exportRouter.get('/status', (req, res) => {
    console.log('📊 Endpoint /status llamado');
    try {
        const ffmpegPath = findFFmpeg();
        res.json({
            status: 'ok',
            ffmpeg: true,
            ffmpegPath: ffmpegPath,
            message: 'Servicio de exportación disponible',
        });
    } catch (error) {
        res.json({
            status: 'warning',
            ffmpeg: false,
            message: 'FFmpeg no encontrado en el sistema',
            error: error instanceof Error ? error.message : 'Error desconocido',
        });
    }
});

// ===== ENDPOINT PRINCIPAL DE RENDERIZADO =====

exportRouter.post('/render', upload.array('assets'), async (req, res): Promise<void> => {
    console.log('🎬 Solicitud de renderizado recibida');

    try {
        // Parsear datos del proyecto desde form data
        const projectData: ProjectData = JSON.parse(req.body.projectData);

        const { clips, tracks, assets, options } = projectData;

        console.log(`📊 Proyecto: ${clips.length} clips, ${assets.length} assets`);
        console.log(`🎥 Opciones: ${options.width}x${options.height} @ ${options.fps}fps`);

        // Crear directorio temporal
        const tempDir = join(tmpdir(), `render-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        console.log(`📁 Directorio temporal: ${tempDir}`);

        // Paso 1: Guardar assets desde los archivos subidos
        console.log('💾 Guardando assets...');
        const assetPaths = new Map<string, string>();
        const uploadedFiles = req.files as Express.Multer.File[];

        if (!uploadedFiles || uploadedFiles.length === 0) {
            throw new Error('No se recibieron archivos de assets');
        }

        for (const file of uploadedFiles) {
            // El fieldname viene como "assets" pero necesitamos el ID del asset
            // Lo obtenemos del originalname que tendrá formato: assetId.ext
            const assetId = file.originalname.split('.')[0];
            const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
            const assetPath = join(tempDir, `asset-${assetId}${ext}`);

            await fs.writeFile(assetPath, file.buffer);
            assetPaths.set(assetId, assetPath);
            console.log(
                `✅ Asset guardado: ${assetId} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
            );
        }

        // Ejecutar FFmpeg
        console.log('🚀 Ejecutando FFmpeg...');
        const outputPath = join(tempDir, 'output.mp4');

        await renderWithFFmpeg(clips, tracks, assetPaths, options, outputPath);

        // Paso 4: Leer y enviar video
        const videoBuffer = await fs.readFile(outputPath);
        console.log(`📹 Video generado: ${videoBuffer.length} bytes`);

        // Limpiar
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
            console.log('🗑️ Archivos temporales eliminados');
        } catch (cleanupError) {
            console.warn('⚠️ Error al limpiar:', cleanupError);
        }

        // Enviar video
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
        res.send(videoBuffer);
    } catch (error) {
        console.error('❌ Error en renderizado:', error);
        res.status(500).json({
            error: 'Error al renderizar video',
            details: error instanceof Error ? error.message : 'Error desconocido',
        });
    }
});

// ===== FUNCIONES AUXILIARES =====

async function renderWithFFmpeg(
    clips: Clip[],
    tracks: Track[],
    assetPaths: Map<string, string>,
    options: ExportOptions,
    outputPath: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (clips.length === 0) {
            reject(new Error('No hay clips para renderizar'));
            return;
        }

        console.log('🎬 Iniciando renderizado optimizado...');

        // Separar clips por tipo
        const videoClips = clips.filter((c) => c.type === 'video' || c.type === 'image');
        const audioClips = clips.filter((c) => c.type === 'audio');

        if (videoClips.length === 0) {
            reject(new Error('No hay clips de video'));
            return;
        }

        const totalDuration = options.totalDuration;
        console.log(`⏱️ Duración: ${totalDuration.toFixed(2)}s, FPS: ${options.fps}`);
        console.log(`📹 Video clips: ${videoClips.length}, 🎵 Audio clips: ${audioClips.length}`);

        // Crear comando FFmpeg
        const cmd = ffmpeg();

        // Agregar inputs únicos
        const inputMap = new Map<string, number>();
        let inputIndex = 0;

        clips.forEach((clip) => {
            if (!inputMap.has(clip.assetId)) {
                const path = assetPaths.get(clip.assetId);
                if (path) {
                    cmd.input(path);
                    inputMap.set(clip.assetId, inputIndex);
                    console.log(`📥 [${inputIndex}] ${clip.name}`);
                    inputIndex++;
                }
            }
        });

        // Construir filtro complejo
        const filters: string[] = [];

        // 1. Procesar cada clip de video con sus transformaciones
        const processedVideoClips: string[] = [];
        videoClips.forEach((clip, i) => {
            const idx = inputMap.get(clip.assetId);
            console.log(idx != null);
            
            if (idx === undefined) return;
            console.log('Start',clip.startTime, 'End', clip.startTime + clip.duration);

            const label = `v${i}`;
            let filter = `[${idx}:v]`;

            // Trim
            filter += `trim=start=${clip.offset}:duration=${clip.duration},setpts=PTS-STARTPTS`;

            // // Reversa
            // if (clip.isReversed) {
            //     filter += `,reverse`;
            //     console.log('Reverse index',i);
                
            // }

            // FPS
            filter += `,fps=${options.fps}`;

            // Escala
            filter += `,scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease`;
            filter += `,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:black`;

            // Transformaciones adicionales
            if (clip.scale && clip.scale !== 1) {
                const w = Math.round(options.width * clip.scale);
                const h = Math.round(options.height * clip.scale);
                filter += `,scale=${w}:${h}`;
                filter += `,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:black`;
            }

            if (clip.rotation) {
                filter += `,rotate=${clip.rotation * (Math.PI / 180)}:c=black`;
            }

            if (clip.opacity !== undefined && clip.opacity < 1) {
                filter += `,format=rgba,colorchannelmixer=aa=${clip.opacity}`;
            }

            // Agregar delay para posicionar en el timeline
            if (clip.startTime > 0) {
                const delayFrames = Math.round(clip.startTime * options.fps);
                filter += `,tpad=start_duration=${clip.startTime}:color=black`;
            }

            filter += `[${label}]`;
            filters.push(filter);
            processedVideoClips.push(label);
        });

        // 2. Concatenar todos los clips de video
        if (processedVideoClips.length > 1) {
            const inputs = processedVideoClips.map(v => `[${v}]`).join('');
            filters.push(`${inputs}concat=n=${processedVideoClips.length}:v=1:a=0[vout]`);
        } else {
            filters.push(`[${processedVideoClips[0]}]copy[vout]`);
        }

        // 3. Asegurar duración exacta del video
        filters.push(`[vout]trim=duration=${totalDuration}[vfinal]`);

        // 4. Procesar audio
        const audioStreams: string[] = [];
        audioClips.forEach((clip, i) => {
            const idx = inputMap.get(clip.assetId);
            if (idx === undefined) return;

            const label = `a${i}`;
            let filter = `[${idx}:a]`;

            // Trim
            filter += `atrim=start=${clip.offset}:duration=${clip.duration},asetpts=PTS-STARTPTS`;

            // Delay para sincronizar con el timeline
            if (clip.startTime > 0) {
                const delayMs = Math.round(clip.startTime * 1000);
                filter += `,adelay=${delayMs}|${delayMs}`;
            }

            filter += `[${label}]`;
            filters.push(filter);
            audioStreams.push(label);
        });

        // 5. Mezclar audio
        if (audioStreams.length > 1) {
            const inputs = audioStreams.map(s => `[${s}]`).join('');
            filters.push(`${inputs}amix=inputs=${audioStreams.length}:duration=longest:dropout_transition=0[aout]`);
        } else if (audioStreams.length === 1) {
            filters.push(`[${audioStreams[0]}]apad=whole_dur=${totalDuration}[aout]`);
        }

        const filterComplex = filters.join(';');
        console.log('🎨 Filtros generados');

        // Aplicar filtros
        cmd.complexFilter(filterComplex);

        // Mapear salidas
        cmd.outputOptions(['-map', '[vfinal]']);
        if (audioStreams.length > 0) {
            cmd.outputOptions(['-map', '[aout]']);
        }

        // Codec y opciones
        cmd.outputOptions([
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-r', options.fps.toString(),
            '-t', totalDuration.toString()
        ]);

        if (audioStreams.length > 0) {
            cmd.outputOptions(['-c:a', 'aac', '-b:a', '192k']);
        }

        // Ejecutar
        cmd.output(outputPath)
            .on('start', (command) => {
                console.log('🚀 Ejecutando FFmpeg...');
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`⏳ ${progress.percent.toFixed(1)}%`);
                }
            })
            .on('end', () => {
                console.log('✅ Renderizado completo');
                resolve();
            })
            .on('error', (err) => {
                console.error('❌ Error:', err.message);
                reject(err);
            })
            .run();
    });
}
