import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WindowWithGeneral } from '@main/window/WindowWithGeneral';
import { handleError } from '@main/remote/handle';
import { General } from '@main/General';
import logger from '@logger/remote/extract';

ipcMain.handle('start-extract', handleError(async (event: IpcMainInvokeEvent, arg: { uuid: string, gamePids: number[], hookCode?: string, type?: Ame.Extractor.ExtractorType }) => {
    logger('start-extract %O', arg);
    const general = new General(arg.uuid, arg.gamePids, arg.hookCode, arg.type);
    logger('create general for pid %o', general.gamePids);
}));

ipcMain.handle('get-all-extract-text', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return window.general.text;
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-extractor-type', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return window.general.type;
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('switch-extractor-type', handleError((event: IpcMainInvokeEvent, type: Ame.Extractor.ExtractorType) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.general.switchExtractor(type);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
