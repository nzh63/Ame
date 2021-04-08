import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function ttsSpeak(text: string, type: 'original' | 'translate') {
    return handleError(electron.ipcRenderer.invoke('tts-speak', text, type));
}

export function onTTSReply(callback: () => void) {
    electron.ipcRenderer.on('tts-speak-reply', callback);
}

export function offTTSReply(callback: () => void) {
    electron.ipcRenderer.off('tts-speak-reply', callback);
}
