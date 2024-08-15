import type { SchemaType, SchemaDescription } from '@main/schema';
import { availableDictConfigs } from '@main/providers/dict';

export const dictManagerOptionsSchema = {
    defaultProvider: {
        type: String,
        enum: [...availableDictConfigs.map(i => i.id)]
    }
};

export type DictManagerOptions = SchemaType<typeof dictManagerOptionsSchema>;

export const dictManagerOptionsDescription: SchemaDescription<typeof dictManagerOptionsSchema> = {
    defaultProvider: '默认提供程序'
};

export const dictManagerOptionsDefaultValue: DictManagerOptions = {
    defaultProvider: availableDictConfigs[0].id
};
