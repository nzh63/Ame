import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function segment(text: string) {
    return handleError(electron.ipcRenderer.invoke('segment', text));
}
