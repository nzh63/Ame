import { defineOcrProvider } from '@main/providers/ocr';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/ocr/v20181119/ocr_client';

export default defineOcrProvider({
  id: '腾讯云',
  description:
    '腾讯云通用印刷体识别API，详见 https://cloud.tencent.com/product/generalocr \n会向 ocr.tencentcloudapi.com 发送数据',
  optionsSchema: {
    enable: Boolean,
    apiConfig: {
      credential: {
        secretId: [String, null],
        secretKey: [String, null],
      },
      region: String,
      params: {
        LanguageType: [
          'auto',
          'zh',
          'jap',
          'kor',
          ' spa',
          'fre',
          'ger',
          'por',
          ' vie',
          'may',
          'rus',
          'ita',
          ' hol',
          'swe',
          'fin',
          'dan',
          ' nor',
          'hun',
          'tha',
          'lat',
          'ara',
        ],
      },
    },
  } as const,
  defaultOptions: {
    enable: true,
    apiConfig: {
      credential: {
        secretId: null,
        secretKey: null,
      },
      region: 'ap-guangzhou',
      params: {
        LanguageType: 'jap',
      },
    },
  },
  optionsDescription: {
    enable: '启用',
    apiConfig: {
      credential: {
        secretId: { readableName: '密钥ID', description: '可以在 https://console.cloud.tencent.com/cam/capi 获取' },
        secretKey: { readableName: '密钥KEY', description: '可以在 https://console.cloud.tencent.com/cam/capi 获取' },
      },
      region: '地域',
      params: {
        LanguageType: '语言',
      },
    },
  },
  data() {
    return {
      client: null as null | Client,
    };
  },
  init() {
    if (!this.apiConfig.credential.secretId || !this.apiConfig.credential.secretKey) return;
    const clientConfig = {
      credential: {
        secretId: this.apiConfig.credential.secretId,
        secretKey: this.apiConfig.credential.secretKey,
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'ocr.tencentcloudapi.com',
        },
      },
    };
    this.client = new Client(clientConfig);
  },
  isReady() {
    return (
      this.enable &&
      this.apiConfig.credential.secretId !== null &&
      this.apiConfig.credential.secretKey !== null &&
      !!this.client
    );
  },
  async recognize(img) {
    if (!this.client) throw new Error('client have not been init');
    const params = {
      ...this.apiConfig.params,
      ImageBase64: Buffer.from(await img.clone().png().toBuffer()).toString('base64'),
    };
    const res = await this.client.GeneralBasicOCR(params);
    if (res.TextDetections) {
      return res.TextDetections.map((i) => i.DetectedText).join('');
    }
    throw res;
  },
});
