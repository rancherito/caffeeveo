import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '../../store/editor.store';
import { ExportService, ExportProgress, ExportFormat } from '../../services/export.service';

type PresetType = 'youtube' | 'tiktok' | 'instagram' | 'custom';

@Component({
    selector: 'export-dialog',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="export-overlay" (click)="close()">
            <div class="export-dialog" (click)="$event.stopPropagation()">
                <div class="dialog-header">
                    <h2>Exportar Video</h2>
                    <button class="close-btn" (click)="close()">×</button>
                </div>

                <div class="dialog-body">
                    @if (!isExporting()) {
                    <div class="export-settings">
                        <!-- Presets -->
                        <div class="setting-group">
                            <label>Preset de Plataforma</label>
                            <div class="preset-buttons">
                                <button
                                    class="preset-btn"
                                    [class.active]="selectedPreset() === 'youtube'"
                                    (click)="selectPreset('youtube')"
                                >
                                    📺 YouTube
                                </button>
                                <button
                                    class="preset-btn"
                                    [class.active]="selectedPreset() === 'tiktok'"
                                    (click)="selectPreset('tiktok')"
                                >
                                    🎵 TikTok
                                </button>
                                <button
                                    class="preset-btn"
                                    [class.active]="selectedPreset() === 'instagram'"
                                    (click)="selectPreset('instagram')"
                                >
                                    📸 Instagram
                                </button>
                                <button
                                    class="preset-btn"
                                    [class.active]="selectedPreset() === 'custom'"
                                    (click)="selectPreset('custom')"
                                >
                                    ⚙️ Personalizado
                                </button>
                            </div>
                        </div>

                        <div class="setting-group">
                            <label>Nombre del archivo</label>
                            <input
                                type="text"
                                [value]="filename()"
                                (input)="filename.set($any($event.target).value)"
                                placeholder="mi-video.mp4"
                                class="input-field"
                            />
                        </div>

                        <!-- Formato -->
                        <div class="setting-group">
                            <label>Formato de Video</label>
                            <select
                                [value]="format()"
                                (change)="onFormatChange($any($event.target).value)"
                                class="select-field"
                                [disabled]="selectedPreset() !== 'custom'"
                            >
                                <option value="mp4">MP4 (H.264)</option>
                            </select>
                            <small style="color: #999; font-size: 0.75rem; margin-top: 0.25rem;">
                                Exportación profesional con FFmpeg del servidor
                            </small>
                        </div>

                        <!-- Resolución -->
                        <div class="setting-group">
                            <label>Resolución</label>
                            <div class="resolution-grid">
                                <input
                                    type="number"
                                    [value]="width()"
                                    (input)="width.set(+$any($event.target).value)"
                                    class="input-field"
                                    placeholder="Ancho"
                                    min="1"
                                    [disabled]="selectedPreset() !== 'custom'"
                                />
                                <span class="resolution-x">×</span>
                                <input
                                    type="number"
                                    [value]="height()"
                                    (input)="height.set(+$any($event.target).value)"
                                    class="input-field"
                                    placeholder="Alto"
                                    min="1"
                                    [disabled]="selectedPreset() !== 'custom'"
                                />
                            </div>
                        </div>

                        <div class="setting-group">
                            <label>FPS (Frames por segundo)</label>
                            <select
                                [value]="fps()"
                                (change)="fps.set(+$any($event.target).value)"
                                class="select-field"
                                [disabled]="selectedPreset() !== 'custom'"
                            >
                                <option [value]="24">24 FPS (Estándar/Cine)</option>
                                <option [value]="48">48 FPS (Alta calidad)</option>
                            </select>
                        </div>

                        <div class="info-box">
                            <p>
                                <strong>Duración:</strong>
                                {{ formatDuration(store.totalDuration()) }}
                            </p>
                            <p><strong>Clips:</strong> {{ store.clips().length }}</p>
                            <p><strong>Resolución:</strong> {{ width() }}×{{ height() }}</p>
                            <p><strong>Formato:</strong> {{ format().toUpperCase() }}</p>
                        </div>
                    </div>

                    <div class="dialog-actions">
                        <button class="btn btn-secondary" (click)="close()">Cancelar</button>
                        <button class="btn btn-primary" (click)="startExport()">
                            🎬 Exportar Video
                        </button>
                    </div>
                    } @else {
                    <div class="export-progress">
                        <div class="progress-header">
                            <h3>{{ exportService.exportProgress().message }}</h3>
                            <p class="progress-stage">
                                {{ getStageText(exportService.exportProgress().stage) }}
                            </p>
                        </div>

                        <div class="progress-bar-container">
                            <div
                                class="progress-bar"
                                [style.width.%]="exportService.exportProgress().progress"
                            ></div>
                        </div>

                        <p class="progress-text">{{ exportService.exportProgress().progress }}%</p>

                        @if (exportService.exportProgress().stage === 'complete') {
                        <div class="success-message">
                            <svg
                                width="64"
                                height="64"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                                <polyline
                                    points="22 4 12 14.01 9 11.01"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                            <p>¡Video exportado exitosamente!</p>
                            <button class="btn btn-primary" (click)="close()">Cerrar</button>
                        </div>
                        } @else if (exportService.exportProgress().stage === 'error') {
                        <div class="error-message">
                            <p>{{ exportService.exportProgress().message }}</p>
                            <button class="btn btn-secondary" (click)="close()">Cerrar</button>
                        </div>
                        }
                    </div>
                    }
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .export-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(4px);
            }

            .export-dialog {
                background: #1e1e1e;
                border-radius: 12px;
                width: 90%;
                max-width: 700px;
                max-height: 90vh;
                overflow: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                border: 1px solid #333;
            }

            .dialog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid #333;
            }

            .dialog-header h2 {
                margin: 0;
                color: #fff;
                font-size: 1.5rem;
            }

            .close-btn {
                background: none;
                border: none;
                color: #999;
                font-size: 2rem;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .close-btn:hover {
                background: #333;
                color: #fff;
            }

            .dialog-body {
                padding: 1.5rem;
            }

            .export-settings {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            .setting-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .setting-group label {
                color: #ccc;
                font-size: 0.875rem;
                font-weight: 500;
            }

            .preset-buttons {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }

            .preset-btn {
                padding: 0.75rem;
                background: #2a2a2a;
                border: 2px solid #444;
                border-radius: 8px;
                color: #ccc;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s;
            }

            .preset-btn:hover {
                border-color: #007acc;
                background: #333;
            }

            .preset-btn.active {
                border-color: #007acc;
                background: rgba(0, 122, 204, 0.2);
                color: #fff;
            }

            .codec-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 1rem;
            }

            .resolution-grid {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 0.5rem;
                align-items: center;
            }

            .resolution-x {
                color: #666;
                font-size: 1.25rem;
                text-align: center;
            }

            .input-field,
            .select-field {
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 0.75rem;
                color: #fff;
                font-size: 0.875rem;
                transition: all 0.2s;
            }

            .input-field:disabled,
            .select-field:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .input-field:focus,
            .select-field:focus {
                outline: none;
                border-color: #007acc;
                box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
            }

            .info-box {
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 1rem;
                color: #ccc;
            }

            .info-box p {
                margin: 0.5rem 0;
            }

            .dialog-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
                margin-top: 2rem;
            }

            .btn {
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                border: none;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .btn-secondary {
                background: #444;
                color: white;
            }

            .btn-secondary:hover {
                background: #555;
            }

            .export-progress {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                padding: 1rem 0;
            }

            .progress-header h3 {
                margin: 0 0 0.5rem 0;
                color: #fff;
                font-size: 1.25rem;
            }

            .progress-stage {
                margin: 0;
                color: #999;
                font-size: 0.875rem;
            }

            .progress-bar-container {
                width: 100%;
                height: 8px;
                background: #2a2a2a;
                border-radius: 4px;
                overflow: hidden;
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #007acc, #00a8ff);
                transition: width 0.3s ease;
                border-radius: 4px;
            }

            .progress-text {
                text-align: center;
                color: #ccc;
                font-size: 1.5rem;
                font-weight: 600;
                margin: 0;
            }

            .success-message,
            .error-message {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
                padding: 2rem;
                text-align: center;
            }

            .success-message svg {
                color: #4caf50;
            }

            .success-message p {
                color: #fff;
                font-size: 1.125rem;
                margin: 0;
            }

            .error-message p {
                color: #ff4d4d;
                margin: 0;
            }
        `,
    ],
})
export class ExportDialogComponent {
    store = inject(EditorStore);
    exportService = inject(ExportService);

    @Output() closeDialog = new EventEmitter<void>();

    isExporting = signal(false);
    selectedPreset = signal<PresetType>('youtube');
    filename = signal('mi-video.mp4');
    format = signal<ExportFormat>('mp4');
    width = signal(1920);
    height = signal(1080);
    fps = signal(24);

    selectPreset(preset: PresetType) {
        this.selectedPreset.set(preset);

        if (preset !== 'custom') {
            const options = this.exportService.getPresetOptions(preset);
            this.format.set(options.format);
            this.width.set(options.width);
            this.height.set(options.height);
            this.fps.set(options.fps);

            // Actualizar extensión del archivo
            const currentName = this.filename().split('.')[0];
            this.filename.set(`${currentName}.${options.format}`);
        }
    }

    close() {
        if (!this.isExporting()) {
            this.closeDialog.emit();
        }
    }

    async startExport() {
        this.isExporting.set(true);

        try {
            // Preparar assets map
            const assetsMap = new Map();
            this.store.assets().forEach((asset) => {
                assetsMap.set(asset.id, asset);
            });

            // Configurar opciones de exportación
            const options = {
                format: this.format(),
                width: this.width(),
                height: this.height(),
                fps: this.fps(),
            };

            // Exportar video
            const videoBlob = await this.exportService.exportVideo(
                this.store.clips(),
                this.store.tracks(),
                assetsMap,
                options
            );

            // Descargar video
            this.exportService.downloadVideo(videoBlob, this.filename());

            // Esperar un momento para que el usuario vea el mensaje de éxito
            setTimeout(() => {
                this.isExporting.set(false);
                this.closeDialog.emit();
            }, 2000);
        } catch (error) {
            console.error('Export failed:', error);
            // En caso de error, permitir que el usuario cierre el modal
            this.isExporting.set(false);
        }
    }

    formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    onFormatChange(value: string) {
        this.format.set(value as ExportFormat);
    }

    getStageText(stage: ExportProgress['stage']): string {
        const stages = {
            preparing: 'Preparando proyecto...',
            uploading: 'Enviando al servidor...',
            processing: 'Procesando en servidor...',
            complete: 'Completado',
            error: 'Error',
        };
        return stages[stage];
    }
}
