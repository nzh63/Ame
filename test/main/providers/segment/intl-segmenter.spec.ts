import { buildTest } from '.';
import '../../env';
import intlSegmenter from '@main/providers/segment/intl-segmenter';

buildTest(intlSegmenter, {
  enable: true,
  language: 'ja',
});
