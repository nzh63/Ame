import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function startExtract(gamePids: number[], hookCode?: string, type?: string) {
    return handleError(electron.ipcRenderer.invoke('start-extract', { gamePids, hookCode, type }));
}

export function getAllExtractText() {
    return handleError(electron.ipcRenderer.invoke('get-all-extract-text'));
}
