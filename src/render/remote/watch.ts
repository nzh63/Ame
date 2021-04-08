import type { IpcRendererEvent } from 'electron';
import type { OriginalWatchCallback, TranslateWatchCallback, TranslateWatchErrorCallback } from '@main/General';
import { handleError } from '@render/remote/handle';
import logger from '@logger/remote/watch';

const electron = require('electron');

type OriginalCallback = (event: IpcRendererEvent, arg: Ame.Translator.OriginalText) => void;
type TranslateCallback = (event: IpcRendererEvent, arg: Ame.Translator.TranslateResult) => void;
type TranslateErrorCallback = (event: IpcRendererEvent, err: any, arg: Ame.Translator.TranslateResult) => void;
const originalWatchList: { [key in Ame.Extractor.Key]: OriginalCallback } = {};
const translateWatchList: { [key in Ame.Extractor.Key]: [TranslateCallback, TranslateErrorCallback] } = {};

export function watchOriginal(key: Ame.Extractor.Key, callback: OriginalWatchCallback) {
    logger('watch original at %s', key);
    if (originalWatchList[key]) {
        logger(`${key} has been watched, the old callback will be remove.`);
        unwatchOriginal(key);
    }
    const callbackWrapper: OriginalCallback = (event, value) => {
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
    const callbackWrapper: TranslateCallback = (event, value) => {
        if (key === 'any' || key === value.key) {
            logger('translate watch value update %O', value);
            callback(value);
        }
    };
    const errorCallbackWrapper: TranslateErrorCallback = (event, err, value) => {
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
