import logger from '@logger/store/localeChanger';
import type { SchemaType } from '@main/schema';
import { toJSONSchema } from '@main/schema';

export const localeChangersStoreSchema = {
  type: Array,
  items: {
    name: String,
    execShell: String,
    enable: Boolean,
  },
};

export type localeChangersStore = SchemaType<typeof localeChangersStoreSchema>;

export const localeChangersStoreJSONSchema = toJSONSchema(localeChangersStoreSchema, []);
logger('auto generate JSONSchema for options of locale changers:%O', localeChangersStoreJSONSchema);
