import logger from '@logger/remote';
import electron from 'electron';

type IpcResult<T> = { err: any } | { value: T };

export const defineRemoteFunction = import.meta.env.IS_MAIN_PROCESS
  ? defineRemoteFunctionInMain
  : (defineRemoteFunctionInRender as any as typeof defineRemoteFunctionInMain);

function defineRemoteFunctionInMain<
  Handle extends (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
  Args extends any[] = Parameters<Handle> extends [Electron.IpcMainInvokeEvent, ...infer Rest] ? Rest : [],
  T = Awaited<ReturnType<Handle>>,
  Middleware extends (event: Electron.IpcMainInvokeEvent, ...args: Args) => Ame.Awaitable<void> = (
    event: Electron.IpcMainInvokeEvent,
    ...args: Args
  ) => Ame.Awaitable<void>,
>(channel: string, ...handlers: [...Middleware[], Handle]): (...args: Args) => Promise<T> {
  const [handler, ...middlewares] = handlers.reverse() as [Handle, ...Middleware[]];
  middlewares.reverse();
  electron.ipcMain.handle(channel, async (event: Electron.IpcMainInvokeEvent, ...args: Args) => {
    try {
      logger('handle IPC action %s: %O', channel, args);
      for (const f of middlewares) {
        await f(event, ...args);
      }
      const value = await handler(event, ...args);
      return { value };
    } catch (err) {
      return { err };
    }
  });
  return () => null as any;
}

// render参数只需要channel，主要可以把handler给摇树优化掉
function defineRemoteFunctionInRender<Args extends any[], T>(channel: string) {
  return async function (...args: Args): Promise<T> {
    logger('invoke IPC action %s: %O', channel, args);
    const ret: IpcResult<T> = await electron.ipcRenderer.invoke(channel, ...args);
    if ('err' in ret) {
      throw ret.err;
    } else {
      return ret.value;
    }
  };
}

export async function requireSession(event: Electron.IpcMainInvokeEvent) {
  const window = electron.BrowserWindow.fromWebContents(event.sender);
  const { WindowWithSession } = await import('@main/window/WindowWithSession');
  if (!window || !(window instanceof WindowWithSession)) {
    throw new Error('this ipc call require send from from a WindowWithSession');
  }
}
