import '../../env';
import tencentcloud from '@main/providers/translate/tencentcloud';
import { buildTest } from '.';

buildTest(tencentcloud, {
    enable: true,
    apiConfig: {
        credential: {
            secretId: process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_ID ?? null,
            secretKey: process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_KEY ?? null
        },
        region: 'ap-guangzhou',
        params: {
            Source: 'ja',
            Target: 'zh',
            ProjectId: 0
        }
    }
}, !process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_ID && !process.env.TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_KEY);
