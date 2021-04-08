import EventEmitter from 'events';
import { waitProcessForExit } from '@main/win32';
import { WindowEventHook } from './windowEventHook';
import logger from '@logger/hook';

export declare interface Hook extends NodeJS.EventEmitter {
    on(event: 'window-move', listener: (arg: { diffLeft: number, diffTop: number }) => void): this;
    on(event: 'window-minimize', listener: () => void): this;
    on(event: 'window-restore', listener: () => void): this;
    on(event: 'game-exit', listener: () => void): this;
    on(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    once(event: 'window-move', listener: (arg: { diffLeft: number, diffTop: number }) => void): this;
    once(event: 'window-minimize', listener: () => void): this;
    once(event: 'window-restore', listener: () => void): this;
    once(event: 'game-exit', listener: () => void): this;
    once(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;

    off(event: 'window-move', listener: (arg: { diffLeft: number, diffTop: number }) => void): this;
    off(event: 'window-minimize', listener: () => void): this;
    off(event: 'window-restore', listener: () => void): this;
    off(event: 'game-exit', listener: () => void): this;
    off(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
}

export class Hook extends EventEmitter {
    private readonly windowEventHook: WindowEventHook;

    constructor(
        public gamePids: number[]
    ) {
        super();
        logger('start hook for pids %O', this.gamePids);
        this.windowEventHook = new WindowEventHook(this, this.gamePids);
        waitProcessForExit(this.gamePids).then(() => this.emit('game-exit'));
    }

    public destroy() {
        logger('end hook for pids %O', this.gamePids);
        this.windowEventHook.destroy();
    }
}
