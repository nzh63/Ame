import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function startExtract(uuid: string, gamePids: number[], hookCode?: string, type?: string) {
    return handleError(electron.ipcRenderer.invoke('start-extract', { uuid, gamePids, hookCode, type }));
}

export function getAllExtractText() {
    return handleError(electron.ipcRenderer.invoke('get-all-extract-text'));
}

export function getExtractorType() {
    return handleError(electron.ipcRenderer.invoke('get-extractor-type'));
}

export function switchExtractorType(type: Ame.Extractor.ExtractorType) {
    return handleError(electron.ipcRenderer.invoke('switch-extractor-type', type));
}
