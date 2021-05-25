import type { SchemaType, SchemaDescription } from '@main/schema';
import { availableSegmentConfigs } from '@main/providers/segment';

export const segmentManagerOptionsSchema = {
    defaultProvider: {
        type: String,
        enum: [...availableSegmentConfigs.map(i => i.id)]
    }
};

export type SegmentManagerOptions = SchemaType<typeof segmentManagerOptionsSchema>;

export const segmentManagerOptionsDescription: SchemaDescription<typeof segmentManagerOptionsSchema> = {
    defaultProvider: '默认提供程序'
};

export const segmentManagerOptionsDefaultValue: SegmentManagerOptions = {
    defaultProvider: availableSegmentConfigs[0].id
};
