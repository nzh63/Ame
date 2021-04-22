import type { ProvidersStore } from '@main/store/utils';
import { JSONSchema, toJSONSchema } from '@main/schema';
import { AvailableOcrConfigs, availableOcrConfigs } from '@main/providers/ocr';
import logger from '@logger/store/ocrProviders';

export type OcrProvidersStore = ProvidersStore<AvailableOcrConfigs>;
export const ocrProvidersStoreJSONSchema = {
    type: 'object' as const,
    required: availableOcrConfigs.map(i => i.id),
    properties: {} as { [name: string]: JSONSchema, },
    default: {} as { [i: string]: AvailableOcrConfigs[number]['defaultOptions'], }
};
for (const config of availableOcrConfigs) {
    ocrProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
    ocrProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of ocr providers:%O', ocrProvidersStoreJSONSchema);
