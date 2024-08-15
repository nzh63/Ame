import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import logger from '@logger/remote/icon';

ipcMain.handle('read-icon', handleError(async (event: IpcMainInvokeEvent, path: string) => {
    logger('read-icon %s', path);
    const icon = await app.getFileIcon(path);
    return icon.toDataURL();
}));
