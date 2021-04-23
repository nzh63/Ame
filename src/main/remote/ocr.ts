import type sharp from 'sharp';
import type { OcrExtractor, PreprocessOption } from '@main/extractor';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WindowWithGeneral } from '@main/window/WindowWithGeneral';
import { handleError } from '@main/remote/handle';

ipcMain.handle('get-screen-capture', handleError(async (event: IpcMainInvokeEvent, force = false) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in Ocr mode');
        } else {
            return (await (window.general.extractor as OcrExtractor).getLastCapture(force)).png().toBuffer();
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-screen-capture-crop-rect', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in Ocr mode');
        } else {
            return (window.general.extractor as OcrExtractor).rect;
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('set-screen-capture-crop-rect', handleError((event: IpcMainInvokeEvent, rect: sharp.Region) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.general.setOcrRect(rect);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('open-ocr-guide-window', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in Ocr mode');
        } else {
            window.general.openOcrGuideWindow();
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-screen-capture-preprocess-option', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (window.general.type !== 'ocr') {
            throw new Error('Not in Ocr mode');
        } else {
            return (window.general.extractor as OcrExtractor).preprocessOption;
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
ipcMain.handle('set-screen-capture-preprocess-option', handleError((event: IpcMainInvokeEvent, option: PreprocessOption) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.general.setOcrPreprocess(option);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
