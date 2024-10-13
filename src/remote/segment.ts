import type { WindowWithContext } from '@main/window/WindowWithContext';
import electron from 'electron';
import { defineRemoteFunction, requireContext } from '@remote/common';

export const segment = defineRemoteFunction('segment', requireContext, (event, text: string) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    return window.context.segmentManager.segment(text);
});
