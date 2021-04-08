import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function storeGet<T = unknown>(key: string, defaultValue?: T) {
    return handleError<T>(electron.ipcRenderer.invoke('store-get', key, defaultValue));
}

export function storeSet(key: string, value?: any) {
    return handleError<void>(electron.ipcRenderer.invoke('store-set', key, value));
}

export function storeHas(key: string) {
    return handleError<boolean>(electron.ipcRenderer.invoke('store-has', key));
}

export function storeReset(...keys: string[]) {
    return handleError<void>(electron.ipcRenderer.invoke('store-reset', ...keys));
}

export function storeDelete(key: string) {
    return handleError<void>(electron.ipcRenderer.invoke('store-delete', key));
}

export function storeClear() {
    return handleError<void>(electron.ipcRenderer.invoke('store-clear'));
}
