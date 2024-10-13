import type { PostProcessOption } from '@main/extractor';
import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';
import electron from 'electron';

export const getTextractorPostProcessOption = defineRemoteFunction(
  'get-textractor-post-process-option',
  requireContext,
  (event) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    if (!window.context.extractorTypeIs('textractor')) {
      throw new Error('Not in Textractor mode');
    } else {
      return window.context.extractor.postProcessOption;
    }
  },
);

export const setTextractorPostProcessOption = defineRemoteFunction(
  'set-textractor-post-process-option',
  requireContext,
  (event, option: PostProcessOption) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    window.context.setTextractorPostProcess(option);
  },
);
