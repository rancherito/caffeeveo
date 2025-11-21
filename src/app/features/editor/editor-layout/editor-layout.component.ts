import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetLibraryComponent } from '../components/asset-library/asset-library.component';
import { PreviewPlayerComponent } from '../components/preview-player/preview-player.component';
import { TimelineComponent } from '../components/timeline/timeline.component';

@Component({
    selector: 'app-editor-layout',
    standalone: true,
    imports: [
        CommonModule,
        AssetLibraryComponent,
        PreviewPlayerComponent,
        TimelineComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="editor-layout">
            <div class="top-section">
                <div class="sidebar">
                    <app-asset-library></app-asset-library>
                </div>
                <div class="main-preview">
                    <app-preview-player></app-preview-player>
                </div>
                <div class="properties-panel">
                    <!-- Placeholder for properties -->
                    <div style="padding: 1rem; color: #888;">Properties</div>
                </div>
            </div>
            <div class="bottom-section">
                <app-timeline></app-timeline>
            </div>
        </div>
    `,
    styles: [`
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
            padding: 1rem;
            display: flex;
            flex-direction: column;
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
    `]
})
export class EditorLayoutComponent {}
