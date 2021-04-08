import { ipcMain, IpcMainInvokeEvent } from 'electron';
import store from '@main/store';
import { handleError } from '@main/remote/handle';
import logger from '@logger/store';

ipcMain.handle('store-get', handleError(async (event: IpcMainInvokeEvent, key: string, defaultValue?: any
) => {
    return store.get(key, defaultValue);
}));

ipcMain.handle('store-set', handleError(async (event: IpcMainInvokeEvent, key: string, value?: any) => {
    logger('set %s = %O', key, value);
    return store.set(key, value);
}));

ipcMain.handle('store-has', handleError(async (event: IpcMainInvokeEvent, key: string) => {
    return store.has(key);
}));

ipcMain.handle('store-reset', handleError(async (event: IpcMainInvokeEvent, ...keys: string[]) => {
    logger('reset %O', keys);
    return store.reset(...keys as any[]);
}));

ipcMain.handle('store-delete', handleError(async (event: IpcMainInvokeEvent, key: string) => {
    logger('delete %s', key);
    return store.delete(key as any);
}));

ipcMain.handle('store-clear', handleError(async () => {
    logger('clear');
    return store.clear();
}));
