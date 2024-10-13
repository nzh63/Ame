import logger from '@logger/store/dictProviders';
import type { AvailableDictConfigs } from '@main/providers/dict';
import { availableDictConfigs } from '@main/providers/dict';
import type { JSONSchema } from '@main/schema';
import { toJSONSchema } from '@main/schema';
import type { ProvidersStore } from '@main/store/utils';

export type DictProvidersStore = ProvidersStore<AvailableDictConfigs>;
export const dictProvidersStoreJSONSchema = {
  type: 'object' as const,
  required: availableDictConfigs.map((i) => i.id),
  properties: {} as { [name: string]: JSONSchema },
  default: {} as { [i: string]: AvailableDictConfigs[number]['defaultOptions'] },
};
for (const config of availableDictConfigs) {
  dictProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
  dictProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of dict providers:%O', dictProvidersStoreJSONSchema);
