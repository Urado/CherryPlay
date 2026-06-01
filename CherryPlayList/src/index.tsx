import { bootstrapApp } from './bootstrap';

void bootstrapApp().then(() => import('./entry'));
