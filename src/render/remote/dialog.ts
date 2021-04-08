import type { OpenDialogOptions } from 'electron';
import { handleError } from './handle';

const electron = require('electron');
export function showOpenDialog(options: OpenDialogOptions) {
    return handleError(electron.ipcRenderer.invoke('show-open-dialog', options));
}
