import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import { TranslatorWindow } from '@main/window/TranslatorWindow';
import logger from '@logger/remote/windowOperation';

ipcMain.handle('resize-window', handleError(async (event: IpcMainInvokeEvent, arg: { height?: number, width?: number }) => {
    logger('resize-window: %O', arg);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        let [width, height] = window.getContentSize();
        width = arg.width ?? width;
        height = arg.height ?? height;
        window.setContentSize(width, height);
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('minimize-window', handleError(async (event: IpcMainInvokeEvent) => {
    logger('minimize-window');
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.minimize();
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('hide-window', handleError(async (event: IpcMainInvokeEvent) => {
    logger('hide-window');
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.hide();
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('set-window-always-on-top', handleError(async (event: IpcMainInvokeEvent, arg: boolean) => {
    logger('set-window-always-on-top: %O', arg);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.setAlwaysOnTop(arg);
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('show-context-menu', handleError(async (event: IpcMainInvokeEvent) => {
    logger('show-context-menu');
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.showContextMenu();
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));
