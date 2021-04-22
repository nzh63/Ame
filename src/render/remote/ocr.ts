import type { Region } from 'sharp';
import type { PreprocessOption } from '@main/extractor';
import { handleError } from '@render/remote/handle';

const electron = require('electron');

export async function getScreenCapture(force = false) {
    return await handleError(electron.ipcRenderer.invoke('get-screen-capture', force));
}

export function getScreenCaptureCropRect() {
    return handleError(electron.ipcRenderer.invoke('get-screen-capture-crop-rect'));
}

export function setScreenCaptureCropRect(rect: Region) {
    return handleError(electron.ipcRenderer.invoke('set-screen-capture-crop-rect', rect));
}

export function openOcrGuideWindow() {
    return handleError(electron.ipcRenderer.invoke('open-ocr-guide-window'));
}
export function getScreenCapturePreprocessOption() {
    return handleError(electron.ipcRenderer.invoke('get-screen-capture-preprocess-option'));
}
export function setScreenCapturePreprocessOption(option: PreprocessOption) {
    return handleError(electron.ipcRenderer.invoke('set-screen-capture-preprocess-option', option));
}
