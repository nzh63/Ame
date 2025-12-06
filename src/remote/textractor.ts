import type { PostProcessOption } from '@main/extractor';
import type { WindowWithSession } from '@main/window/WindowWithSession';
import { defineRemoteFunction, requireSession } from '@remote/common';
import electron from 'electron';

export const getTextractorPostProcessOption = defineRemoteFunction(
  'get-textractor-post-process-option',
  requireSession,
  (event) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    if (!window.session.extractorTypeIs('textractor')) {
      throw new Error('Not in Textractor mode');
    } else {
      return window.session.extractor.postProcessOption;
    }
  },
);

export const setTextractorPostProcessOption = defineRemoteFunction(
  'set-textractor-post-process-option',
  requireSession,
  (event, option: PostProcessOption) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    window.session.setTextractorPostProcess(option);
  },
);
