import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/editor/editor-layout/editor-layout.component').then(m => m.EditorLayoutComponent)
        
    },
    {
        path: 'video-player',
        loadComponent: () => import('./features/video-player/video-player.component').then(m => m.VideoPlayerComponent)
    }
];
