import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { translateProvidersStoreJSONSchema } from '@main/store/translateProviders';
import { ttsManagerStoreJSONSchema } from '@main/store/ttsManager';
import { availableTranslateConfigs, AvailableTranslateConfigs } from '@main/providers/translate';
import { ttsManagerOptionsDescription } from '@main/manager/TTSManagerOptions';
import { handleError } from '@main/remote/handle';
import { availableTTSConfigs, AvailableTTSConfigs } from '@main/providers/tts';
import { TTSManager } from '@main/manager';

ipcMain.handle('get-translate-providers-ids', handleError((event: IpcMainInvokeEvent) => {
    return availableTranslateConfigs.map(i => i.id);
}));

ipcMain.handle('get-translate-provider-options-meta', handleError((event: IpcMainInvokeEvent, providerId: AvailableTranslateConfigs[number]['id']) => {
    return {
        id: providerId,
        description: availableTranslateConfigs.find(i => i.id === providerId)?.description,
        jsonSchema: translateProvidersStoreJSONSchema.properties[providerId],
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
        jsonSchema: TTSManager.getInstance().providers.find(i => i.id === providerId)?.optionsJSONSchema,
        optionsDescription: availableTTSConfigs.find(i => i.id === providerId)?.optionsDescription
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
