import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';
import electron from 'electron';

export const dictQuery = defineRemoteFunction('dict-query', requireContext, async (event, text: string) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
  return window.context.dictManager.query(text);
});
