import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function startExtract(gamePids: number[], hookCode?: string) {
    return handleError(electron.ipcRenderer.invoke('start-extract', { gamePids, hookCode }));
}

export function getAllExtractText() {
    return handleError(electron.ipcRenderer.invoke('get-all-extract-text'));
}
