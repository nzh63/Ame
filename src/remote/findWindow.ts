import stream from 'stream';
import electron from 'electron';
import { defineRemoteFunction } from '@remote/common';
import logger from '@logger/remote/windowFinder';

export const findWindowByClick = defineRemoteFunction('find-window-by-click', async (event) => {
    const emitter = new stream.EventEmitter();
    const { GlobalMouseEventHook } = await import('@main/hook/GlobalMouseEventHook');
    const { findProcess } = await import('@main/win32');
    const hook = new GlobalMouseEventHook(emitter);
    try {
        const window = electron.BrowserWindow.fromWebContents(event.sender);
        window?.minimize();

        const n = new electron.Notification({ title: '请点击游戏窗口' });
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
});
