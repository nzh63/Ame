import type { PreprocessOption } from '@main/extractor';
import type { WindowWithSession } from '@main/window/WindowWithSession';
import { defineRemoteFunction, requireSession } from '@remote/common';
import electron from 'electron';
import type sharp from 'sharp';

export const getScreenCapture = defineRemoteFunction(
  'get-screen-capture',
  requireSession,
  async (event, force = false) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    if (!window.session.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      return (await window.session.extractor.getLastCapture(force)).png().toBuffer();
    }
  },
);

export const getPreprocessedImage = defineRemoteFunction(
  'get-preprocessed-image',
  requireSession,
  async (event, img: Buffer, option: PreprocessOption) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    if (!window.session.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      const { default: sharp } = await import('sharp');
      return await window.session.extractor.preprocess(sharp(img), option).png().toBuffer();
    }
  },
);

export const getScreenCaptureCropRect = defineRemoteFunction(
  'get-screen-capture-crop-rect',
  requireSession,
  (event) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    if (!window.session.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      return window.session.extractor.rect;
    }
  },
);

export const setScreenCaptureCropRect = defineRemoteFunction(
  'set-screen-capture-crop-rect',
  requireSession,
  (event, rect: sharp.Region) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    window.session.setOcrRect(rect);
  },
);

export const openOcrGuideWindow = defineRemoteFunction('open-ocr-guide-window', requireSession, (event) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
  if (!window.session.extractorTypeIs('ocr')) {
    throw new Error('Not in Ocr mode');
  } else {
    window.session.openOcrGuideWindow();
  }
});

export const getScreenCapturePreprocessOption = defineRemoteFunction(
  'get-screen-capture-preprocess-option',
  requireSession,
  (event) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    if (!window.session.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      return window.session.extractor.preprocessOption;
    }
  },
);

export const setScreenCapturePreprocessOption = defineRemoteFunction(
  'set-screen-capture-preprocess-option',
  requireSession,
  (event, option: PreprocessOption) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    window.session.setOcrPreprocess(option);
  },
);
