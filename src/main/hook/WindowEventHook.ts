import EventEmitter from 'events';
import WindowsEventHookAddons from '@addons/WindowEventHook';
import logger from '@logger/hook/windowEvent';

export class WindowEventHook {
    private WindowEventHookHandles: WindowsEventHookAddons.HWINEVENTHOOK[] = [];
    // eslint-disable-next-line no-useless-constructor
    private constructor(
        public event: EventEmitter,
        public gamePids: number[]
    ) {
    }

    public static async create(event: EventEmitter, gamePids: number[]) {
        const hook = new WindowEventHook(event, gamePids);
        await hook.startHook();
        return hook;
    }

    private async startHook() {
        logger('WindowEvent hook for pids %O', this.gamePids);
        const moveHookHandles = await this.startWindowMoveHook();
        const minimizeHookHandles = await this.startWindowMinimizeHook();
        this.WindowEventHookHandles = [...moveHookHandles, ...minimizeHookHandles];
    }

    private startWindowMoveHook() {
        return WindowsEventHookAddons.startWindowMoveHook(this.gamePids, diff => {
            logger('game windows move %O', diff);
            this.event.emit('window-move', diff);
        });
    }

    private startWindowMinimizeHook() {
        return WindowsEventHookAddons.startWindowMinimizeHook(this.gamePids, (isMinimize) => {
            if (isMinimize) {
                this.event.emit('window-minimize');
            } else {
                this.event.emit('window-restore');
            }
        });
    }

    private stopHook() {
        logger('stop WindowMove hook for pids %O', this.gamePids);
        WindowsEventHookAddons.stopWindowEventHook(this.WindowEventHookHandles);
        this.WindowEventHookHandles = [];
    }

    public destroy() {
        logger('destroy, pids %O', this.gamePids);
        this.stopHook();
    }
}
