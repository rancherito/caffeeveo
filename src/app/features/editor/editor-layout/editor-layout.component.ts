import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetLibraryComponent } from '../components/asset-library/asset-library.component';
import { PreviewPlayerComponent } from '../components/preview-player/preview-player.component';
import { TimelineComponent } from '../components/timeline/timeline.component';
import { ExportDialogComponent } from '../components/export-dialog/export-dialog.component';

@Component({
    selector: 'editor-layout',
    standalone: true,
    imports: [
        CommonModule,
        AssetLibraryComponent,
        PreviewPlayerComponent,
        TimelineComponent,
        ExportDialogComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="editor-layout">
            <div class="top-section">
                <div class="sidebar">
                    <asset-library></asset-library>
                </div>
                <div class="main-preview">
                    <div class="preview-header">
                        <button class="export-btn" (click)="showExportDialog.set(true)">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                                <polyline
                                    points="7 10 12 15 17 10"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                                <line
                                    x1="12"
                                    y1="15"
                                    x2="12"
                                    y2="3"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                            Exportar Video
                        </button>
                    </div>
                    <preview-player></preview-player>
                </div>
                <div class="properties-panel">
                    <!-- Placeholder for properties -->
                    <div style="padding: 1rem; color: #888;">Properties</div>
                </div>
            </div>
            <div class="bottom-section">
                <timeline></timeline>
            </div>

            @if (showExportDialog()) {
            <export-dialog (closeDialog)="showExportDialog.set(false)"></export-dialog>
            }
        </div>
    `,
    styles: [
        `
            .editor-layout {
                display: flex;
                flex-direction: column;
                height: 100vh;
                width: 100vw;
                overflow: hidden;
                background: #121212;
            }
            .top-section {
                flex: 1;
                display: flex;
                min-height: 0; /* Important for nested flex scrolling */
            }
            .sidebar {
                width: 300px;
                min-width: 200px;
            }
            .main-preview {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .preview-header {
                padding: 1rem;
                border-bottom: 1px solid #333;
                background: #1e1e1e;
                display: flex;
                justify-content: flex-end;
            }
            .export-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            .export-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
            }
            .export-btn:active {
                transform: translateY(0);
            }
            .export-btn svg {
                flex-shrink: 0;
            }
            .properties-panel {
                width: 250px;
                border-left: 1px solid #333;
                background: #1e1e1e;
            }
            .bottom-section {
                height: 300px;
                min-height: 200px;
            }
        `,
    ],
})
export class EditorLayoutComponent {
    showExportDialog = signal(false);
}
