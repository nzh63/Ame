import logger from '@logger/remote/startGame';
import { defineRemoteFunction } from '@remote/common';
import path from 'path';

export const startGame = defineRemoteFunction('start-game', async (event, arg: Ame.GameSetting) => {
  const { findProcess, execPowerShell } = await import('@main/win32');
  const oldPids = await findProcess(arg.path);
  execPowerShell(arg.execShell, path.dirname(arg.path));
  for (let i = 0; i < 10; i++) {
    logger('wait for game to start, retry: %d', i);
    const newPids = (await findProcess(arg.path)).filter((i) => !oldPids.includes(i));
    if (newPids.length) {
      logger('find game pid: %O', newPids);
      return { pids: newPids };
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000);
    });
  }
  throw new Error('无法找到游戏进程');
});
