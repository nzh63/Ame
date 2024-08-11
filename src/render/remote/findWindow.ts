import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function findWindowByClick() {
    return handleError(electron.ipcRenderer.invoke('find-window-by-click'));
}
