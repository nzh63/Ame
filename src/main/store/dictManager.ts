import { dictManagerOptionsSchema, dictManagerOptionsDefaultValue, DictManagerOptions } from '@main/manager/DictManager/options';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/store/dictManager';

export type DictManagerStore = DictManagerOptions;
export const dictManagerStoreJSONSchema = toJSONSchema(dictManagerOptionsSchema, dictManagerOptionsDefaultValue);
logger('auto generate JSONSchema for options of dict manager:%O', dictManagerStoreJSONSchema);
