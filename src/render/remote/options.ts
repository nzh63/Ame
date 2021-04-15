import store from '@render/store';
import { handleError } from '@render/remote/handle';

const electron = require('electron');

export function getTranslateProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-translate-providers-ids'));
}
export function getTranslateProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-translate-provider-options-meta', providerId));
}
export function getTranslateProviderOptions(providerId: string) {
    return store.get(`translateProviders.${providerId}`);
}
export function setTranslateProviderOptions(providerId: string, value: unknown) {
    return store.set(`translateProviders.${providerId}`, value);
}

export function getTTSProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-tts-providers-ids'));
}
export function getTTSProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-tts-provider-options-meta', providerId));
}
export function getTTSProviderOptions(providerId: string) {
    return store.get(`ttsProviders.${providerId}`);
}
export function setTTSProviderOptions(providerId: string, value: unknown) {
    return store.set(`ttsProviders.${providerId}`, value);
}

export function getOCRProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-ocr-providers-ids'));
}
export function getOCRProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-ocr-provider-options-meta', providerId));
}
export function getOCRProviderOptions(providerId: string) {
    return store.get(`ocrProviders.${providerId}`);
}
export function setOCRProviderOptions(providerId: string, value: unknown) {
    return store.set(`ocrProviders.${providerId}`, value);
}

export function getTTSManagerOptionsMeta() {
    return handleError(electron.ipcRenderer.invoke('get-tts-manager-options-meta'));
}
export function getTTSManagerOptions() {
    return store.get('ttsManager');
}
export function setTTSManagerOptions(_: string, value: unknown) {
    return store.set('ttsManager', value);
}
