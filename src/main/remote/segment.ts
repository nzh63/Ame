import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import { WindowWithGeneral } from '@main/window/WindowWithContext';
import logger from '@logger/remote/segment';

ipcMain.handle('segment', handleError((event: IpcMainInvokeEvent, text: string) => {
    logger('segment: %o', text);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return window.context.segmentManager.segment(text);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
