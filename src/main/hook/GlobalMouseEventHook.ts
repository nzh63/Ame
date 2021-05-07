import EventEmitter from 'events';
import { startGlobalMouseHook, stopHook, HANDLE } from '@addons/WindowsHook';
import logger from '@logger/hook/globalmouseEventHook';

export class GlobalMouseEventHook {
    private mouseEventHookHandle?: HANDLE;
    constructor(
        public event: EventEmitter
    ) {
        this.startHook();
    }

    private startHook() {
        logger('start GlobalMouseEvent hook');
        try {
            this.mouseEventHookHandle = startGlobalMouseHook((wParam, pt) => {
                logger('%O %O', wParam, pt);
                if (wParam === 0x0201 /* WM_LBUTTONDOWN */) {
                    logger('mouse-left-down %O', pt);
                    this.event.emit('mouse-left-down', pt);
                } else if (wParam === 0x0202 /* WM_LBUTTONUP */) {
                    logger('mouse-left-up %O', pt);
                    this.event.emit('mouse-left-up', pt);
                } else if (wParam === 0x020A /* WM_MOUSEWHEEL */) {
                    logger('mouse-wheel %O', pt);
                    this.event.emit('mouse-wheel', pt);
                }
            });
            logger('hook success');
        } catch (e) {
            this.mouseEventHookHandle = undefined;
            logger('hook fail %O', e);
        }
    }

    private stopHook() {
        logger('stop GlobalKeyboardEvent hook');
        if (this.mouseEventHookHandle) {
            stopHook(this.mouseEventHookHandle);
        }
        this.mouseEventHookHandle = undefined;
    }

    public destroy() {
        this.stopHook();
    }
}
