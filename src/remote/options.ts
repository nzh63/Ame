/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable prefer-arrow-callback */
import { defineRemoteFunction } from '@remote/common';

async function providers() {
  const { availableTranslateConfigs } = await import('@main/providers/translate');
  const { availableTtsConfigs } = await import('@main/providers/tts');
  const { availableOcrConfigs } = await import('@main/providers/ocr');
  const { availableSegmentConfigs } = await import('@main/providers/segment');
  const { availableDictConfigs } = await import('@main/providers/dict');
  return {
    translate: availableTranslateConfigs,
    tts: availableTtsConfigs,
    ocr: availableOcrConfigs,
    segment: availableSegmentConfigs,
    dict: availableDictConfigs,
  } as const;
}
type ProvidersType = keyof Awaited<ReturnType<typeof providers>>;

export const getProvidersIDs = defineRemoteFunction('get-providers-ids', async (event, type: ProvidersType) => {
  return (await providers())[type].map((i) => i.id);
});

export const getProviderOptionsMeta = defineRemoteFunction('get-provider-options-meta', async function <
  T extends ProvidersType,
>(event: Electron.IpcMainInvokeEvent, type: T, providerId: Awaited<ReturnType<typeof providers>>[T][number]['id']) {
  const { toJSONSchema } = await import('@main/schema');
  const p = await providers();
  return {
    id: providerId,
    description: p[type].find((i) => i.id === providerId)?.description,
    jsonSchema: toJSONSchema(p[type].find((i) => i.id === providerId)?.optionsSchema ?? {}),
    optionsDescription: p[type].find((i) => i.id === providerId)?.optionsDescription,
  };
});

export const getProviderOptions = defineRemoteFunction(
  'get-provider-options',
  async (event, type: ProvidersType, providerId: string) => {
    const { default: store } = await import('@main/store');
    return store.get(`${type}Providers.${providerId}`);
  },
);

export const setProviderOptions = defineRemoteFunction(
  'set-provider-options',
  async (event, type: ProvidersType, providerId: string, value: unknown) => {
    const { default: store } = await import('@main/store');
    return store.set(`${type}Providers.${providerId}`, value);
  },
);

async function managers() {
  const { ttsManagerStoreJSONSchema } = await import('@main/store/ttsManager');
  const { segmentManagerStoreJSONSchema } = await import('@main/store/segmentManager');
  const { dictManagerStoreJSONSchema } = await import('@main/store/dictManager');
  const { ttsManagerOptionsDescription } = await import('@main/manager/TtsManager/options');
  const { segmentManagerOptionsDescription } = await import('@main/manager/SegmentManager/options');
  const { dictManagerOptionsDescription } = await import('@main/manager/DictManager/options');
  return {
    tts: { jsonSchema: ttsManagerStoreJSONSchema, optionsDescription: ttsManagerOptionsDescription },
    segment: { jsonSchema: segmentManagerStoreJSONSchema, optionsDescription: segmentManagerOptionsDescription },
    dict: { jsonSchema: dictManagerStoreJSONSchema, optionsDescription: dictManagerOptionsDescription },
  } as const;
}
type ManagersType = keyof Awaited<ReturnType<typeof managers>>;

export const getManagerOptionsMeta = defineRemoteFunction(
  'get-manager-options-meta',
  async (event, type: ManagersType) => {
    return {
      id: null,
      description: null,
      ...(await managers())[type],
    };
  },
);

export const getManagerOptions = defineRemoteFunction(
  'get-manager-options',
  async (event, type: ManagersType, _: unknown) => {
    const { default: store } = await import('@main/store');
    return store.get(`${type}Manager`);
  },
);

export const setManagerOptions = defineRemoteFunction(
  'set-manager-options',
  async (event, type: ManagersType, _: unknown, value: unknown) => {
    const { default: store } = await import('@main/store');
    return store.set(`${type}Manager`, value);
  },
);

async function extractors() {
  const { ocrExtractorStoreJSONSchema } = await import('@main/store/ocrExtractor');
  const { ocrExtractorOptionsDescription } = await import('@main/extractor/OcrExtractor/options');
  return {
    ocr: { jsonSchema: ocrExtractorStoreJSONSchema, optionsDescription: ocrExtractorOptionsDescription },
  } as const;
}
type ExtractorsType = keyof Awaited<ReturnType<typeof extractors>>;

export const getExtractorOptionsMeta = defineRemoteFunction(
  'get-extractor-options-meta',
  async (event, type: ExtractorsType, _: unknown) => {
    return {
      id: null,
      description: null,
      ...(await extractors())[type],
    };
  },
);

export const getExtractorOptions = defineRemoteFunction(
  'get-extractor-options',
  async (event, type: ExtractorsType, _: unknown) => {
    const { default: store } = await import('@main/store');
    return store.get(`${type}Extractor`);
  },
);

export const setExtractorOptions = defineRemoteFunction(
  'set-extractor-options',
  async (event, type: ExtractorsType, _: unknown, value: unknown) => {
    const { default: store } = await import('@main/store');
    return store.set(`${type}Extractor`, value);
  },
);
