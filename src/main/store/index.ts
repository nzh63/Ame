import Store from 'electron-store';
import { gamesStoreJSONSchema } from './games';
import { localeChangersStore, localeChangersStoreJSONSchema } from './localeChangers';
import { TranslateProvidersStore, translateProvidersStoreJSONSchema } from './translateProviders';
import { TTSProvidersStore, ttsProvidersStoreJSONSchema } from './ttsProviders';
import { OCRProvidersStore, ocrProvidersStoreJSONSchema } from './ocrProviders';
import { TTSManagerStore, ttsManagerStoreJSONSchema } from './ttsManager';
import { OCRExtractorStore, ocrExtractorStoreJSONSchema } from './ocrExtractor';

const store = new Store<{
    games: Ame.GameSetting[];
    localeChangers: localeChangersStore;
    translateProviders: TranslateProvidersStore;
    ttsProviders: TTSProvidersStore;
    ocrProviders: OCRProvidersStore;
    ttsManager: TTSManagerStore;
    ocrExtractor: OCRExtractorStore;
}>({
    schema: {
        games: gamesStoreJSONSchema,
        localeChangers: localeChangersStoreJSONSchema,
        translateProviders: translateProvidersStoreJSONSchema,
        ttsProviders: ttsProvidersStoreJSONSchema,
        ocrProviders: ocrProvidersStoreJSONSchema,
        ttsManager: ttsManagerStoreJSONSchema,
        ocrExtractor: ocrExtractorStoreJSONSchema
    },
    clearInvalidConfig: true
});
export default store;
export type StoreType = typeof store;
