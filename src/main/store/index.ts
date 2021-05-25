import Store from 'electron-store';
import { gamesStoreJSONSchema } from './games';
import { localeChangersStore, localeChangersStoreJSONSchema } from './localeChangers';
import { TranslateProvidersStore, translateProvidersStoreJSONSchema } from './translateProviders';
import { TtsProvidersStore, ttsProvidersStoreJSONSchema } from './ttsProviders';
import { OcrProvidersStore, ocrProvidersStoreJSONSchema } from './ocrProviders';
import { SegmentProvidersStore, segmentProvidersStoreJSONSchema } from './segmentProviders';
import { TtsManagerStore, ttsManagerStoreJSONSchema } from './ttsManager';
import { SegmentManagerStore, segmentManagerStoreJSONSchema } from './segmentManager';
import { OcrExtractorStore, ocrExtractorStoreJSONSchema } from './ocrExtractor';

const store = new Store<{
    games: Ame.GameSetting[];
    localeChangers: localeChangersStore;
    translateProviders: TranslateProvidersStore;
    ttsProviders: TtsProvidersStore;
    ocrProviders: OcrProvidersStore;
    segmentProviders: SegmentProvidersStore;
    ttsManager: TtsManagerStore;
    segmentManager: SegmentManagerStore;
    ocrExtractor: OcrExtractorStore;
}>({
    schema: {
        games: gamesStoreJSONSchema,
        localeChangers: localeChangersStoreJSONSchema,
        translateProviders: translateProvidersStoreJSONSchema,
        ttsProviders: ttsProvidersStoreJSONSchema,
        ocrProviders: ocrProvidersStoreJSONSchema,
        segmentProviders: segmentProvidersStoreJSONSchema,
        ttsManager: ttsManagerStoreJSONSchema,
        segmentManager: segmentManagerStoreJSONSchema,
        ocrExtractor: ocrExtractorStoreJSONSchema
    },
    clearInvalidConfig: true
});
export default store;
export type StoreType = typeof store;
