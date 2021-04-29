import '../../env';
import tencentcloud from '@main/providers/ocr/tencentcloud';
import { buildTest } from '.';

buildTest(tencentcloud, {
    enable: true,
    apiConfig: {
        credential: {
            secretId: process.env.TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_ID ?? null,
            secretKey: process.env.TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_KEY ?? null
        },
        region: 'ap-guangzhou',
        params: {
            LanguageType: 'jap'
        }
    }
}, !process.env.TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_ID && !process.env.TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_KEY);
