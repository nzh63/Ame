import type { ProvidersStore } from '@main/store/utils';
import { JSONSchema, toJSONSchema } from '@main/schema';
import { AvailableTranslateConfigs, availableTranslateConfigs } from '@main/providers/translate';
import logger from '@logger/store/translateProviders';

export type TranslateProvidersStore = ProvidersStore<AvailableTranslateConfigs>;
export const translateProvidersStoreJSONSchema = {
    type: 'object' as const,
    required: availableTranslateConfigs.map(i => i.id),
    properties: {} as { [name: string]: JSONSchema, },
    default: {} as { [i: string]: AvailableTranslateConfigs[number]['defaultOptions'], }
};
for (const config of availableTranslateConfigs) {
    translateProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
    translateProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of translate providers:%O', translateProvidersStoreJSONSchema);
