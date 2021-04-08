import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import { TranslatorWindow } from '@main/TranslatorWindow';
import logger from '@logger/remote/tts';

ipcMain.handle('tts-speak', handleError((event: IpcMainInvokeEvent, text: string, type: 'original' | 'translate') => {
    logger('tts-speak %O ', { text, type });
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window instanceof TranslatorWindow) {
        return window.general.ttsManager.speak(text, type);
    } else {
        throw new Error('You can only get extract text from a TranslatorWindow');
    }
}));
