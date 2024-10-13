import logger from '@logger/store/segmentManager';
import type { SegmentManagerOptions } from '@main/manager/SegmentManager/options';
import { segmentManagerOptionsSchema, segmentManagerOptionsDefaultValue } from '@main/manager/SegmentManager/options';
import { toJSONSchema } from '@main/schema';

export type SegmentManagerStore = SegmentManagerOptions;
export const segmentManagerStoreJSONSchema = toJSONSchema(
  segmentManagerOptionsSchema,
  segmentManagerOptionsDefaultValue,
);
logger('auto generate JSONSchema for options of segment manager:%O', segmentManagerStoreJSONSchema);
