import { ocrExtractorOptionsSchema, ocrExtractorOptionsDefaultValue, OcrExtractorOptions } from '@main/extractor/OcrExtractor/options';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/store/ttsManager';

export type OcrExtractorStore = OcrExtractorOptions;
export const ocrExtractorStoreJSONSchema = toJSONSchema(ocrExtractorOptionsSchema, ocrExtractorOptionsDefaultValue);
logger('auto generate JSONSchema for options of tts manager:%O', ocrExtractorStoreJSONSchema);
