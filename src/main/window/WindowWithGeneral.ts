import type { General } from '@main/General';
import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

export class WindowWithGeneral extends BrowserWindow {
    constructor(
        public general: General,
        options?: BrowserWindowConstructorOptions
    ) {
        super(options);
    }
}
