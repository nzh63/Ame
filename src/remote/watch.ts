import logger from '@logger/remote/watch';
import { defineRemoteFunction } from '@remote/common';
import electron from 'electron';

defineRemoteFunction('watch-original', async (event: Electron.IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
  const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
  const translatorWindow = electron.BrowserWindow.fromWebContents(event.sender);
  if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow))
    throw new Error('TranslatorWindow not found');
  translatorWindow.context.watchOriginal(key);
});

defineRemoteFunction('unwatch-original', async (event: Electron.IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
  const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
  const translatorWindow = electron.BrowserWindow.fromWebContents(event.sender);
  if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow))
    throw new Error('TranslatorWindow not found');
  translatorWindow.context.unwatchOriginal(key);
});

defineRemoteFunction('watch-translate', async (event: Electron.IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
  const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
  const translatorWindow = electron.BrowserWindow.fromWebContents(event.sender);
  if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow))
    throw new Error('TranslatorWindow not found');
  translatorWindow.context.watchTranslate(key);
});

defineRemoteFunction('unwatch-translate', async (event: Electron.IpcMainInvokeEvent, key: Ame.Extractor.Key) => {
  const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
  const translatorWindow = electron.BrowserWindow.fromWebContents(event.sender);
  if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow))
    throw new Error('TranslatorWindow not found');
  translatorWindow.context.unwatchTranslate(key);
});

type OriginalWatchCallback = (arg: Ame.Translator.OriginalText) => void;
type TranslateWatchCallback = (arg: Ame.Translator.TranslateResult) => void;
type TranslateWatchErrorCallback = (err: any, arg: Ame.Translator.TranslateResult) => void;

type Event<T extends (...args: never[]) => void> = (event: Electron.IpcRendererEvent, ...args: Parameters<T>) => void;

const originalWatchList: { [key in Ame.Extractor.Key]: Event<OriginalWatchCallback> } = {};
const translateWatchList: {
  [key in Ame.Extractor.Key]: [Event<TranslateWatchCallback>, Event<TranslateWatchErrorCallback>];
} = {};

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
  return electron.ipcRenderer.invoke('watch-original', key);
}

export function unwatchOriginal(key: Ame.Extractor.Key) {
  logger('unwatch original at %s', key);
  electron.ipcRenderer.off('original-watch-list-update', originalWatchList[key]);
  delete originalWatchList[key];
  return electron.ipcRenderer.invoke('unwatch-original', key);
}

export function watchTranslate(
  key: Ame.Extractor.Key,
  callback: TranslateWatchCallback,
  errCallback?: TranslateWatchErrorCallback,
) {
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
  return electron.ipcRenderer.invoke('watch-translate', key);
}

export function unwatchTranslate(key: Ame.Extractor.Key) {
  logger('unwatch translate at %s', key);
  electron.ipcRenderer.off('translate-watch-list-update', translateWatchList[key][0]);
  electron.ipcRenderer.off('translate-watch-list-update-error', translateWatchList[key][1]);
  delete translateWatchList[key];
  return electron.ipcRenderer.invoke('unwatch-translate', key);
}
