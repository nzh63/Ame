import logger from '@logger/store/segmentProviders';
import type { AvailableSegmentConfigs } from '@main/providers/segment';
import { availableSegmentConfigs } from '@main/providers/segment';
import type { JSONSchema } from '@main/schema';
import { toJSONSchema } from '@main/schema';
import type { ProvidersStore } from '@main/store/utils';

export type SegmentProvidersStore = ProvidersStore<AvailableSegmentConfigs>;
export const segmentProvidersStoreJSONSchema = {
  type: 'object' as const,
  required: availableSegmentConfigs.map((i) => i.id),
  properties: {} as { [name: string]: JSONSchema },
  default: {} as { [i: string]: AvailableSegmentConfigs[number]['defaultOptions'] },
};
for (const config of availableSegmentConfigs) {
  segmentProvidersStoreJSONSchema.properties[config.id] = toJSONSchema(config.optionsSchema, config.defaultOptions);
  segmentProvidersStoreJSONSchema.default[config.id] = config.defaultOptions;
}
logger('auto generate JSONSchema for options of segment providers:%O', segmentProvidersStoreJSONSchema);
