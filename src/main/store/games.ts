import type { JSONSchema } from '@main/schema';

export const gamesStoreJSONSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            hookCode: { type: 'string' },
            execShell: { type: 'string' }
        }
    },
    default: []
} as JSONSchema;
