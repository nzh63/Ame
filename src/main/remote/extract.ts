import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { WindowWithGeneral } from '@main/window/WindowWithContext';
import { handleError } from '@main/remote/handle';
import { Context } from '@main/Context';
import logger from '@logger/remote/extract';

ipcMain.handle('start-extract', handleError(async (event: IpcMainInvokeEvent, arg: { uuid: string, gamePids: number[], hookCode?: string, type?: Ame.Extractor.ExtractorType }) => {
    logger('start-extract %O', arg);
    const context = await Context.create(arg.uuid, arg.gamePids, arg.hookCode, arg.type);
    logger('create context for pid %o', context.gamePids);
}));

ipcMain.handle('get-all-extract-text', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return window.context.text;
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('get-extractor-type', handleError((event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return window.context.type;
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));

ipcMain.handle('switch-extractor-type', handleError((event: IpcMainInvokeEvent, type: Ame.Extractor.ExtractorType) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        window.context.switchExtractor(type);
    } else {
        throw new Error('You can only get extract text from a WindowWithGeneral');
    }
}));
