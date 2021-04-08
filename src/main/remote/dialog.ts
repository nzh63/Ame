import { dialog, ipcMain, IpcMainInvokeEvent, OpenDialogOptions } from 'electron';
import { handleError } from '@main/remote/handle';
import logger from '@logger/remote/dialog';

ipcMain.handle('show-open-dialog', handleError(async (event: IpcMainInvokeEvent, options: OpenDialogOptions) => {
    logger('options: %O', options);
    const { canceled, filePaths } = await dialog.showOpenDialog(options);
    logger('result: %O', { canceled, filePaths });
    if (!canceled) {
        return filePaths[0];
    }
}));
