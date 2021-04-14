import EventEmitter from 'events';
import { user32 } from '@main/win32';
import logger from '@logger/hook/globalmouseEventHook';

export class GlobalMouseEventHook {
    private mouseEventHookHandle?: ReturnType<typeof user32.SetWinEventHook>;
    constructor(
        public event: EventEmitter
    ) {
        this.startHook();
    }

    private startHook() {
        logger('start GlobalMouseEvent hook');
        this.mouseEventHookHandle = user32.SetWindowsHookExA(
            14, /* WH_MOUSE_LL */
            (nCode, wParam, lParam) => {
                if (nCode >= 0) {
                    const x = lParam.readUInt32LE(0);
                    const y = lParam.readUInt32LE(4);
                    if (wParam === 0x0201 /* WM_LBUTTONDOWN */) {
                        logger('mouse-left-down %O', { x, y });
                        setImmediate(() => this.event.emit('mouse-left-down', { x, y }));
                    } else if (wParam === 0x0202 /* WM_LBUTTONUP */) {
                        logger('mouse-left-up %O', { x, y });
                        setImmediate(() => this.event.emit('mouse-left-up', { x, y }));
                    } else if (wParam === 0x020A /* WM_MOUSEWHEEL */) {
                        logger('mouse-left-wheel %O', { x, y });
                        setImmediate(() => this.event.emit('mouse-left-wheel', { x, y }));
                    }
                }
                return user32.CallNextHookEx(0, nCode, wParam, lParam);
            },
            0,
            0
        );
        if (this.mouseEventHookHandle.nativeReturnValue) {
            logger('hook success');
        } else {
            logger('hook fail');
        }
    }

    private stopHook() {
        logger('stop GlobalKeyboardEvent hook');
        if (this.mouseEventHookHandle) {
            user32.UnhookWindowsHookEx(this.mouseEventHookHandle);
        }
        this.mouseEventHookHandle = undefined;
    }

    public destroy() {
        this.stopHook();
    }
}
