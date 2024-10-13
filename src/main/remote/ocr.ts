import sharp from 'sharp';
import type { PreprocessOption } from '@main/extractor';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WindowWithGeneral } from '@main/window/WindowWithContext';
import { handleError } from '@main/remote/handle';

ipcMain.handle('get-screen-capture', handleError(async (event: IpcMainInvokeEvent, force = false) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (!window.context.extractorTypeIs('ocr')) {
            throw new Error('Not in Ocr mode');
        } else {
            return (await window.context.extractor.getLastCapture(force)).png().toBuffer();
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-preprocessed-image', handleError(async (event: IpcMainInvokeEvent, img: Buffer, option: PreprocessOption) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (!window.context.extractorTypeIs('ocr')) {
            throw new Error('Not in Ocr mode');
        } else {
            return await window.context.extractor.preprocess(sharp(img), option).png().toBuffer();
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-screen-capture-crop-rect', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (!window.context.extractorTypeIs('ocr')) {
            throw new Error('Not in Ocr mode');
        } else {
            return window.context.extractor.rect;
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('set-screen-capture-crop-rect', handleError((event: IpcMainInvokeEvent, rect: sharp.Region) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.context.setOcrRect(rect);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('open-ocr-guide-window', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (!window.context.extractorTypeIs('ocr')) {
            throw new Error('Not in Ocr mode');
        } else {
            window.context.openOcrGuideWindow();
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-screen-capture-preprocess-option', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (!window.context.extractorTypeIs('ocr')) {
            throw new Error('Not in Ocr mode');
        } else {
            return window.context.extractor.preprocessOption;
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
ipcMain.handle('set-screen-capture-preprocess-option', handleError((event: IpcMainInvokeEvent, option: PreprocessOption) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.context.setOcrPreprocess(option);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
