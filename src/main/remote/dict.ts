import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import { WindowWithGeneral } from '@main/window/WindowWithContext';
import logger from '@logger/remote/dict';

ipcMain.handle('dict-query', handleError((event: IpcMainInvokeEvent, text: string) => {
    logger('dict-query ', { text });
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return window.context.dictManager.query(text);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
