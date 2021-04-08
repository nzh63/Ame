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

export function showContextMenu() {
    return handleError(electron.ipcRenderer.invoke('show-context-menu'));
}
