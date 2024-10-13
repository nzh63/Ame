import electron from 'electron';
import { defineRemoteFunction } from '@remote/common';
import logger from '@logger/remote/windowOperation';

export const resizeWindow = defineRemoteFunction('resize-window', async (event, arg: { height?: number, width?: number }) => {
    const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        let [width, height] = window.getContentSize();
        width = arg.width ?? width;
        height = arg.height ?? height;
        window.setContentSize(width, height);
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
});

export const minimizeWindow = defineRemoteFunction('minimize-window', async (event) => {
    logger('minimize-window');
    const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.minimize();
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
});

export const hideWindow = defineRemoteFunction('hide-window', async (event) => {
    const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.hide();
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
});

export const setWindowAlwaysOnTop = defineRemoteFunction('set-window-always-on-top', async (event, arg: boolean) => {
    const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.setAlwaysOnTop(arg, 'pop-up-menu');
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
});

export const showContextMenu = defineRemoteFunction('show-context-menu', async (event, x?: number, y?: number) => {
    const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
    const window = electron.BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.showContextMenu(x, y);
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
});

export function onWindowFocus(callback: (event: Electron.IpcRendererEvent) => void) {
    return electron.ipcRenderer.on('window-focus', callback);
}

export function onWindowBlur(callback: (event: Electron.IpcRendererEvent) => void) {
    return electron.ipcRenderer.on('window-blur', callback);
}
