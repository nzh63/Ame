import type { OCRExtractor } from '@main/extractor';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { TranslatorWindow } from '@main/TranslatorWindow';
import { handleError } from '@main/remote/handle';
import { General } from '@main/General';
import logger from '@logger/remote/extract';

ipcMain.handle('start-extract', handleError(async (event: IpcMainInvokeEvent, arg: { gamePids: number[], hookCode?: string, type?: Ame.Extractor.ExtractorType }) => {
    logger('start-extract %O', arg);
    const general = new General(arg.gamePids, arg.hookCode, arg.type);
    logger('create general for pid %o', general.gamePids);
}));

ipcMain.handle('get-all-extract-text', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        return window.general.text;
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('get-extractor-type', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        return window.general.type;
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('switch-extractor-type', handleError((event: IpcMainInvokeEvent, type: Ame.Extractor.ExtractorType) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        window.general.switchExtractor(type);
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('get-screen-capture', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in OCR mode');
        } else {
            return (window.general.extractor as OCRExtractor).getLastCapture().toPNG();
        }
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('get-screen-capture-crop-rect', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in OCR mode');
        } else {
            return (window.general.extractor as OCRExtractor).rect ?? { x: 0, y: 0, width: 100, height: 100 };
        }
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));

ipcMain.handle('set-screen-capture-crop-rect', handleError((event: IpcMainInvokeEvent, rect: Electron.Rectangle) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in OCR mode');
        } else {
            for (const i in rect) {
                rect[i as keyof Electron.Rectangle] = Math.round(rect[i as keyof Electron.Rectangle]);
            }
            (window.general.extractor as OCRExtractor).rect = rect;
        }
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));
