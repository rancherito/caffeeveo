import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '../../store/editor.store';
import { Asset, AssetType } from '../../models/editor.models';

@Component({
    selector: 'asset-library',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="asset-library">
            <div class="header">
                <h3>Assets</h3>
                <input
                    type="file"
                    #fileInput
                    (change)="onFileSelected($event)"
                    multiple
                    style="display: none"
                />
                <button class="import-btn" (click)="fileInput.click()">
                    <span class="icon">+</span> Import Media
                </button>
            </div>

            <div class="assets-list">
                @for (asset of store.assets(); track asset.id) {
                <div
                    class="asset-item"
                    [class.processing]="asset.isProcessing"
                    draggable="true"
                    (dragstart)="onDragStart($event, asset)"
                >
                    <div class="thumbnail">
                        @if (asset.type === 'image') {
                        <img [src]="asset.url" [alt]="asset.name" />
                        } @else if (asset.type === 'video') { @if (asset.isProcessing) {
                        <div class="processing-overlay">
                            <div class="spinner"></div>
                            <span>{{ asset.processingProgress?.toFixed(0) }}%</span>
                        </div>
                        }
                        <video [src]="asset.url"></video>
                        } @else {
                        <div class="audio-icon">
                            <span class="note-icon">🎵</span>
                        </div>
                        }

                        <button
                            class="add-btn"
                            (click)="addToTimeline(asset)"
                            [disabled]="asset.isProcessing"
                            title="Add to timeline"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>

                        <div class="type-badge">{{ asset.type }}</div>
                    </div>
                    <div class="info">
                        <span class="name" [title]="asset.name">{{ asset.name }}</span>
                        <div class="meta">
                            <span class="duration">
                                {{ formatDuration(asset.duration || 0) }}
                            </span>
                            @if (asset.frames && !asset.isProcessing) {
                            <span class="separator">•</span>
                            <span class="frames">{{ asset.frames.length }}f</span>
                            }
                        </div>
                    </div>
                </div>
                } @empty {
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <p>No assets imported yet</p>
                    <button class="text-btn" (click)="fileInput.click()">Browse files</button>
                </div>
                }
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
                overflow: hidden;
            }
            .asset-library {
                height: 100%;
                display: flex;
                flex-direction: column;
                background: #121212;
                color: #e0e0e0;
                border-right: 1px solid #2a2a2a;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .header {
                padding: 1.25rem;
                border-bottom: 1px solid #2a2a2a;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #1a1a1a;
            }
            .header h3 {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                color: #fff;
                letter-spacing: 0.02em;
            }
            .import-btn {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-weight: 500;
                font-size: 0.85rem;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .import-btn:hover {
                background: #2563eb;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .import-btn .icon {
                font-size: 1.1em;
                line-height: 1;
            }
            .assets-list {
                flex: 1;
                overflow-y: auto;
                padding: 1rem;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 0.75rem;
                align-content: start;
            }
            .assets-list::-webkit-scrollbar {
                width: 8px;
            }
            .assets-list::-webkit-scrollbar-track {
                background: transparent;
            }
            .assets-list::-webkit-scrollbar-thumb {
                background: #333;
                border-radius: 4px;
            }
            .assets-list::-webkit-scrollbar-thumb:hover {
                background: #444;
            }
            .asset-item {
                background: #252525;
                border-radius: 10px;
                overflow: hidden;
                cursor: grab;
                position: relative;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid #333;
                display: flex;
                flex-direction: column;
            }
            .asset-item:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
                border-color: #444;
                background: #2a2a2a;
            }
            .asset-item:active {
                cursor: grabbing;
            }
            .asset-item.processing {
                opacity: 0.7;
                pointer-events: none;
            }
            .thumbnail {
                aspect-ratio: 16/9;
                background: #000;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            }
            .thumbnail img,
            .thumbnail video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.5s ease;
            }
            .asset-item:hover .thumbnail img,
            .asset-item:hover .thumbnail video {
                transform: scale(1.05);
            }
            .audio-icon {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            }
            .note-icon {
                font-size: 2rem;
                opacity: 0.7;
            }
            .type-badge {
                position: absolute;
                bottom: 6px;
                left: 6px;
                background: rgba(0, 0, 0, 0.7);
                color: rgba(255, 255, 255, 0.9);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.65rem;
                font-weight: 600;
                text-transform: uppercase;
                backdrop-filter: blur(4px);
                pointer-events: none;
            }
            .add-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #3b82f6;
                color: white;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 5;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            }
            .asset-item:hover .add-btn {
                opacity: 1;
                transform: scale(1);
            }
            .add-btn:hover {
                background: #2563eb;
                transform: scale(1.1);
            }
            .processing-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                z-index: 10;
                backdrop-filter: blur(2px);
            }
            .spinner {
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 8px;
            }
            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
            .info {
                padding: 0.75rem;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }
            .name {
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 0.85rem;
                font-weight: 500;
                color: #f3f4f6;
                margin-bottom: 0.25rem;
            }
            .meta {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #9ca3af;
                font-size: 0.75rem;
            }
            .separator {
                color: #4b5563;
            }
            .empty-state {
                grid-column: 1 / -1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem 2rem;
                color: #6b7280;
                text-align: center;
                border: 2px dashed #333;
                border-radius: 12px;
                margin-top: 2rem;
            }
            .empty-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.5;
            }
            .text-btn {
                background: none;
                border: none;
                color: #3b82f6;
                cursor: pointer;
                font-size: 0.9rem;
                text-decoration: underline;
                padding: 0;
                margin-top: 0.5rem;
            }
            .text-btn:hover {
                color: #60a5fa;
            }
        `,
    ],
})
export class AssetLibraryComponent {
    store = inject(EditorStore);

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            Array.from(input.files).forEach((file) => {
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
        const track =
            this.store.tracks().find((t) => t.type === asset.type) || this.store.tracks()[0];
        this.store.addClipToTrack(asset, track.id, this.store.currentTime());
    }

    formatDuration(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
