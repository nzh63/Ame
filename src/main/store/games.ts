import type { JSONSchema } from '@main/schema';

export const gamesStoreJSONSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            execShell: { type: 'string' },
            type: { type: 'string', enum: ['textractor', 'ocr'], default: 'textractor' },
            hookCode: { type: 'string' }
        }
    },
    default: []
} as JSONSchema;
