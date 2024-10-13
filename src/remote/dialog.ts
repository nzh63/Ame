import logger from '@logger/remote/dialog';
import { defineRemoteFunction } from '@remote/common';
import electron from 'electron';

export const showOpenDialog = defineRemoteFunction(
  'show-open-dialog',
  async (event, options: Electron.OpenDialogOptions) => {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog(options);
    logger('result: %O', { canceled, filePaths });
    if (!canceled) {
      return filePaths[0];
    }
  },
);
