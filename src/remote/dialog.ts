import electron from 'electron';
import { defineRemoteFunction } from '@remote/common';
import logger from '@logger/remote/dialog';

export const showOpenDialog = defineRemoteFunction('show-open-dialog', async (event, options: Electron.OpenDialogOptions) => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog(options);
    logger('result: %O', { canceled, filePaths });
    if (!canceled) {
        return filePaths[0];
    }
});
