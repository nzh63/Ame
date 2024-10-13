import logger from '@logger/store/ttsManager';
import type { OcrExtractorOptions } from '@main/extractor/OcrExtractor/options';
import { ocrExtractorOptionsSchema, ocrExtractorOptionsDefaultValue } from '@main/extractor/OcrExtractor/options';
import { toJSONSchema } from '@main/schema';

export type OcrExtractorStore = OcrExtractorOptions;
export const ocrExtractorStoreJSONSchema = toJSONSchema(ocrExtractorOptionsSchema, ocrExtractorOptionsDefaultValue);
logger('auto generate JSONSchema for options of tts manager:%O', ocrExtractorStoreJSONSchema);
