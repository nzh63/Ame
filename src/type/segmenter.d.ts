declare namespace Intl {
    declare class Segmenter {
        constructor(locale: string, options?: SegmenterOptions);
        segment(input: string): Segments;
    }
    interface SegmenterOptions {
        granularity?: 'grapheme' | 'word' | 'sentence';
    }
    interface Segment {
        index: number;
        segment: string;
        input: string;
        isWordLike: boolean;
    }

    interface Segments extends Iterable<Segment> {
        containing(index: number): Segment | undefined;
    }
}
