import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';
import electron from 'electron';

export const segment = defineRemoteFunction('segment', requireContext, (event, text: string) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
  return window.context.segmentManager.segment(text);
});
