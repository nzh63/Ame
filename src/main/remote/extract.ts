import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { TranslatorWindow } from '@main/TranslatorWindow';
import { handleError } from '@main/remote/handle';
import { General } from '@main/General';
import logger from '@logger/remote/extract';

ipcMain.handle('start-extract', handleError(async (event: IpcMainInvokeEvent, arg: { gamePids: number[], hookCode?: string }) => {
    logger('start-extract %O', arg);
    const general = new General(arg.gamePids, arg.hookCode);
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
