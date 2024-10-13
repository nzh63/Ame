import type { DictManagerStore } from './dictManager';
import { dictManagerStoreJSONSchema } from './dictManager';
import type { DictProvidersStore } from './dictProviders';
import { dictProvidersStoreJSONSchema } from './dictProviders';
import { gamesStoreJSONSchema } from './games';
import type { localeChangersStore } from './localeChangers';
import { localeChangersStoreJSONSchema } from './localeChangers';
import type { OcrExtractorStore } from './ocrExtractor';
import { ocrExtractorStoreJSONSchema } from './ocrExtractor';
import type { OcrProvidersStore } from './ocrProviders';
import { ocrProvidersStoreJSONSchema } from './ocrProviders';
import type { SegmentManagerStore } from './segmentManager';
import { segmentManagerStoreJSONSchema } from './segmentManager';
import type { SegmentProvidersStore } from './segmentProviders';
import { segmentProvidersStoreJSONSchema } from './segmentProviders';
import type { TranslateProvidersStore } from './translateProviders';
import { translateProvidersStoreJSONSchema } from './translateProviders';
import type { TtsManagerStore } from './ttsManager';
import { ttsManagerStoreJSONSchema } from './ttsManager';
import type { TtsProvidersStore } from './ttsProviders';
import { ttsProvidersStoreJSONSchema } from './ttsProviders';
import type { uiStore } from './ui';
import { uiStoreJSONSchema } from './ui';
import Store from 'electron-store';

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
  ui: uiStore;
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
    ui: uiStoreJSONSchema,
  },
  clearInvalidConfig: true,
});
export default store;
export type StoreType = typeof store;
