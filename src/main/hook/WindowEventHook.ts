import EventEmitter from 'events';
import { user32 } from '@main/win32';
import logger from '@logger/hook/windowEvent';

export class WindowEventHook {
    private windowEventHookHandles: ReturnType<typeof user32.SetWinEventHook>[] = [];
    constructor(
        public event: EventEmitter,
        public gamePids: number[]
    ) {
        this.startHook();
    }

    private startHook() {
        logger('WindowEvent hook for pids %O', this.gamePids);
        const moveHookHandles = this.startWindowMoveHook();
        const minimizeHookHandles = this.startWindowMinimizeHook();
        this.windowEventHookHandles = [...moveHookHandles, ...minimizeHookHandles];
    }

    private startWindowMoveHook() {
        return this.gamePids.map(pid => {
            let lastRect: [number, number] | null = null;
            const handle = user32.SetWinEventHook(
                0x000A /* EVENT_SYSTEM_MOVESIZESTART */,
                0x000B /* EVENT_SYSTEM_MOVESIZEEND */,
                0,
                (hWinEventHook, event, hwnd, idObject, idChild, idEventThread, dwmsEventTime) => {
                    const rect = Buffer.alloc(4 * 4, 0);
                    const ret = user32.GetWindowRect(hwnd, rect);
                    if (ret) {
                        const left = rect.readInt32LE(0);
                        const top = rect.readInt32LE(4);
                        if (event === 0x000A /* EVENT_SYSTEM_MOVESIZESTART */) {
                            lastRect = [left, top];
                        } else if (event === 0x000B /* EVENT_SYSTEM_MOVESIZEEND */) {
                            if (lastRect) {
                                const [oldLeft, oldTop] = lastRect;
                                const diffLeft = left - oldLeft;
                                const diffTop = top - oldTop;
                                logger('game windows move %O', { diffLeft, diffTop });
                                this.event.emit('window-move', { diffLeft, diffTop });
                            }
                            lastRect = null;
                        }
                    }
                },
                pid,
                0,
                0x0000 // WINEVENT_OUTOFCONTEXT
            );
            return handle;
        });
    }

    private startWindowMinimizeHook() {
        return this.gamePids.map(pid => {
            const handle = user32.SetWinEventHook(
                0x0016 /* EVENT_SYSTEM_MINIMIZESTART */,
                0x0017 /* EVENT_SYSTEM_MINIMIZEEND */,
                0,
                (hWinEventHook, event, hwnd, idObject, idChild, idEventThread, dwmsEventTime) => {
                    if (event === 0x0016 /* EVENT_SYSTEM_MINIMIZESTART */) {
                        this.event.emit('window-minimize');
                    } else if (event === 0x0017 /* EVENT_SYSTEM_MINIMIZEEND */) {
                        this.event.emit('window-restore');
                    }
                },
                pid,
                0,
                0x0000 // WINEVENT_OUTOFCONTEXT
            );
            return handle;
        });
    }

    private stopHook() {
        logger('stop WindowMove hook for pids %O', this.gamePids);
        for (const handle of this.windowEventHookHandles) {
            if (handle) {
                user32.UnhookWinEvent(handle);
            }
        }
        this.windowEventHookHandles = [];
    }

    public destroy() {
        logger('destroy, pids %O', this.gamePids);
        this.stopHook();
    }
}
