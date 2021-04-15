import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function startExtract(gamePids: number[], hookCode?: string, type?: string) {
    return handleError(electron.ipcRenderer.invoke('start-extract', { gamePids, hookCode, type }));
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

export async function getScreenCapture() {
    return electron.nativeImage.createFromBuffer(await handleError(electron.ipcRenderer.invoke('get-screen-capture')));
}

export function getScreenCaptureCropRect() {
    return handleError(electron.ipcRenderer.invoke('get-screen-capture-crop-rect'));
}

export function setScreenCaptureCropRect(rect: Electron.Rectangle) {
    return handleError(electron.ipcRenderer.invoke('set-screen-capture-crop-rect', rect));
}
