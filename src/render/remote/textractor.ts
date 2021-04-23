import type { PostProcessOption } from '@main/extractor';
import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function getTextractorPostProcessOption() {
    return handleError(electron.ipcRenderer.invoke('get-textractor-post-process-option'));
}
export function setTextractorPostProcessOption(option: PostProcessOption) {
    return handleError(electron.ipcRenderer.invoke('set-textractor-post-process-option', option));
}
