import type { WindowWithSession } from '@main/window/WindowWithSession';
import { defineRemoteFunction, requireSession } from '@remote/common';
import electron from 'electron';

export const dictQuery = defineRemoteFunction('dict-query', requireSession, async (event, text: string) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
  return window.session.dictManager.query(text);
});
