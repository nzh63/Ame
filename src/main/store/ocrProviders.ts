import logger from '@logger/store/ocrProviders';
import type { AvailableOcrConfigs } from '@main/providers/ocr';
import { availableOcrConfigs } from '@main/providers/ocr';
import type { JSONSchema } from '@main/schema';
import { toJSONSchema } from '@main/schema';
import type { ProvidersStore } from '@main/store/utils';

export type OcrProvidersStore = ProvidersStore<AvailableOcrConfigs>;
export const ocrProvidersStoreJSONSchema = {
  type: 'object' as const,
  required: availableOcrConfigs.map((i) => i.id),
  properties: {} as { [name: string]: JSONSchema },
  default: {} as { [i: string]: AvailableOcrConfigs[number]['defaultOptions'] },
};
for (const config of availableOcrConfigs) {
  ocrProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
  ocrProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of ocr providers:%O', ocrProvidersStoreJSONSchema);
