import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { findProcess, execPowerShell } from '@main/win32';
import { handleError } from '@main/remote/handle';
import logger from '@logger/remote/startGame';

ipcMain.handle('start-game', handleError(async (event: IpcMainInvokeEvent, arg: Ame.GameSetting) => {
    logger('arg: %O', arg);
    const oldPids = await findProcess(arg.path);
    execPowerShell(arg.execShell);
    for (let i = 0; i < 10; i++) {
        logger('wait for game to start, retry: %d', i);
        const newPids = (await findProcess(arg.path)).filter(i => !oldPids.includes(i));
        if (newPids.length) {
            logger('find game pid: %O', newPids);
            return { pids: newPids };
        }
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('无法找到游戏进程');
}));
