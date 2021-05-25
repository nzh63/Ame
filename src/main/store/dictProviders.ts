import type { ProvidersStore } from '@main/store/utils';
import { JSONSchema, toJSONSchema } from '@main/schema';
import { AvailableDictConfigs, availableDictConfigs } from '@main/providers/dict';
import logger from '@logger/store/dictProviders';

export type DictProvidersStore = ProvidersStore<AvailableDictConfigs>;
export const dictProvidersStoreJSONSchema = {
    type: 'object' as const,
    required: availableDictConfigs.map(i => i.id),
    properties: {} as { [name: string]: JSONSchema, },
    default: {} as { [i: string]: AvailableDictConfigs[number]['defaultOptions'], }
};
for (const config of availableDictConfigs) {
    dictProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
    dictProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of dict providers:%O', dictProvidersStoreJSONSchema);
