import type { SchemaType, SchemaDescription } from '@main/schema';
import { availableTTSConfigs } from '@main/providers/tts';

export const ttsManagerOptionsSchema = {
    defaultProvider: {
        type: [null, String] as const,
        enum: [null, ...availableTTSConfigs.map(i => i.id)]
    }
};

export type TTSManagerOptions = SchemaType<typeof ttsManagerOptionsSchema>;

export const ttsManagerOptionsDescription: SchemaDescription<typeof ttsManagerOptionsSchema> = {
    defaultProvider: '默认提供程序'
};

export const ttsManagerOptionsDefaultValue: TTSManagerOptions = {
    defaultProvider: null
};
