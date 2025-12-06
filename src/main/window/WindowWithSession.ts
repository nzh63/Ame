import type { Session } from '@main/Session';
import type { BrowserWindowConstructorOptions } from 'electron';
import { BrowserWindow } from 'electron';

export class WindowWithSession extends BrowserWindow {
  public constructor(
    public session: Session,
    options?: BrowserWindowConstructorOptions,
  ) {
    super(options);
  }
}
