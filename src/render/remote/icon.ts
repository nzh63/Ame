import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function readIcon(path: string) {
    return handleError(electron.ipcRenderer.invoke('read-icon', path));
}
