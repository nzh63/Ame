import { GlobalKeyboardEventHook } from './GlobalKeyboardEventHook';
import { GlobalMouseEventHook } from './GlobalMouseEventHook';
import { WindowEventHook } from './WindowEventHook';
import logger from '@logger/hook';
import { waitProcessForExit } from '@main/win32';
import EventEmitter from 'events';

export declare interface Hook extends NodeJS.EventEmitter {
  on: ((event: 'window-move', listener: (arg: { diffLeft: number; diffTop: number }) => void) => this) &
    ((event: 'window-minimize', listener: () => void) => this) &
    ((event: 'window-restore', listener: () => void) => this) &
    ((event: 'game-exit', listener: () => void) => this) &
    ((event: 'textractor-cli-exit', listener: (code: number | null) => void) => this) &
    ((event: 'key-down', listener: (code: number) => void) => this) &
    ((event: 'key-up', listener: (code: number) => void) => this) &
    ((event: 'mouse-left-down', listener: () => void) => this) &
    ((event: 'mouse-left-up', listener: () => void) => this) &
    ((event: 'mouse-wheel', listener: () => void) => this);

  once: ((event: 'window-move', listener: (arg: { diffLeft: number; diffTop: number }) => void) => this) &
    ((event: 'window-minimize', listener: () => void) => this) &
    ((event: 'window-restore', listener: () => void) => this) &
    ((event: 'game-exit', listener: () => void) => this) &
    ((event: 'textractor-cli-exit', listener: (code: number | null) => void) => this) &
    ((event: 'key-down', listener: (code: number) => void) => this) &
    ((event: 'key-up', listener: (code: number) => void) => this) &
    ((event: 'mouse-left-down', listener: () => void) => this) &
    ((event: 'mouse-left-up', listener: () => void) => this) &
    ((event: 'mouse-wheel', listener: () => void) => this);

  off: ((event: 'window-move', listener: (arg: { diffLeft: number; diffTop: number }) => void) => this) &
    ((event: 'window-minimize', listener: () => void) => this) &
    ((event: 'window-restore', listener: () => void) => this) &
    ((event: 'game-exit', listener: () => void) => this) &
    ((event: 'textractor-cli-exit', listener: (code: number | null) => void) => this) &
    ((event: 'key-down', listener: (code: number) => void) => this) &
    ((event: 'key-up', listener: (code: number) => void) => this) &
    ((event: 'mouse-left-down', listener: () => void) => this) &
    ((event: 'mouse-left-up', listener: () => void) => this) &
    ((event: 'mouse-wheel', listener: () => void) => this);
}

export class Hook extends EventEmitter {
  private WindowEventHook?: WindowEventHook;
  private keyboardEventHook?: GlobalKeyboardEventHook;
  private mouseEventHook?: GlobalMouseEventHook;

  private constructor(public gamePids: number[]) {
    super();
    logger('start hook for pids %O', this.gamePids);
    waitProcessForExit(this.gamePids).then(() => this.emit('game-exit'));
  }

  public static async create(gamePids: number[]) {
    const hook = new Hook(gamePids);
    hook.WindowEventHook = await WindowEventHook.create(hook, gamePids);
    return hook;
  }

  public registerKeyboardAndMouseHook() {
    if (!this.keyboardEventHook) this.keyboardEventHook = new GlobalKeyboardEventHook(this);
    if (!this.mouseEventHook) this.mouseEventHook = new GlobalMouseEventHook(this);
  }

  public unregisterKeyboardAndMouseHook() {
    this.keyboardEventHook?.destroy();
    this.mouseEventHook?.destroy();
    this.keyboardEventHook = undefined;
    this.mouseEventHook = undefined;
  }

  public destroy() {
    logger('end hook for pids %O', this.gamePids);
    this.WindowEventHook?.destroy();
    this.unregisterKeyboardAndMouseHook();
  }
}
