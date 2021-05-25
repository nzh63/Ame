import type { ProvidersStore } from '@main/store/utils';
import { JSONSchema, toJSONSchema } from '@main/schema';
import { AvailableSegmentConfigs, availableSegmentConfigs } from '@main/providers/segment';
import logger from '@logger/store/segmentProviders';

export type SegmentProvidersStore = ProvidersStore<AvailableSegmentConfigs>;
export const segmentProvidersStoreJSONSchema = {
    type: 'object' as const,
    required: availableSegmentConfigs.map(i => i.id),
    properties: {} as { [name: string]: JSONSchema, },
    default: {} as { [i: string]: AvailableSegmentConfigs[number]['defaultOptions'], }
};
for (const config of availableSegmentConfigs) {
    segmentProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
    segmentProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of segment providers:%O', segmentProvidersStoreJSONSchema);
