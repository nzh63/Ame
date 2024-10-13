import { buildTest } from '.';
import '../../env';
import tesseract from '@main/providers/ocr/tesseract';

buildTest(tesseract, {
  enable: true,
  language: 'jpn',
});
