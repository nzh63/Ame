import type { JSONSchema } from '@main/schema';

export const gamesStoreJSONSchema: JSONSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['uuid', 'name', 'path', 'execShell'],
    properties: {
      uuid: { type: 'string' },
      name: { type: 'string' },
      path: { type: 'string' },
      execShell: { type: 'string' },
      type: { type: 'string', enum: ['textractor', 'ocr'], default: 'textractor' },
      hookCode: { type: 'string' },
      textractor: {
        type: 'object',
        properties: {
          postProcessOption: {
            type: 'object',
            properties: {
              removeDuplication: {
                type: 'boolean',
              },
            },
          },
        },
      },
      ocr: {
        type: 'object',
        properties: {
          rect: {
            type: 'object',
            properties: {
              left: { type: 'number' },
              top: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
          },
          preprocess: {
            type: 'object',
            properties: {
              color: { type: 'string' },
              threshold: { type: 'number' },
            },
          },
        },
      },
    },
  },
  default: [],
};
