import electron from 'electron';
import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';

export const getGameSetting = defineRemoteFunction('get-game-setting', requireContext, async (event) => {
    const { default: store } = await import('@main/store');
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    return store.get('games').find(i => i.uuid === window.context.uuid);
});

export const setGameSelectKeys = defineRemoteFunction('set-game-select-keys', async (event, keys: Ame.Extractor.Key[]) => {
    const { TranslatorWindow } = await import('@main/window/TranslatorWindow');
    const { default: store } = await import('@main/store');
    const translatorWindow = electron.BrowserWindow.fromWebContents(event.sender);
    if (!translatorWindow || !(translatorWindow instanceof TranslatorWindow)) throw new Error('TranslatorWindow not found');
    const games = store.get('games');
    const setting = games.find(i => i.uuid === translatorWindow.context.uuid);
    if (setting) {
        setting.selectKeys = keys;
    }
    store.set('games', games);
});
