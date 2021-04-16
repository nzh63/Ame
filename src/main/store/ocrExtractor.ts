import { ocrExtractorOptionsSchema, ocrExtractorOptionsDefaultValue, OCRExtractorOptions } from '@main/extractor/OCRExtractor/options';
import { toJSONSchema } from '@main/schema';
import logger from '@logger/store/ttsManager';

export type OCRExtractorStore = OCRExtractorOptions;
export const ocrExtractorStoreJSONSchema = toJSONSchema(ocrExtractorOptionsSchema, ocrExtractorOptionsDefaultValue);
logger('auto generate JSONSchema for options of tts manager:%O', ocrExtractorStoreJSONSchema);
