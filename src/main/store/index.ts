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
import { DictProvidersStore, dictProvidersStoreJSONSchema } from './dictProviders';
import { DictManagerStore, dictManagerStoreJSONSchema } from './dictManager';
import { generalStore, generalStoreJSONSchema } from './general';

const store = new Store<{
    games: Ame.GameSetting[];
    localeChangers: localeChangersStore;
    translateProviders: TranslateProvidersStore;
    ttsProviders: TtsProvidersStore;
    ocrProviders: OcrProvidersStore;
    segmentProviders: SegmentProvidersStore;
    dictProviders: DictProvidersStore;
    ttsManager: TtsManagerStore;
    segmentManager: SegmentManagerStore;
    dictManager: DictManagerStore;
    ocrExtractor: OcrExtractorStore;
    general: generalStore;
}>({
    schema: {
        games: gamesStoreJSONSchema,
        localeChangers: localeChangersStoreJSONSchema,
        translateProviders: translateProvidersStoreJSONSchema,
        ttsProviders: ttsProvidersStoreJSONSchema,
        ocrProviders: ocrProvidersStoreJSONSchema,
        segmentProviders: segmentProvidersStoreJSONSchema,
        dictProviders: dictProvidersStoreJSONSchema,
        ttsManager: ttsManagerStoreJSONSchema,
        segmentManager: segmentManagerStoreJSONSchema,
        dictManager: dictManagerStoreJSONSchema,
        ocrExtractor: ocrExtractorStoreJSONSchema,
        general: generalStoreJSONSchema
    },
    clearInvalidConfig: true
});
export default store;
export type StoreType = typeof store;
