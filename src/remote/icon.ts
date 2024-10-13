import electron from 'electron';
import { defineRemoteFunction } from '@remote/common';

export const readIcon = defineRemoteFunction('read-icon', async (event, path: string) => {
    const icon = await electron.app.getFileIcon(path);
    return icon.toDataURL();
});
