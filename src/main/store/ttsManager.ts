import logger from '@logger/store/ttsManager';
import type { TtsManagerOptions } from '@main/manager/TtsManager/options';
import { ttsManagerOptionsSchema, ttsManagerOptionsDefaultValue } from '@main/manager/TtsManager/options';
import { toJSONSchema } from '@main/schema';

export type TtsManagerStore = TtsManagerOptions;
export const ttsManagerStoreJSONSchema = toJSONSchema(ttsManagerOptionsSchema, ttsManagerOptionsDefaultValue);
logger('auto generate JSONSchema for options of tts manager:%O', ttsManagerStoreJSONSchema);
