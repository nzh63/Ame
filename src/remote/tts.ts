import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';
import electron from 'electron';

export const ttsSpeak = defineRemoteFunction(
  'tts-speak',
  requireContext,
  (event, text: string, type: 'original' | 'translate') => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    return window.context.ttsManager.speak(text, type);
  },
);

export function onTtsReply(callback: () => void) {
  electron.ipcRenderer.on('tts-speak-reply', callback);
}

export function offTtsReply(callback: () => void) {
  electron.ipcRenderer.off('tts-speak-reply', callback);
}
