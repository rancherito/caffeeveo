import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '../../store/editor.store';
import { Asset, AssetType } from '../../models/editor.models';

@Component({
    selector: 'app-asset-library',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="asset-library">
            <div class="header">
                <h3>Assets</h3>
                <input type="file" #fileInput (change)="onFileSelected($event)" multiple style="display: none">
                <button (click)="fileInput.click()">Import Media</button>
            </div>
            
            <div class="assets-list">
                @for (asset of store.assets(); track asset.id) {
                    <div class="asset-item" 
                         [class.processing]="asset.isProcessing"
                         draggable="true" 
                         (dragstart)="onDragStart($event, asset)">
                        <div class="thumbnail">
                            @if (asset.type === 'image') {
                                <img [src]="asset.url" [alt]="asset.name">
                            } @else if (asset.type === 'video') {
                                @if (asset.isProcessing) {
                                    <div class="processing-overlay">
                                        <div class="spinner"></div>
                                        <span>{{ asset.processingProgress?.toFixed(0) }}%</span>
                                    </div>
                                }
                                <video [src]="asset.url"></video>
                            } @else {
                                <div class="audio-icon">🎵</div>
                            }
                        </div>
                        <div class="info">
                            <span class="name">{{ asset.name }}</span>
                            <span class="duration">
                                {{ formatDuration(asset.duration || 0) }}
                                @if (asset.frames && !asset.isProcessing) {
                                    · {{ asset.frames.length }}f
                                }
                            </span>
                        </div>
                        <button 
                            (click)="addToTimeline(asset)"
                            [disabled]="asset.isProcessing">
                            +
                        </button>
                    </div>
                } @empty {
                    <div class="empty-state">No assets imported</div>
                }
            </div>
        </div>
    `,
    styles: [`
        .asset-library {
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
            color: white;
            border-right: 1px solid #333;
        }
        .header {
            padding: 1rem;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .assets-list {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 1rem;
        }
        .asset-item {
            background: #2d2d2d;
            border-radius: 4px;
            overflow: hidden;
            cursor: grab;
            position: relative;
            transition: opacity 0.3s;
        }
        .asset-item.processing {
            opacity: 0.7;
        }
        .thumbnail {
            height: 80px;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .processing-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            z-index: 10;
        }
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 5px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .thumbnail img, .thumbnail video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .info {
            padding: 0.5rem;
            font-size: 0.8rem;
        }
        .name {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .duration {
            color: #888;
            font-size: 0.7rem;
        }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover:not(:disabled) {
            background: #005a9e;
        }
        button:disabled {
            background: #555;
            cursor: not-allowed;
            opacity: 0.5;
        }
    `]
})
export class AssetLibraryComponent {
    store = inject(EditorStore);

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            Array.from(input.files).forEach(file => {
                let type: AssetType = 'video';
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('audio/')) type = 'audio';
                
                this.store.addAsset(file, type);
            });
            // Reset input to allow selecting the same file again
            input.value = '';
        }
    }

    onDragStart(event: DragEvent, asset: Asset) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('application/json', JSON.stringify(asset));
            event.dataTransfer.effectAllowed = 'copy';
        }
    }

    addToTimeline(asset: Asset) {
        // Find first compatible track or default to first track
        const track = this.store.tracks().find(t => t.type === asset.type) || this.store.tracks()[0];
        this.store.addClipToTrack(asset, track.id, this.store.currentTime());
    }

    formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
