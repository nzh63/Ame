import type { JSONSchema } from '@main/schema';

export const generalStoreJSONSchema: JSONSchema = {
    type: 'object',
    required: ['fontSize'],
    properties: {
        fontSize: { type: 'number', default: 16 }
    }
};

export type generalStore = { fontSize: number };
