import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function dictQuery(word: string) {
    return handleError(electron.ipcRenderer.invoke('dict-query', word));
}
