import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function startGame(game: Ame.GameSetting) {
    return handleError(electron.ipcRenderer.invoke('start-game', game));
}
