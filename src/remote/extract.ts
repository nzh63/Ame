import logger from '@logger/remote/extract';
import type { WindowWithSession } from '@main/window/WindowWithSession';
import { defineRemoteFunction, requireSession } from '@remote/common';
import electron from 'electron';

export const startExtract = defineRemoteFunction(
  'start-extract',
  async (event, uuid: string, gamePids: number[], hookCode?: string, type?: Ame.Extractor.ExtractorType) => {
    const { Session } = await import('@main/Session');
    const session = await Session.create(uuid, gamePids, hookCode, type);
    logger('create session for pid %o', session.gamePids);
  },
);

export const getAllExtractText = defineRemoteFunction('get-all-extract-text', requireSession, (event) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
  return window.session.text;
});

export const getExtractorType = defineRemoteFunction('get-extractor-type', requireSession, (event) => {
  const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
  return window.session.type;
});

export const switchExtractorType = defineRemoteFunction(
  'switch-extractor-type',
  requireSession,
  (event, type: Ame.Extractor.ExtractorType) => {
    const window = electron.BrowserWindow.fromWebContents(event.sender) as WindowWithSession;
    window.session.switchExtractor(type);
  },
);
