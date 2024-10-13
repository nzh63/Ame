import logger from '@logger/remote/extract';
import type { WindowWithContext } from '@main/window/WindowWithContext';
import { defineRemoteFunction, requireContext } from '@remote/common';
import electron from 'electron';

export const startExtract = defineRemoteFunction(
  'start-extract',
  async (event, uuid: string, gamePids: number[], hookCode?: string, type?: Ame.Extractor.ExtractorType) => {
    const { Context } = await import('@main/Context');
    const context = await Context.create(uuid, gamePids, hookCode, type);
    logger('create context for pid %o', context.gamePids);
  },
);

export const getAllExtractText = defineRemoteFunction('get-all-extract-text', requireContext, (event) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
  return window.context.text;
});

export const getExtractorType = defineRemoteFunction('get-extractor-type', requireContext, (event) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
  return window.context.type;
});

export const switchExtractorType = defineRemoteFunction(
  'switch-extractor-type',
  requireContext,
  (event, type: Ame.Extractor.ExtractorType) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithContext;
    window.context.switchExtractor(type);
  },
);
