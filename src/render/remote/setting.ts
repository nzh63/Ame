import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function getGameSetting() {
    return handleError(electron.ipcRenderer.invoke('get-game-setting'));
}

export function setGameSelectKeys(keys: Ame.Extractor.Key[]) {
    return handleError(electron.ipcRenderer.invoke('set-game-select-keys', keys));
}
