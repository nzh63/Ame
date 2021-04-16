import type { ProvidersStore } from '@main/store/utils';
import { JSONSchema, toJSONSchema } from '@main/schema';
import { AvailableOCRConfigs, availableOCRConfigs } from '@main/providers/ocr';
import logger from '@logger/store/ocrProviders';

export type OCRProvidersStore = ProvidersStore<AvailableOCRConfigs>;
export const ocrProvidersStoreJSONSchema = {
    type: 'object' as const,
    required: availableOCRConfigs.map(i => i.id),
    properties: {} as { [name: string]: JSONSchema, },
    default: {} as { [i: string]: AvailableOCRConfigs[number]['defaultOptions'], }
};
for (const config of availableOCRConfigs) {
    ocrProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
    ocrProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of ocr providers:%O', ocrProvidersStoreJSONSchema);
