import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ttsManagerStoreJSONSchema } from '@main/store/ttsManager';
import { handleError } from '@main/remote/handle';
import { toJSONSchema } from '@main/schema';
import { availableTranslateConfigs, AvailableTranslateConfigs } from '@main/providers/translate';
import { availableTTSConfigs, AvailableTTSConfigs } from '@main/providers/tts';
import { AvailableOCRConfigs, availableOCRConfigs } from '@main/providers/ocr';
import { ttsManagerOptionsDescription } from '@main/manager/TTSManager/options';
import { ocrExtractorStoreJSONSchema } from '@main/store/ocrExtractor';
import { ocrExtractorOptionsDescription } from '@main/extractor/OCRExtractor/options';

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
    return availableTTSConfigs.map(i => i.id);
}));
ipcMain.handle('get-tts-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableTTSConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableTTSConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: toJSONSchema(availableTTSConfigs.find(i => i.id === providerId)?.optionsSchema ?? {}),
        optionsDescription: availableTTSConfigs.find(i => i.id === providerId)?.optionsDescription
    };
}));

ipcMain.handle('get-ocr-providers-ids', handleError((event: IpcMainInvokeEvent) => {
    return availableOCRConfigs.map(i => i.id);
}));
ipcMain.handle('get-ocr-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableOCRConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableOCRConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: toJSONSchema(availableOCRConfigs.find(i => i.id === providerId)?.optionsSchema ?? {}),
        optionsDescription: availableOCRConfigs.find(i => i.id === providerId)?.optionsDescription
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
