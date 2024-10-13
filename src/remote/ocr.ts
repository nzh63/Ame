import type { PreprocessOption } from '@main/extractor';
import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';
import electron from 'electron';
import type sharp from 'sharp';

export const getScreenCapture = defineRemoteFunction(
  'get-screen-capture',
  requireContext,
  async (event, force = false) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    if (!window.context.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      return (await window.context.extractor.getLastCapture(force)).png().toBuffer();
    }
  },
);

export const getPreprocessedImage = defineRemoteFunction(
  'get-preprocessed-image',
  requireContext,
  async (event, img: Buffer, option: PreprocessOption) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    if (!window.context.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      const { default: sharp } = await import('sharp');
      return await window.context.extractor.preprocess(sharp(img), option).png().toBuffer();
    }
  },
);

export const getScreenCaptureCropRect = defineRemoteFunction(
  'get-screen-capture-crop-rect',
  requireContext,
  (event) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    if (!window.context.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      return window.context.extractor.rect;
    }
  },
);

export const setScreenCaptureCropRect = defineRemoteFunction(
  'set-screen-capture-crop-rect',
  requireContext,
  (event, rect: sharp.Region) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    window.context.setOcrRect(rect);
  },
);

export const openOcrGuideWindow = defineRemoteFunction('open-ocr-guide-window', requireContext, (event) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
  if (!window.context.extractorTypeIs('ocr')) {
    throw new Error('Not in Ocr mode');
  } else {
    window.context.openOcrGuideWindow();
  }
});

export const getScreenCapturePreprocessOption = defineRemoteFunction(
  'get-screen-capture-preprocess-option',
  requireContext,
  (event) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    if (!window.context.extractorTypeIs('ocr')) {
      throw new Error('Not in Ocr mode');
    } else {
      return window.context.extractor.preprocessOption;
    }
  },
);

export const setScreenCapturePreprocessOption = defineRemoteFunction(
  'set-screen-capture-preprocess-option',
  requireContext,
  (event, option: PreprocessOption) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    window.context.setOcrPreprocess(option);
  },
);
