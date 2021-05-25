import '../../env';
import intlSegmenter from '@main/providers/segment/intl-segmenter';
import { buildTest } from '.';

buildTest(intlSegmenter, {
    enable: true,
    language: 'ja'
});
