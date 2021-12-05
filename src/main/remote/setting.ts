import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import { WindowWithGeneral } from '@main/window/WindowWithGeneral';
import { TranslatorWindow } from '@main/window/TranslatorWindow';
import store from '@main/store';

ipcMain.handle('get-game-setting', handleError(async (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof WindowWithGeneral) {
        return store.get('games').find(i => i.uuid === window.general.uuid);
    } else {
        throw new Error('You can only get setting from a WindowWithGeneral');
    }
}));

ipcMain.handle('set-game-select-keys', handleError(async (event: IpcMainInvokeEvent, keys: Ame.Extractor.Key[]) => {
    const translatorWindow = BrowserWindow.fromWebContents(event.sender);
    if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow)) throw new Error('TranslatorWindow not found');
    const games = store.get('games');
    const setting = games.find(i => i.uuid === translatorWindow.general.uuid);
    if (setting) {
        setting.selectKeys = keys;
    }
    store.set('games', games);
}));
