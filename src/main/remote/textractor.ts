import type { PostProcessOption } from '@main/extractor';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WindowWithGeneral } from '@main/window/WindowWithContext';
import { handleError } from '@main/remote/handle';

ipcMain.handle('get-textractor-post-process-option', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        if (!window.context.extractorTypeIs('textractor')) {
            throw new Error('Not in Textractor mode');
        } else {
            return window.context.extractor.postProcessOption;
        }
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
ipcMain.handle('set-textractor-post-process-option', handleError((event: IpcMainInvokeEvent, option: PostProcessOption) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.context.setTextractorPostProcess(option);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
