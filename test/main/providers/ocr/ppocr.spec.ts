import { buildTest } from '.';
import '../../env';
import { GPU } from '@addons/PP-OCR';
import ppocr from '@main/providers/ocr/ppocr';

buildTest(ppocr, {
  enable: true,
  model: 'server.fp32',
  device: 'CPU',
  textDirection: '横排文本 从左到右',
});

if (GPU.devices.length) {
  const ppocrGpu = { ...ppocr, id: 'PP-OCR-GPU' } as const;
  buildTest(ppocrGpu, {
    enable: true,
    model: 'server.fp32',
    device: 'GPU (自动)',
    textDirection: '横排文本 从左到右',
  });
}
