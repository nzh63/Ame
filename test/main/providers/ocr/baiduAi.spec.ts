import { buildTest } from '.';
import '../../env';
import baiduAi from '@main/providers/ocr/baiduAi';

buildTest(
  baiduAi,
  {
    enable: true,
    apiConfig: {
      apiKey: process.env.TEST_PROVIDERS_OCR_BAIDUAI_API_KEY ?? null,
      secretKey: process.env.TEST_PROVIDERS_OCR_BAIDUAI_SECRET_KEY ?? null,
      language: 'JAP',
    },
  },
  !process.env.TEST_PROVIDERS_OCR_BAIDUAI_API_KEY && !process.env.TEST_PROVIDERS_OCR_BAIDUAI_SECRET_KEY,
);
