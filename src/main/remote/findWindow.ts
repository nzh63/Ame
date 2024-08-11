import { EventEmitter } from 'stream';
import { BrowserWindow, Notification, ipcMain, IpcMainInvokeEvent } from 'electron';
import { handleError } from '@main/remote/handle';
import { GlobalMouseEventHook } from '@main/hook/GlobalMouseEventHook';
import { findProcess } from '@main/win32';
import logger from '@logger/remote/windowFinder';

ipcMain.handle('find-window-by-click', handleError(async (event: IpcMainInvokeEvent) => {
    const emitter = new EventEmitter();
    const hook = new GlobalMouseEventHook(emitter);
    try {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.minimize();

        const n = new Notification({ title: '请点击游戏窗口' });
        n.show();

        const pt: { x: number, y: number } = await new Promise(resolve => emitter.once('mouse-left-down', pt => resolve(pt)));
        logger('click at %o', pt);
        n.close();

        const pid = await findProcess(pt.x, pt.y);
        logger('find pid %o', pid);
        if (pid.length) {
            window?.show();
            return pid[0];
        } else {
            return undefined;
        }
    } finally {
        hook.destroy();
    }
}));
