import type { JSONSchema } from '@main/schema';

export const uiStoreJSONSchema: JSONSchema = {
  type: 'object',
  required: ['fontSize'],
  properties: {
    fontSize: { type: 'number', default: 16 },
  },
};

export interface uiStore {
  fontSize: number;
}
