import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function ttsSpeak(text: string, type: 'original' | 'translate') {
    return handleError(electron.ipcRenderer.invoke('tts-speak', text, type));
}

export function onTtsReply(callback: () => void) {
    electron.ipcRenderer.on('tts-speak-reply', callback);
}

export function offTtsReply(callback: () => void) {
    electron.ipcRenderer.off('tts-speak-reply', callback);
}
