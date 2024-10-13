import type { Context } from '@main/Context';
import type { BrowserWindowConstructorOptions } from 'electron';
import { BrowserWindow } from 'electron';

export class WindowWithContext extends BrowserWindow {
  public constructor(
    public context: Context,
    options?: BrowserWindowConstructorOptions,
  ) {
    super(options);
  }
}
