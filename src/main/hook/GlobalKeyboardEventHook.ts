import EventEmitter from 'events';
import { user32 } from '@main/win32';
import logger from '@logger/hook/globalKeyboardEventHook';

export class GlobalKeyboardEventHook {
    private keyboardEventHookHandle?: ReturnType<typeof user32.SetWinEventHook>;
    constructor(
        public event: EventEmitter
    ) {
        this.startHook();
    }

    private startHook() {
        logger('start GlobalKeyboardEvent hook');
        this.keyboardEventHookHandle = user32.SetWindowsHookExA(
            13, /* WH_KEYBOARD_LL */
            (nCode, wParam, lParam) => {
                if (nCode >= 0) {
                    setImmediate(() => {
                        const vkCode = lParam.readInt32LE(0);
                        if (wParam === 0x0100 /* WM_KEYDOWN */) {
                            logger('key-down %d', vkCode);
                            this.event.emit('key-down', vkCode);
                        } else if (wParam === 0x0101 /* WM_KEYUP */) {
                            logger('key-up %d', vkCode);
                            this.event.emit('key-up', vkCode);
                        }
                    });
                }
                return user32.CallNextHookEx(0, nCode, wParam, lParam);
            },
            0,
            0
        );
        if (this.keyboardEventHookHandle.nativeReturnValue) {
            logger('hook success');
        } else {
            logger('hook fail');
        }
    }

    private stopHook() {
        logger('stop GlobalKeyboardEvent hook');
        if (this.keyboardEventHookHandle) {
            user32.UnhookWindowsHookEx(this.keyboardEventHookHandle);
        }
        this.keyboardEventHookHandle = undefined;
    }

    public destroy() {
        this.stopHook();
    }
}
