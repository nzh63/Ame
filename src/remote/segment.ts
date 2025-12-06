import type { WindowWithSession } from '@main/window/WindowWithSession';
import { defineRemoteFunction, requireSession } from '@remote/common';
import electron from 'electron';

export const segment = defineRemoteFunction('segment', requireSession, (event, text: string) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
  return window.session.segmentManager.segment(text);
});
