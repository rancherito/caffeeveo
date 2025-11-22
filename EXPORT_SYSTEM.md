# Sistema de Exportación de Video

## ✅ **NUEVA IMPLEMENTACIÓN: Servidor Express + FFmpeg Real**

Este sistema utiliza FFmpeg **real** en el servidor Node.js para exportación profesional y rápida.

## 📋 **Requisitos**

### 1. **Instalar FFmpeg** (REQUERIDO)

El servidor necesita FFmpeg instalado en el sistema:

#### Windows:

```bash
# Opción 1: Con Chocolatey
choco install ffmpeg

# Opción 2: Descarga manual
# 1. Descarga desde https://www.gyan.dev/ffmpeg/builds/
# 2. Extrae a C:\ffmpeg
# 3. Agrega C:\ffmpeg\bin a PATH
```

#### Mac:

```bash
brew install ffmpeg
```

#### Linux:

```bash
sudo apt update
sudo apt install ffmpeg
```

### 2. **Verificar Instalación**

```bash
ffmpeg -version
```

Deberías ver información de FFmpeg.

## 🚀 **Cómo Funciona**

### Cliente (Navegador):

1. Renderiza frames en Canvas (RÁPIDO - sin throttling)
2. Convierte frames a base64
3. Envía al servidor vía HTTP POST

### Servidor (Node.js):

1. Recibe frames como base64
2. Escribe frames a disco como PNG
3. Usa FFmpeg para codificar a MP4
4. Devuelve video completo al cliente

### **Ventajas:**

-   ✅ **100x más rápido** que FFmpeg.wasm
-   ✅ **Sin throttling** del navegador
-   ✅ **Usa toda la CPU** disponible
-   ✅ **Codificación profesional** con FFmpeg real

## ⚙️ **Configuración**

### Opciones de Exportación

-   **Formato**: MP4 (H.264)
-   **FPS por defecto**: 24 fps
-   **FPS alternativo**: 48 fps
-   **Calidad**: CRF 23 (alta calidad)
-   **Preset**: fast (balance velocidad/calidad)

### Presets de Plataforma

**YouTube** (1920x1080 @ 24fps):

```typescript
{
  format: 'mp4',
  width: 1920,
  height: 1080,
  fps: 24
}
```

**TikTok** (1080x1920 @ 24fps):

```typescript
{
  format: 'mp4',
  width: 1080,
  height: 1920,
  fps: 24
}
```

**Instagram** (1080x1080 @ 24fps):

```typescript
{
  format: 'mp4',
  width: 1080,
  height: 1080,
  fps: 24
}
```

## 📊 **Rendimiento**

| Duración     | Frames | Tiempo Estimado |
| ------------ | ------ | --------------- |
| 5s @ 24fps   | 120    | ~5-10s          |
| 30s @ 24fps  | 720    | ~30-45s         |
| 1min @ 24fps | 1440   | ~1-2min         |
| 5min @ 24fps | 7200   | ~5-8min         |

_Tiempos pueden variar según hardware_

## 🔧 **API del Servidor**

### POST /api/export/video

**Request:**

```json
{
  "frames": ["data:image/png;base64,...", ...],
  "fps": 24,
  "width": 1920,
  "height": 1080
}
```

**Response:**

```
Content-Type: video/mp4
Content-Disposition: attachment; filename="video.mp4"

<binary video data>
```

### GET /api/export/status

**Response:**

```json
{
    "status": "ok",
    "ffmpeg": true,
    "message": "Servicio de exportación disponible"
}
```

## 🐛 **Solución de Problemas**

### "FFmpeg no encontrado"

-   Verifica que FFmpeg esté instalado: `ffmpeg -version`
-   Asegúrate de que esté en PATH
-   Reinicia el servidor después de instalar

### "Timeout al enviar frames"

-   Reduce la duración del video
-   Reduce el FPS (usa 24 en lugar de 48)
-   Reduce la resolución

### "Error 413: Payload demasiado grande"

-   El límite actual es 500MB
-   Para videos muy largos, considera dividirlos

## 📝 **Notas**

1. **Audio**: Por ahora solo se exporta video. Audio se agregará en futuras versiones.
2. **Limpieza**: Los archivos temporales se eliminan automáticamente después de la exportación.
3. **Seguridad**: En producción, agrega autenticación y límites de rate.

## 🚧 **Mejoras Futuras**

-   [ ] Soporte para audio
-   [ ] Codificación en background con SSE para progreso real
-   [ ] Múltiples formatos (WebM, GIF)
-   [ ] Queue system para múltiples exportaciones
-   [ ] Compresión antes de enviar frames
-   [ ] WebSockets para progreso en tiempo real
