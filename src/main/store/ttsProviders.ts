import logger from '@logger/store/ttsProviders';
import type { AvailableTtsConfigs } from '@main/providers/tts';
import { availableTtsConfigs } from '@main/providers/tts';
import type { JSONSchema } from '@main/schema';
import { toJSONSchema } from '@main/schema';
import type { ProvidersStore } from '@main/store/utils';

export type TtsProvidersStore = ProvidersStore<AvailableTtsConfigs>;
export const ttsProvidersStoreJSONSchema = {
  type: 'object' as const,
  required: availableTtsConfigs.map((i) => i.id),
  properties: {} as { [name: string]: JSONSchema },
  default: {} as { [i: string]: AvailableTtsConfigs[number]['defaultOptions'] },
};
for (const config of availableTtsConfigs) {
  ttsProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
  ttsProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of tts providers:%O', ttsProvidersStoreJSONSchema);
