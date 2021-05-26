import type { IpcRendererEvent } from 'electron';
import { handleError } from '@render/remote/handle';
import logger from '@logger/remote/watch';

const electron = require('electron');

type OriginalWatchCallback = (arg: Ame.Translator.OriginalText) => void;
type TranslateWatchCallback = (arg: Ame.Translator.TranslateResult) => void;
type TranslateWatchErrorCallback = (err: any, arg: Ame.Translator.TranslateResult) => void;

type Event<T extends (...args: never[]) => void> = (event: IpcRendererEvent, ...args: Parameters<T>) => void;

const originalWatchList: { [key in Ame.Extractor.Key]: Event<OriginalWatchCallback> } = {};
const translateWatchList: { [key in Ame.Extractor.Key]: [Event<TranslateWatchCallback>, Event<TranslateWatchErrorCallback>] } = {};

export function watchOriginal(key: Ame.Extractor.Key, callback: OriginalWatchCallback) {
    logger('watch original at %s', key);
    if (originalWatchList[key]) {
        logger(`${key} has been watched, the old callback will be remove.`);
        unwatchOriginal(key);
    }
    const callbackWrapper: Event<OriginalWatchCallback> = (event, value) => {
        if (key === 'any' || key === value.key) {
            logger('original watch value update %O', value);
            callback(value);
        }
    };
    originalWatchList[key] = callbackWrapper;
    electron.ipcRenderer.on('original-watch-list-update', callbackWrapper);
    return handleError(electron.ipcRenderer.invoke('watch-original', key));
}

export function unwatchOriginal(key: Ame.Extractor.Key) {
    logger('unwatch original at %s', key);
    electron.ipcRenderer.off('original-watch-list-update', originalWatchList[key]);
    delete originalWatchList[key];
    return handleError(electron.ipcRenderer.invoke('unwatch-original', key));
}

export function watchTranslate(key: Ame.Extractor.Key, callback: TranslateWatchCallback, errCallback?: TranslateWatchErrorCallback) {
    logger('watch translate at %s', key);
    if (translateWatchList[key]) {
        logger(`${key} has been watched, the old callback will be remove.`);
        unwatchTranslate(key);
    }
    const callbackWrapper: Event<TranslateWatchCallback> = (event, value) => {
        if (key === 'any' || key === value.key) {
            logger('translate watch value update %O', value);
            callback(value);
        }
    };
    const errorCallbackWrapper: Event<TranslateWatchErrorCallback> = (event, err, value) => {
        if (key === 'any' || key === value.key) {
            logger('translate watch error %O %O', err, value);
            errCallback?.(err, value);
        }
    };
    translateWatchList[key] = [callbackWrapper, errorCallbackWrapper];
    electron.ipcRenderer.on('translate-watch-list-update', callbackWrapper);
    electron.ipcRenderer.on('translate-watch-list-update-error', errorCallbackWrapper);
    return handleError(electron.ipcRenderer.invoke('watch-translate', key));
}

export function unwatchTranslate(key: Ame.Extractor.Key) {
    logger('unwatch translate at %s', key);
    electron.ipcRenderer.off('translate-watch-list-update', translateWatchList[key][0]);
    electron.ipcRenderer.off('translate-watch-list-update-error', translateWatchList[key][1]);
    delete translateWatchList[key];
    return handleError(electron.ipcRenderer.invoke('unwatch-translate', key));
}
