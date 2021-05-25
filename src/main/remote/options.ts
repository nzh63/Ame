import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ttsManagerStoreJSONSchema } from '@main/store/ttsManager';
import { handleError } from '@main/remote/handle';
import { toJSONSchema } from '@main/schema';
import { availableTranslateConfigs, AvailableTranslateConfigs } from '@main/providers/translate';
import { availableTtsConfigs, AvailableTtsConfigs } from '@main/providers/tts';
import { AvailableOcrConfigs, availableOcrConfigs } from '@main/providers/ocr';
import { AvailableSegmentConfigs, availableSegmentConfigs } from '@main/providers/segment';
import { ttsManagerOptionsDescription } from '@main/manager/TtsManager/options';
import { ocrExtractorStoreJSONSchema } from '@main/store/ocrExtractor';
import { ocrExtractorOptionsDescription } from '@main/extractor/OcrExtractor/options';
import { segmentManagerStoreJSONSchema } from '@main/store/segmentManager';
import { segmentManagerOptionsDescription } from '@main/manager/SegmentManager/options';

ipcMain.handle('get-translate-providers-ids', handleError((event: IpcMainInvokeEvent) => {
    return availableTranslateConfigs.map(i => i.id);
}));
ipcMain.handle('get-translate-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableTranslateConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableTranslateConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: toJSONSchema(availableTranslateConfigs.find(i => i.id === providerId)?.optionsSchema ?? {}),
        optionsDescription: availableTranslateConfigs.find(i => i.id === providerId)?.optionsDescription
    };
}));

ipcMain.handle('get-tts-providers-ids', handleError((event: IpcMainInvokeEvent) => {
    return availableTtsConfigs.map(i => i.id);
}));
ipcMain.handle('get-tts-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableTtsConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableTtsConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: toJSONSchema(availableTtsConfigs.find(i => i.id === providerId)?.optionsSchema ?? {}),
        optionsDescription: availableTtsConfigs.find(i => i.id === providerId)?.optionsDescription
    };
}));

ipcMain.handle('get-ocr-providers-ids', handleError((event: IpcMainInvokeEvent) => {
    return availableOcrConfigs.map(i => i.id);
}));
ipcMain.handle('get-ocr-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableOcrConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableOcrConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: toJSONSchema(availableOcrConfigs.find(i => i.id === providerId)?.optionsSchema ?? {}),
        optionsDescription: availableOcrConfigs.find(i => i.id === providerId)?.optionsDescription
    };
}));

ipcMain.handle('get-tts-manager-options-meta', handleError((event: IpcMainInvokeEvent) => {
    return {
        id: null,
        description: null,
        jsonSchema: ttsManagerStoreJSONSchema,
        optionsDescription: ttsManagerOptionsDescription
    };
}));

ipcMain.handle('get-ocr-extractor-options-meta', handleError((event: IpcMainInvokeEvent) => {
    return {
        id: null,
        description: null,
        jsonSchema: ocrExtractorStoreJSONSchema,
        optionsDescription: ocrExtractorOptionsDescription
    };
}));

ipcMain.handle('get-segment-manager-options-meta', handleError((event: IpcMainInvokeEvent) => {
    return {
        id: null,
        description: null,
        jsonSchema: segmentManagerStoreJSONSchema,
        optionsDescription: segmentManagerOptionsDescription
    };
}));

ipcMain.handle('get-segment-providers-ids', handleError((event: IpcMainInvokeEvent) => {
    return availableSegmentConfigs.map(i => i.id);
}));
ipcMain.handle('get-segment-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableSegmentConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableSegmentConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: toJSONSchema(availableSegmentConfigs.find(i => i.id === providerId)?.optionsSchema ?? {}),
        optionsDescription: availableSegmentConfigs.find(i => i.id === providerId)?.optionsDescription
    };
}));
