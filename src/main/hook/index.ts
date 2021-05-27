import EventEmitter from 'events';
import { waitProcessForExit } from '@main/win32';
import { WindowEventHook } from './windowEventHook';
import { GlobalKeyboardEventHook } from './GlobalKeyboardEventHook';
import { GlobalMouseEventHook } from './GlobalMouseEventHook';
import logger from '@logger/hook';

export declare interface Hook extends NodeJS.EventEmitter {
    on(event: 'window-move', listener: (arg: { diffLeft: number, diffTop: number }) => void): this;
    on(event: 'window-minimize', listener: () => void): this;
    on(event: 'window-restore', listener: () => void): this;
    on(event: 'game-exit', listener: () => void): this;
    on(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    on(event: 'key-down', listener: (code: number) => void): this;
    on(event: 'key-up', listener: (code: number) => void): this;
    on(event: 'mouse-left-down', listener: () => void): this;
    on(event: 'mouse-left-up', listener: () => void): this;
    on(event: 'mouse-wheel', listener: () => void): this;

    once(event: 'window-move', listener: (arg: { diffLeft: number, diffTop: number }) => void): this;
    once(event: 'window-minimize', listener: () => void): this;
    once(event: 'window-restore', listener: () => void): this;
    once(event: 'game-exit', listener: () => void): this;
    once(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    once(event: 'key-down', listener: (code: number) => void): this;
    once(event: 'key-up', listener: (code: number) => void): this;
    once(event: 'mouse-left-down', listener: () => void): this;
    once(event: 'mouse-left-up', listener: () => void): this;
    once(event: 'mouse-wheel', listener: () => void): this;

    off(event: 'window-move', listener: (arg: { diffLeft: number, diffTop: number }) => void): this;
    off(event: 'window-minimize', listener: () => void): this;
    off(event: 'window-restore', listener: () => void): this;
    off(event: 'game-exit', listener: () => void): this;
    off(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    off(event: 'key-down', listener: (code: number) => void): this;
    off(event: 'key-up', listener: (code: number) => void): this;
    off(event: 'mouse-left-down', listener: () => void): this;
    off(event: 'mouse-left-up', listener: () => void): this;
    off(event: 'mouse-wheel', listener: () => void): this;
}

export class Hook extends EventEmitter {
    private windowEventHook?: WindowEventHook;
    private keyboardEventHook?: GlobalKeyboardEventHook;
    private mouseEventHook?: GlobalMouseEventHook;

    private constructor(
        public gamePids: number[]
    ) {
        super();
        logger('start hook for pids %O', this.gamePids);
        waitProcessForExit(this.gamePids).then(() => this.emit('game-exit'));
    }

    public static async create(gamePids: number[]) {
        const hook = new Hook(gamePids);
        hook.windowEventHook = await WindowEventHook.create(hook, gamePids);
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
        this.windowEventHook?.destroy();
        this.unregisterKeyboardAndMouseHook();
    }
}
