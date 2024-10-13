import type { HANDLE } from '@addons/WindowsHook';
import { startGlobalKeyboardHook, stopHook } from '@addons/WindowsHook';
import logger from '@logger/hook/globalKeyboardEventHook';
import type EventEmitter from 'events';

export class GlobalKeyboardEventHook {
  private keyboardEventHookHandle?: HANDLE;
  public constructor(public event: EventEmitter) {
    this.startHook();
  }

  private startHook() {
    logger('start GlobalKeyboardEvent hook');
    try {
      this.keyboardEventHookHandle = startGlobalKeyboardHook((wParam, vkCode) => {
        if (wParam === 0x0100 /* WM_KEYDOWN */) {
          logger('key-down %d', vkCode);
          this.event.emit('key-down', vkCode);
        } else if (wParam === 0x0101 /* WM_KEYUP */) {
          logger('key-up %d', vkCode);
          this.event.emit('key-up', vkCode);
        }
      });
      logger('hook success');
    } catch (e) {
      this.keyboardEventHookHandle = undefined;
      logger('hook fail %O', e);
    }
  }

  private stopHook() {
    logger('stop GlobalKeyboardEvent hook');
    if (this.keyboardEventHookHandle) {
      stopHook(this.keyboardEventHookHandle);
    }
    this.keyboardEventHookHandle = undefined;
  }

  public destroy() {
    this.stopHook();
  }
}
