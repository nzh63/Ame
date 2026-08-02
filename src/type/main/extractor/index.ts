/** Textractor post-processing options. */
export interface PostProcessOption {
  removeDuplication?: boolean;
}

/** OCR image pre-processing options. */
export interface PreprocessOption {
  color: 'colorful' | 'grey' | 'red' | 'green' | 'blue';
  threshold?: number;
}
