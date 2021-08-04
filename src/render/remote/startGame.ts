import { handleError } from '@render/remote/handle';

const electron = require('electron');

function t<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

export function startGame(game: Ame.GameSetting) {
    return handleError(electron.ipcRenderer.invoke('start-game', t(game)));
}
