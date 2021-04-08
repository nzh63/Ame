import { ttsManagerOptionsSchema, ttsManagerOptionsDefaultValue, TTSManagerOptions } from '@main/manager/TTSManagerOptions';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/store/ttsManager';

export type TTSManagerStore = TTSManagerOptions;
export const ttsManagerStoreJSONSchema = toJSONSchema(ttsManagerOptionsSchema, ttsManagerOptionsDefaultValue);
logger('auto generate JSONSchema for options of tts manager:%O', ttsManagerStoreJSONSchema);
