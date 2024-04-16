import type { Context } from '@main/Context';
import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

export class WindowWithGeneral extends BrowserWindow {
    constructor(
        public context: Context,
        options?: BrowserWindowConstructorOptions
    ) {
        super(options);
    }
}
