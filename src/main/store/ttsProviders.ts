import type { ProvidersStore } from '@main/store/utils';
import { JSONSchema, toJSONSchema } from '@main/schema';
import { AvailableTTSConfigs, availableTTSConfigs } from '@main/providers/tts';
import logger from '@logger/store/ttsProviders';

export type TTSProvidersStore = ProvidersStore<AvailableTTSConfigs>;
export const ttsProvidersStoreJSONSchema = {
    type: 'object' as const,
    required: availableTTSConfigs.map(i => i.id),
    properties: {} as { [name: string]: JSONSchema, },
    default: {} as { [i: string]: AvailableTTSConfigs[number]['defaultOptions'], }
};
for (const config of availableTTSConfigs) {
    ttsProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
    ttsProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of tts providers:%O', ttsProvidersStoreJSONSchema);
