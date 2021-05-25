import { segmentManagerOptionsSchema, segmentManagerOptionsDefaultValue, SegmentManagerOptions } from '@main/manager/SegmentManager/options';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/store/segmentManager';

export type SegmentManagerStore = SegmentManagerOptions;
export const segmentManagerStoreJSONSchema = toJSONSchema(segmentManagerOptionsSchema, segmentManagerOptionsDefaultValue);
logger('auto generate JSONSchema for options of segment manager:%O', segmentManagerStoreJSONSchema);
