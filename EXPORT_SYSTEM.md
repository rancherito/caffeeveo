# Sistema de Exportación Profesional

## 🎯 Descripción General

El sistema de exportación permite convertir proyectos de edición de video en archivos profesionales con **audio y video incluidos**. Utiliza **FFmpeg.wasm**, una versión de FFmpeg compilada a WebAssembly que funciona directamente en el navegador.

## ✨ Características Implementadas

### 📦 Múltiples Formatos de Salida

-   **MP4** (H.264 + AAC) - Universal, compatible con todas las plataformas
-   **WebM** (VP9 + Opus) - Código abierto, excelente compresión
-   **MOV** (H.264 + AAC) - Formato profesional

### 🎬 Codecs Profesionales

**Video:**

-   **H.264/AVC** - El más compatible, soportado por todos los dispositivos
-   **H.265/HEVC** - 50% mejor compresión que H.264, menor tamaño de archivo
-   **VP9** - Código abierto, calidad similar a H.265

**Audio:**

-   **AAC** - Recomendado, alta calidad y compatibilidad universal
-   **Opus** - Mejor calidad por bitrate, ideal para streaming
-   **MP3** - Máxima compatibilidad con reproductores antiguos

### 🚀 Presets por Plataforma

-   **📺 YouTube**: 1920x1080, 30 FPS, H.264 + AAC, bitrate 8M
-   **🎵 TikTok**: 1080x1920, 30 FPS, H.264 + AAC, bitrate 5M
-   **📸 Instagram**: 1080x1080, 30 FPS, H.264 + AAC, bitrate 5M
-   **⚙️ Personalizado**: Configuración completa manual

### 🎵 Soporte de Audio

-   ✅ Extracción de audio de clips de video
-   ✅ Soporte para clips de audio independientes
-   ✅ Mezcla de múltiples pistas de audio
-   ✅ Configuración de bitrate de audio

## 🔧 Uso del Sistema

### Paso 1: Abrir Diálogo

Haz clic en el botón **"Exportar Video"** (arriba a la derecha del editor)

### Paso 2: Seleccionar Preset

Elige un preset de plataforma:

-   **YouTube**: Videos horizontales estándar
-   **TikTok**: Videos verticales
-   **Instagram**: Videos cuadrados
-   **Personalizado**: Control total

### Paso 3: Configurar (si es personalizado)

Si seleccionaste "Personalizado", configura:

1. **Formato de salida**: MP4, WebM o MOV
2. **Codec de video**: H.264, H.265 o VP9
3. **Codec de audio**: AAC, Opus o MP3
4. **Resolución**: Ancho × Alto en píxeles
5. **FPS**: 24 (cine), 30 (estándar) o 60 (alta calidad)

### Paso 4: Nombrar Archivo

Personaliza el nombre del archivo de salida

### Paso 5: Exportar

Haz clic en **"Exportar Video"** y espera

## 📊 Progreso de Exportación

Durante la exportación verás:

1. **Inicializando** (0-10%): Preparando FFmpeg
2. **Cargando FFmpeg** (10-100%): Descargando WASM
3. **Renderizando frames** (0-40%): Generando video frame por frame
4. **Extrayendo audio** (40-50%): Procesando pistas de audio
5. **Codificando** (50-95%): Creando archivo final
6. **Completado** (100%): ¡Listo para descargar!

## 🏗️ Arquitectura Técnica

### Componentes Principales

#### ExportService

```typescript
// Métodos principales
- initialize(): Promise<void>
- exportVideo(clips, tracks, assets, options): Promise<Blob>
- renderVideoFrames(): Promise<Blob[]>
- extractAndMixAudio(): Promise<string>
- encodeVideo(): Promise<Blob>
- getPresetOptions(preset): ExportOptions
```

**Responsabilidades:**

-   Inicialización de FFmpeg.wasm
-   Renderizado frame por frame de video
-   Extracción y mezcla de audio
-   Codificación final con FFmpeg
-   Gestión de progreso

#### ExportDialogComponent

**Funcionalidades:**

-   Interfaz de usuario para configuración
-   Selección de presets y parámetros
-   Visualización de progreso
-   Manejo de errores
-   Descarga automática

### Flujo de Datos

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ Clic en "Exportar"
       ▼
┌─────────────────┐
│  ExportDialog   │
│  - Configuración │
│  - Validación    │
└──────┬──────────┘
       │ Opciones de exportación
       ▼
┌──────────────────┐
│  ExportService   │
│  1. Render video │
│  2. Extract audio│
│  3. Encode       │
└──────┬───────────┘
       │ Comandos FFmpeg
       ▼
┌──────────────┐
│ FFmpeg.wasm  │
│ Procesamiento │
└──────┬───────┘
       │ Archivo final
       ▼
┌──────────────┐
│  Download    │
└──────────────┘
```

## ⚙️ Configuración de FFmpeg

### Comandos de Ejemplo

**MP4 con H.264 + AAC:**

```bash
ffmpeg -framerate 30 -i frame%05d.png -i audio.mp3 \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  output.mp4
```

**WebM con VP9 + Opus:**

```bash
ffmpeg -framerate 30 -i frame%05d.png -i audio.mp3 \
  -c:v libvpx-vp9 -b:v 2M -crf 30 -pix_fmt yuv420p \
  -c:a libopus -b:a 128k \
  output.webm
```

**MOV con H.265:**

```bash
ffmpeg -framerate 30 -i frame%05d.png -i audio.mp3 \
  -c:v libx265 -preset medium -crf 28 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  output.mov
```

### Parámetros Importantes

| Parámetro  | Descripción             | Valores                      |
| ---------- | ----------------------- | ---------------------------- |
| `-c:v`     | Codec de video          | libx264, libx265, libvpx-vp9 |
| `-preset`  | Velocidad vs compresión | ultrafast, medium, slow      |
| `-crf`     | Calidad constante       | 0 (best) - 51 (worst)        |
| `-pix_fmt` | Formato de píxeles      | yuv420p (compatible)         |
| `-c:a`     | Codec de audio          | aac, libopus, libmp3lame     |
| `-b:a`     | Bitrate de audio        | 128k, 192k, 256k             |
| `-b:v`     | Bitrate de video        | 2M, 5M, 8M                   |

## ⚡ Optimizaciones

### Presets Optimizados

-   **H.264 Medium + CRF 23**: Balance perfecto calidad/tamaño
-   **H.265 Medium + CRF 28**: Archivos 50% más pequeños
-   **VP9 con bitrate 2M**: Excelente para web

### Mejoras de Rendimiento

-   Canvas 2D optimizado con `willReadFrequently`
-   Procesamiento por lotes de frames
-   Limpieza automática de archivos temporales

## 🚨 Limitaciones y Soluciones

### Rendimiento

**Problema**: Exportación lenta
**Factores**:

-   Duración del video
-   Resolución (4K vs 1080p)
-   FPS (60 vs 30)
-   Potencia del dispositivo

**Soluciones**:

-   Usar presets en lugar de configuración manual
-   Reducir resolución y FPS para pruebas
-   Cerrar otras aplicaciones
-   Usar Chrome/Edge (mejor rendimiento WASM)

### Memoria

**Problema**: Navegador se queda sin memoria
**Causas**:

-   Videos muy largos (>10 minutos)
-   Resolución muy alta (>4K)
-   Muchos clips simultáneos

**Soluciones**:

-   Dividir el video en segmentos
-   Exportar a resolución más baja
-   Usar formato más eficiente (H.265)

### Audio

**Limitación Actual**: Solo se exporta el primer clip de audio
**Próxima Mejora**: Mezcla completa de múltiples pistas

### Compatibilidad

**Navegadores Soportados:**

-   ✅ Chrome 90+ (Recomendado)
-   ✅ Edge 90+
-   ✅ Firefox 88+
-   ✅ Safari 14+ (Limitado)
-   ❌ Internet Explorer

**Requisitos:**

-   WebAssembly habilitado
-   Conexión a internet (primera carga de FFmpeg)
-   4GB+ RAM (recomendado para videos largos)

## 🔮 Mejoras Futuras

### En Desarrollo

-   [ ] Mezcla completa de múltiples pistas de audio
-   [ ] Ajuste de volumen por clip
-   [ ] Transiciones entre clips
-   [ ] Efectos de audio (fade in/out)

### Planificadas

-   [ ] Exportación en segundo plano (Web Workers)
-   [ ] Previsualización antes de exportar
-   [ ] Soporte para GIF animado
-   [ ] Soporte para subtítulos
-   [ ] Exportación por lotes
-   [ ] Templates de exportación personalizados

### Optimizaciones Futuras

-   [ ] OffscreenCanvas para mejor rendimiento
-   [ ] Caché de frames renderizados
-   [ ] Procesamiento paralelo con Workers
-   [ ] Compresión adaptativa

## 🐛 Solución de Problemas

### Error: "FFmpeg no está inicializado"

**Causa**: FFmpeg aún no se ha cargado
**Solución**: Espera 5-10 segundos y reintenta

### Error: "Error al cargar FFmpeg"

**Posibles causas**:

1. Sin conexión a internet
2. CDN de unpkg.com bloqueado
3. Adblocker interfiriendo

**Soluciones**:

1. Verifica tu conexión
2. Desactiva adblocker temporalmente
3. Recarga la página
4. Limpia caché del navegador

### Video exportado sin audio

**Causas**:

1. No hay clips de audio en el timeline
2. Pistas de audio muteadas
3. Formato de audio no soportado

**Soluciones**:

1. Verifica que haya clips de audio
2. Desmutea las pistas de audio
3. Usa formatos soportados (MP3, WAV, AAC)

### Video en blanco

**Causas**:

1. Assets no cargados correctamente
2. Frames no extraídos
3. Transformaciones inválidas

**Soluciones**:

1. Recarga los assets
2. Verifica la previsualización funcione
3. Revisa las transformaciones de clips

### Exportación interrumpida

**Causas**:

1. Navegador cerrado
2. Pestaña cerrada
3. Quedarse sin memoria

**Soluciones**:

1. Mantén la pestaña abierta
2. No cierres el navegador
3. Reduce duración/resolución

## 📖 Ejemplo de Código

### Usar Preset de YouTube

```typescript
import { ExportService } from './services/export.service';

const exportService = inject(ExportService);
const store = inject(EditorStore);

// Obtener configuración preset
const options = exportService.getPresetOptions('youtube');

// Preparar assets
const assetsMap = new Map();
store.assets().forEach((asset) => {
    assetsMap.set(asset.id, asset);
});

// Exportar
const videoBlob = await exportService.exportVideo(
    store.clips(),
    store.tracks(),
    assetsMap,
    options
);

// Descargar
exportService.downloadVideo(videoBlob, 'mi-video-youtube.mp4');
```

### Configuración Personalizada

```typescript
const customOptions = {
    format: 'webm',
    videoCodec: 'vp9',
    audioCodec: 'opus',
    width: 1920,
    height: 1080,
    fps: 60,
    videoBitrate: '10M',
    audioBitrate: '256k',
};

const videoBlob = await exportService.exportVideo(
    store.clips(),
    store.tracks(),
    assetsMap,
    customOptions
);
```

## 📚 Recursos

-   [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) - Documentación oficial
-   [H.264 Encoding Guide](https://trac.ffmpeg.org/wiki/Encode/H.264) - Guía de codificación
-   [H.265/HEVC Guide](https://trac.ffmpeg.org/wiki/Encode/H.265) - Codificación HEVC
-   [VP9 Encoding](https://trac.ffmpeg.org/wiki/Encode/VP9) - Codificación VP9
-   [Audio Encoding](https://trac.ffmpeg.org/wiki/Encode/AAC) - Guía de audio

## 🙏 Créditos

-   **FFmpeg.wasm**: [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm)
-   **FFmpeg**: [FFmpeg Project](https://ffmpeg.org/)
-   **Opus**: [Opus Codec](https://opus-codec.org/)
-   **x264**: [VideoLAN x264](https://www.videolan.org/developers/x264.html)

---

**Nota sobre unpkg.com**: FFmpeg.wasm requiere cargar archivos WASM core que no se pueden empaquetar directamente en el bundle de Angular. Se cargan desde un CDN (unpkg.com) solo la primera vez. Una vez cargados, se cachean en el navegador.

Para uso en producción, se recomienda:

1. Descargar los archivos core localmente
2. Servirlos desde tu propio servidor
3. Actualizar las URLs en `ExportService.initialize()`
