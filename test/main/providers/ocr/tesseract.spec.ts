import '../../env';
import tesseract from '@main/providers/ocr/tesseract';
import { buildTest } from '.';

buildTest(tesseract, {
    enable: true,
    language: 'jpn'
});
