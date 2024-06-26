import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { TranslatorWindow } from '@main/window/TranslatorWindow';
import { handleError } from '@main/remote/handle';

ipcMain.handle('watch-original', handleError((event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
    const translatorWindow = BrowserWindow.fromWebContents(event.sender);
    if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow)) throw new Error('TranslatorWindow not found');
    translatorWindow.context.watchOriginal(key);
}));

ipcMain.handle('unwatch-original', handleError((event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
    const translatorWindow = BrowserWindow.fromWebContents(event.sender);
    if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow)) throw new Error('TranslatorWindow not found');
    translatorWindow.context.unwatchOriginal(key);
}));

ipcMain.handle('watch-translate', handleError((event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
    const translatorWindow = BrowserWindow.fromWebContents(event.sender);
    if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow)) throw new Error('TranslatorWindow not found');
    translatorWindow.context.watchTranslate(key);
}));

ipcMain.handle('unwatch-translate', handleError((event: IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
    const translatorWindow = BrowserWindow.fromWebContents(event.sender);
    if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow)) throw new Error('TranslatorWindow not found');
    translatorWindow.context.unwatchTranslate(key);
}));
