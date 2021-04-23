import type sharp from 'sharp';
import { screen } from 'electron';
import { Hook } from '@main/hook';
import { TranslatorWindow } from '@main/window/TranslatorWindow';
import { OcrGuideWindow } from '@main/window/OcrGuideWindow';
import { createMainWindow, mainWindow } from '@main/index';
import { TranslateManager, TtsManager } from '@main/manager';
import { BaseExtractor, OcrExtractor, Textractor, PreprocessOption, PostProcessOption } from '@main/extractor';
import store from '@main/store';
import logger from '@logger/general';

export type OriginalWatchCallback = (arg: Ame.Translator.OriginalText) => void;
export type TranslateWatchCallback = (arg: Ame.Translator.TranslateResult) => void;
export type TranslateWatchErrorCallback = (err: any, arg: Ame.Translator.TranslateResult) => void;

export class General {
    private static instances: General[] = [];

    private hook: Hook;
    public extractor: BaseExtractor;

    private translatorWindow: TranslatorWindow;
    private ocrGuideWindow?: OcrGuideWindow;

    private originalWatchList: { [key in Ame.Extractor.Key]: OriginalWatchCallback } = {};
    private translateWatchList: { [key in Ame.Extractor.Key]: OriginalWatchCallback } = {};

    constructor(
        public uuid: string,
        public gamePids: number[],
        public hookCode = '',
        public type: Ame.Extractor.ExtractorType = 'textractor',
        public translateManager: TranslateManager = new TranslateManager(),
        public ttsManager: TtsManager = new TtsManager()
    ) {
        logger('start game for pids %O', this.gamePids);
        General.instances.push(this);
        this.hook = new Hook(this.gamePids);
        this.extractor = this.type === 'textractor'
            ? new Textractor(this.gamePids, this.hookCode)
            : new OcrExtractor(this.gamePids, this.hook);
        let openGuide = false;
        if (this.type === 'textractor') {
            this.setupTextractorExtractor();
        } else if (this.type === 'ocr') {
            openGuide = this.setupOcrExtractor();
        }
        this.translatorWindow = new TranslatorWindow(this, this.gamePids, !openGuide);
        if (openGuide) {
            this.openOcrGuideWindow();
        }

        this.translatorWindow.once('ready-to-show', () => {
            if (mainWindow) {
                mainWindow.hide();
            }
        });

        this.hook.on('game-exit', () => {
            this.destroy();
            createMainWindow();
        });

        this.hook.on('window-move', ({ diffLeft, diffTop }: { diffLeft: number, diffTop: number }) => {
            const p = this.translatorWindow.getPosition();
            const s = this.translatorWindow.getSize();
            let rect = { x: p[0], y: p[1], width: s[0], height: s[1] };
            rect = screen.dipToScreenRect(this.translatorWindow, rect);
            rect.x += diffLeft;
            rect.y += diffTop;
            rect = screen.screenToDipRect(this.translatorWindow, rect);
            logger('game windows moved, set position of TranslatorWindow at %O', rect);
            this.translatorWindow.setPosition(rect.x, rect.y);
        });

        this.hook.on('window-minimize', () => {
            logger('%o window minimized', this.gamePids);
            this.translatorWindow.minimize();
        });

        this.hook.on('window-restore', () => {
            logger('%o window restored', this.gamePids);
            this.translatorWindow.restore();
        });
    }

    private setupTextractorExtractor() {
        const game = store.get('games').find(i => i.uuid === this.uuid);
        if (game?.textractor?.postProcessOption) {
            (this.extractor as Textractor).postProcessOption = game?.textractor.postProcessOption;
        }
        return false;
    }

    private setupOcrExtractor() {
        let openGuide = true;
        const game = store.get('games').find(i => i.uuid === this.uuid);
        if (game?.ocr?.rect) {
            (this.extractor as OcrExtractor).rect = game.ocr.rect;
            openGuide = false;
        }
        if (game?.ocr?.preprocess) {
            (this.extractor as OcrExtractor).preprocessOption = game.ocr.preprocess;
            openGuide = false;
        }
        return openGuide;
    }

    public switchExtractor(type: Ame.Extractor.ExtractorType) {
        if (type === 'textractor') {
            if (!(this.extractor instanceof Textractor)) {
                this.type = type;
                this.extractor.destroy();
                this.extractor = new Textractor(this.gamePids, this.hookCode);
            }
        } else if (type === 'ocr') {
            if (!(this.extractor instanceof OcrExtractor)) {
                this.type = type;
                this.extractor.destroy();
                this.extractor = new OcrExtractor(this.gamePids, this.hook);
                this.setupOcrExtractor();
            }
        } else {
            // eslint-disable-next-line  @typescript-eslint/no-unused-vars
            const _typeCheck: never = type;
        }
    }

    public openOcrGuideWindow() {
        if (this.type !== 'ocr') throw new Error('extractor is not ocr');
        this.translatorWindow.hide();
        this.extractor.pause();
        if (this.ocrGuideWindow && !this.ocrGuideWindow.isDestroyed()) {
            this.ocrGuideWindow.destroy();
        }
        this.ocrGuideWindow = new OcrGuideWindow(this);
        this.ocrGuideWindow.once('closed', () => {
            if (!this.translatorWindow.isDestroyed()) this.translatorWindow.show();
            this.extractor.resume();
            this.ocrGuideWindow = undefined;
        });
    }

    public setTextractorPostProcess(option: PostProcessOption) {
        if (this.type === 'textractor') {
            (this.extractor as Textractor).postProcessOption = option;
            const games = store.get('games');
            const game = games.find(i => i.uuid === this.uuid);
            if (game) {
                game.textractor = game.textractor ?? {};
                game.textractor.postProcessOption = option;
                store.set('games', games);
            }
        } else {
            throw new Error('Not in Textractor mode');
        }
    }

    public setOcrRect(rect: sharp.Region) {
        if (this.type === 'ocr') {
            for (const i in rect) {
                rect[i as keyof sharp.Region] = Math.round(rect[i as keyof sharp.Region]);
            }
            (this.extractor as OcrExtractor).rect = rect;
            const games = store.get('games');
            const game = games.find(i => i.uuid === this.uuid);
            if (game) {
                game.ocr = game.ocr ?? {};
                game.ocr.rect = rect;
                store.set('games', games);
            }
        } else {
            throw new Error('Not in Ocr mode');
        }
    }

    public setOcrPreprocess(option: PreprocessOption) {
        if (this.type === 'ocr') {
            (this.extractor as OcrExtractor).preprocessOption = option;
            const games = store.get('games');
            const game = games.find(i => i.uuid === this.uuid);
            if (game) {
                game.ocr = game.ocr ?? {};
                game.ocr.preprocess = option;
                store.set('games', games);
            }
        } else {
            throw new Error('Not in Ocr mode');
        }
    }

    public watchOriginal(key: Ame.Extractor.Key) {
        logger('watch original at %s', key);
        if (this.originalWatchList[key]) {
            logger(`${key} has been watched, the old callback will be remove.`);
            this.unwatchOriginal(key);
        }
        const callback: OriginalWatchCallback = (value) => {
            logger('original-watch-list-update %O', value);
            this.translatorWindow.webContents.send('original-watch-list-update', value);
            if (key !== 'any') this.translatorWindow.showInactive();
        };
        this.originalWatchList[key] = callback;
        if (this.extractor.text[key]) callback({ key, text: this.extractor.text[key] });
        this.extractor.on(`update:${key}`, callback);
    }

    public unwatchOriginal(key: Ame.Extractor.Key) {
        logger('unwatch original at %s', key);
        if (!this.originalWatchList[key]) return;
        this.extractor.off(`update:${key}`, this.originalWatchList[key]);
    }

    public watchTranslate(key: Ame.Extractor.Key) {
        logger('watch translate at %s', key);
        if (this.translateWatchList[key]) {
            logger(`${key} has been watched, the old callback will be remove.`);
            this.unwatchTranslate(key);
        }
        const callback: OriginalWatchCallback = ({ key, text }) => {
            this.translateManager.translate(key, text, (err, result) => {
                if (!err) this.translatorWindow.webContents.send('translate-watch-list-update', result);
                else this.translatorWindow.webContents.send('translate-watch-list-update-error', err, result);
            });
        };
        this.translateWatchList[key] = callback;
        if (this.extractor.text[key]) callback({ key, text: this.extractor.text[key] });
        this.extractor.on(`update:${key}`, callback);
    }

    public unwatchTranslate(key: Ame.Extractor.Key) {
        logger('unwatch translate at %s', key);
        if (!this.translateWatchList[key]) return;
        this.extractor.off(`update:${key}`, this.translateWatchList[key]);
    }

    public get text(): Readonly<Ame.Extractor.Result> {
        return this.extractor.text;
    }

    public destroy() {
        logger('%o General destroy', this.gamePids);
        for (const key in this.originalWatchList) {
            this.unwatchOriginal(key);
        }
        for (const key in this.translateWatchList) {
            this.unwatchTranslate(key);
        }
        if (!this.translatorWindow.isDestroyed()) {
            this.translatorWindow.destroy();
        }
        if (this.ocrGuideWindow && !this.ocrGuideWindow.isDestroyed()) {
            this.ocrGuideWindow.destroy();
        }
        this.hook.destroy();
        this.extractor.destroy();
        this.translateManager.destroy();
        this.ttsManager.destroy();
    }

    static getAllInstances(): readonly General[] {
        return General.instances;
    }
}
