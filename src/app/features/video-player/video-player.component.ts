import { Component } from '@angular/core';
import { VideoLoaderComponent } from './components/video-loader/video-loader.component';
import { CanvasPlayerComponent } from './components/canvas-player/canvas-player.component';

@Component({
  selector: 'app-video-player',
  imports: [VideoLoaderComponent, CanvasPlayerComponent],
  template: `
    <div class="video-player-page">
      <header class="page-header">
        <h1>🎬 Reproductor de Videos</h1>
        <p>Carga videos, visualiza sus metadatos y reprodúcelos secuencialmente en canvas</p>
      </header>

      <div class="player-container">
        <section class="player-section">
          <h2>Reproductor</h2>
          <app-canvas-player />
        </section>

        <section class="loader-section">
          <h2>Biblioteca de Videos</h2>
          <app-video-loader />
        </section>
      </div>
    </div>
  `,
  styles: [`
    .video-player-page {
      min-height: 100vh;
      background: #f5f5f5;
      padding: 2rem;
    }

    .page-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .page-header h1 {
      margin: 0 0 0.5rem 0;
      color: #333;
      font-size: 2.5rem;
    }

    .page-header p {
      margin: 0;
      color: #666;
      font-size: 1.1rem;
    }

    .player-container {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 2rem;
      max-width: 1600px;
      margin: 0 auto;
    }

    @media (max-width: 1024px) {
      .player-container {
        grid-template-columns: 1fr;
      }
    }

    .player-section,
    .loader-section {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .player-section h2,
    .loader-section h2 {
      margin: 0 0 1.5rem 0;
      color: #333;
      font-size: 1.5rem;
      border-bottom: 2px solid #007bff;
      padding-bottom: 0.5rem;
    }
  `]
})
export class VideoPlayerComponent {}
