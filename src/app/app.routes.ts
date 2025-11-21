import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/editor/editor-layout/editor-layout.component').then(m => m.EditorLayoutComponent)
        
    }
];
