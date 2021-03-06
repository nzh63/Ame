import type { IpcRendererEvent } from 'electron/renderer';
import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function resizeWindow(height: number, width?: number) {
    const maxHeight = 600;
    const minHeight = 48;
    height = Math.min(height, maxHeight);
    height = Math.max(height, minHeight);
    return handleError(electron.ipcRenderer.invoke('resize-window', { height, width }));
}

export function minimizeWindow() {
    return handleError(electron.ipcRenderer.invoke('minimize-window'));
}

export function hideWindow() {
    return handleError(electron.ipcRenderer.invoke('hide-window'));
}

export function setWindowAlwaysOnTop(flag: boolean) {
    return handleError(electron.ipcRenderer.invoke('set-window-always-on-top', flag));
}

export function showContextMenu(x?: number, y?: number) {
    return handleError(electron.ipcRenderer.invoke('show-context-menu', x, y));
}

export function onWindowFocus(callback: (event: IpcRendererEvent) => void) {
    return electron.ipcRenderer.on('window-focus', callback);
}

export function onWindowBlur(callback: (event: IpcRendererEvent) => void) {
    return electron.ipcRenderer.on('window-blur', callback);
}
