import { buildTest } from '.';
import '../../env';
import ppocr from '@main/providers/ocr/ppocr';

buildTest(ppocr, {
  enable: true,
  model: 'mobile.fp16',
  device: 'CPU',
});
