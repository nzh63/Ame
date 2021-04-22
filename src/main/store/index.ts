import Store from 'electron-store';
import { gamesStoreJSONSchema } from './games';
import { localeChangersStore, localeChangersStoreJSONSchema } from './localeChangers';
import { TranslateProvidersStore, translateProvidersStoreJSONSchema } from './translateProviders';
import { TtsProvidersStore, ttsProvidersStoreJSONSchema } from './ttsProviders';
import { OcrProvidersStore, ocrProvidersStoreJSONSchema } from './ocrProviders';
import { TtsManagerStore, ttsManagerStoreJSONSchema } from './ttsManager';
import { OcrExtractorStore, ocrExtractorStoreJSONSchema } from './ocrExtractor';

const store = new Store<{
    games: Ame.GameSetting[];
    localeChangers: localeChangersStore;
    translateProviders: TranslateProvidersStore;
    ttsProviders: TtsProvidersStore;
    ocrProviders: OcrProvidersStore;
    ttsManager: TtsManagerStore;
    ocrExtractor: OcrExtractorStore;
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
