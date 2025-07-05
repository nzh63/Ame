import { Detecter, Recognizer, GPU } from '@addons/PP-OCR';
import { __static } from '@main/paths';
import { defineOcrProvider } from '@main/providers/ocr';
import { TaskQueue } from '@main/utils';
import path from 'path';
import sharp from 'sharp';

export default defineOcrProvider({
  id: 'PP-OCR',
  description: '使用 PP-OCRv5 进行本地光学字符识别',
  optionsSchema: {
    enable: Boolean,
    model: ['mobile.fp16', 'server.fp32'],
    device: ['CPU', 'GPU (自动)', ...GPU.devices],
  } as const,
  defaultOptions: {
    enable: true,
    model: 'server.fp32',
    device: 'CPU',
  },
  optionsDescription: {
    enable: '启用',
    model: '模型',
    device: '设备',
  },
  data() {
    return {
      taskQueue: new TaskQueue(),
      detecter: null as Detecter | null,
      recognizer: null as Recognizer | null,
    };
  },
  async init() {
    if (!this.enable) return;
    let detparam;
    let detmodel;
    let recparam;
    let recmodel;
    switch (this.model) {
      case 'mobile.fp16':
        detparam = path.join(__static, 'ppocr/PP-OCRv5_mobile_det.fp16.ncnn.param');
        detmodel = path.join(__static, 'ppocr/PP-OCRv5_mobile_det.fp16.ncnn.bin');
        recparam = path.join(__static, 'ppocr/PP-OCRv5_mobile_rec.fp16.ncnn.param');
        recmodel = path.join(__static, 'ppocr/PP-OCRv5_mobile_rec.fp16.ncnn.bin');
        break;
      case 'server.fp32':
        detparam = path.join(__static, 'ppocr/PP-OCRv5_server_det.fp32.ncnn.param');
        detmodel = path.join(__static, 'ppocr/PP-OCRv5_server_det.fp32.ncnn.bin');
        recparam = path.join(__static, 'ppocr/PP-OCRv5_server_rec.fp32.ncnn.param');
        recmodel = path.join(__static, 'ppocr/PP-OCRv5_server_rec.fp32.ncnn.bin');
        break;
    }
    let gpu;
    switch (this.device) {
      case 'CPU':
        gpu = 'off' as const;
        break;
      case 'GPU (自动)':
        gpu = 'auto' as const;
        break;
      default:
        gpu = this.$optionsSchema.device.indexOf(this.device);
        if (gpu === -1) {
          gpu = 'off' as const;
        } else {
          gpu -= 2;
        }
    }
    this.detecter = await Detecter.create(detparam, detmodel, { gpu });
    this.recognizer = await Recognizer.create(recparam, recmodel, { gpu });
  },
  isReady() {
    return this.enable && !!this.detecter && !!this.recognizer;
  },
  async recognize(img) {
    using _lock = await this.taskQueue.acquire();
    let image = await img.removeAlpha().raw({ depth: 'char' }).toBuffer({ resolveWithObject: true });
    if (image.info.channels === 1) {
      img = sharp(image.data, { raw: image.info });
      img = img.joinChannel([image.data, image.data], { raw: image.info });
      image = await img.raw({ depth: 'char' }).toBuffer({ resolveWithObject: true });
    }
    const boxes = await this.detecter!.detect(image);
    boxes.sort((a, b) => a.center.x / 100 + a.center.y - (b.center.x / 100 + b.center.y));
    const textes = await this.recognizer!.recognize(image, boxes);
    return textes.join('\n');
  },
  destroy() {},
});
