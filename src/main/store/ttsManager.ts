import { ttsManagerOptionsSchema, ttsManagerOptionsDefaultValue, TtsManagerOptions } from '@main/manager/TtsManager/options';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/store/ttsManager';

export type TtsManagerStore = TtsManagerOptions;
export const ttsManagerStoreJSONSchema = toJSONSchema(ttsManagerOptionsSchema, ttsManagerOptionsDefaultValue);
logger('auto generate JSONSchema for options of tts manager:%O', ttsManagerStoreJSONSchema);
