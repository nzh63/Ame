import logger from '@logger/store/dictManager';
import type { DictManagerOptions } from '@main/manager/DictManager/options';
import { dictManagerOptionsSchema, dictManagerOptionsDefaultValue } from '@main/manager/DictManager/options';
import { toJSONSchema } from '@main/schema';

export type DictManagerStore = DictManagerOptions;
export const dictManagerStoreJSONSchema = toJSONSchema(dictManagerOptionsSchema, dictManagerOptionsDefaultValue);
logger('auto generate JSONSchema for options of dict manager:%O', dictManagerStoreJSONSchema);
