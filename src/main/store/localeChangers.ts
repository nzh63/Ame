import { SchemaType, toJSONSchema } from '@main/schema';
import logger from '@logger/store/localeChanger';

export const localeChangersStoreSchema = {
    type: Array,
    items: {
        name: String,
        execShell: String,
        enable: Boolean
    }
};

export type localeChangersStore = SchemaType<typeof localeChangersStoreSchema>;

export const localeChangersStoreJSONSchema = toJSONSchema(localeChangersStoreSchema, []);
logger('auto generate JSONSchema for options of locale changers:%O', localeChangersStoreJSONSchema);
