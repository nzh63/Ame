import type { SchemaType, SchemaDescription } from '@main/schema';
import { availableTtsConfigs } from '@main/providers/tts';

export const ttsManagerOptionsSchema = {
    defaultProvider: {
        type: [null, String] as const,
        enum: [null, ...availableTtsConfigs.map(i => i.id)]
    }
};

export type TtsManagerOptions = SchemaType<typeof ttsManagerOptionsSchema>;

export const ttsManagerOptionsDescription: SchemaDescription<typeof ttsManagerOptionsSchema> = {
    defaultProvider: '默认提供程序'
};

export const ttsManagerOptionsDefaultValue: TtsManagerOptions = {
    defaultProvider: null
};
