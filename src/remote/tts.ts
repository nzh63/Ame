import type { WindowWithSession } from '@main/window/WindowWithSession';
import { defineRemoteFunction, requireSession } from '@remote/common';
import electron from 'electron';

export const ttsSpeak = defineRemoteFunction(
  'tts-speak',
  requireSession,
  (event, text: string, type: 'original' | 'translate') => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    return window.session.ttsManager.speak(text, type);
  },
);

export function onTtsReply(callback: () => void) {
  electron.ipcRenderer.on('tts-speak-reply', callback);
}

export function offTtsReply(callback: () => void) {
  electron.ipcRenderer.off('tts-speak-reply', callback);
}
