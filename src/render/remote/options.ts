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

export function getTtsProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-tts-providers-ids'));
}
export function getTtsProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-tts-provider-options-meta', providerId));
}
export function getTtsProviderOptions(providerId: string) {
    return store.get(`ttsProviders.${providerId}`);
}
export function setTtsProviderOptions(providerId: string, value: unknown) {
    return store.set(`ttsProviders.${providerId}`, value);
}

export function getOcrProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-ocr-providers-ids'));
}
export function getOcrProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-ocr-provider-options-meta', providerId));
}
export function getOcrProviderOptions(providerId: string) {
    return store.get(`ocrProviders.${providerId}`);
}
export function setOcrProviderOptions(providerId: string, value: unknown) {
    return store.set(`ocrProviders.${providerId}`, value);
}

export function getTtsManagerOptionsMeta() {
    return handleError(electron.ipcRenderer.invoke('get-tts-manager-options-meta'));
}
export function getTtsManagerOptions() {
    return store.get('ttsManager');
}
export function setTtsManagerOptions(_: string, value: unknown) {
    return store.set('ttsManager', value);
}

export function getOcrExtractorOptionsMeta() {
    return handleError(electron.ipcRenderer.invoke('get-ocr-extractor-options-meta'));
}
export function getOcrExtractorOptions() {
    return store.get('ocrExtractor');
}
export function setOcrExtractorOptions(_: string, value: unknown) {
    return store.set('ocrExtractor', value);
}

export function getSegmentManagerOptionsMeta() {
    return handleError(electron.ipcRenderer.invoke('get-segment-manager-options-meta'));
}
export function getSegmentManagerOptions() {
    return store.get('segmentManager');
}
export function setSegmentManagerOptions(_: string, value: unknown) {
    return store.set('segmentManager', value);
}

export function getSegmentProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-segment-providers-ids'));
}
export function getSegmentProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-segment-provider-options-meta', providerId));
}
export function getSegmentProviderOptions(providerId: string) {
    return store.get(`segmentProviders.${providerId}`);
}
export function setSegmentProviderOptions(providerId: string, value: unknown) {
    return store.set(`segmentProviders.${providerId}`, value);
}

export function getDictManagerOptionsMeta() {
    return handleError(electron.ipcRenderer.invoke('get-dict-manager-options-meta'));
}
export function getDictManagerOptions() {
    return store.get('dictManager');
}
export function setDictManagerOptions(_: string, value: unknown) {
    return store.set('dictManager', value);
}

export function getDictProvidersIDs() {
    return handleError(electron.ipcRenderer.invoke('get-dict-providers-ids'));
}
export function getDictProviderOptionsMeta(providerId: string) {
    return handleError(electron.ipcRenderer.invoke('get-dict-provider-options-meta', providerId));
}
export function getDictProviderOptions(providerId: string) {
    return store.get(`dictProviders.${providerId}`);
}
export function setDictProviderOptions(providerId: string, value: unknown) {
    return store.set(`dictProviders.${providerId}`, value);
}
