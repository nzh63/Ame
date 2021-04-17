import type { Extractor } from '@main/extractor';
import type { Hook } from '@main/hook';
import type { OCRExtractorOptions } from '@main/extractor/OCRExtractor/options';
import EventEmitter from 'events';
import sharp from 'sharp';
import store from '@main/store';
import { ScreenCapturer } from '@main/extractor/OCRExtractor//ScreenCapturer';
import { OCRManager } from '@main/manager/OCRManager';
import logger from '@logger/extractor/OCRExtractor';

export class OCRExtractor extends EventEmitter implements Extractor {
    private screenCapturer: ScreenCapturer;
    private lastImage?: sharp.Sharp;
    private lastCropImage?: sharp.Sharp;
    private shouldCapture = true;
    private mouseLeftHookCallback: () => void;
    private mouseWheelHookCallback: () => void;
    private keyboardHookCallback: (code: number) => void;
    private minimizeHookCallback: () => void;
    private restoreHookCallback: () => void;
    private options: OCRExtractorOptions;
    private text_: Ame.Extractor.Result = {};
    private setTimeoutId?: ReturnType<typeof setTimeout>;

    public rect?: sharp.Region;
    constructor(
        public gamePids: number[],
        public hook: Hook,
        private ocrManager: OCRManager = OCRManager.getInstance()
    ) {
        super();
        this.screenCapturer = new ScreenCapturer(this.gamePids);
        this.options = store.get('ocrExtractor');
        store.onDidChange('ocrExtractor', () => { this.options = store.get('ocrExtractor'); });

        this.mouseLeftHookCallback = () => {
            if (this.shouldCapture && this.options.trigger.mouse.left) {
                this.triggerRecognizeLatter();
            }
        };
        this.hook.on('mouse-left-up', this.mouseLeftHookCallback);
        this.mouseWheelHookCallback = () => {
            if (this.shouldCapture && this.options.trigger.mouse.wheel) {
                this.triggerRecognizeLatter();
            }
        };
        this.hook.on('mouse-wheel', this.mouseWheelHookCallback);
        this.keyboardHookCallback = (code: number) => {
            if (this.shouldCapture && this.shouldCaptureAtKeyboard(code)) {
                this.triggerRecognizeLatter();
            }
        };
        this.hook.on('key-up', this.keyboardHookCallback);
        this.minimizeHookCallback = () => { this.shouldCapture = false; };
        this.hook.on('window-minimize', this.minimizeHookCallback);
        this.restoreHookCallback = () => { this.shouldCapture = true; };
        this.hook.on('window-restore', this.restoreHookCallback);
        this.hook.registerKeyboardAndMouseHook();
    }

    private shouldCaptureAtKeyboard(code: number) {
        if (code === 0x20 && this.options.trigger.keyboard.space) {
            return true;
        }
        if (code === 0x0D && this.options.trigger.keyboard.enter) {
            return true;
        }
        return false;
    }

    private triggerRecognizeLatter() {
        if (this.setTimeoutId) clearTimeout(this.setTimeoutId);
        this.setTimeoutId = setTimeout(() => {
            logger('triggerRecognize');
            this.setTimeoutId = undefined;
            this.triggerRecognize();
        }, this.options.delay);
    }

    private async triggerRecognize() {
        this.lastImage = await this.screenCapturer.capture();
        this.lastCropImage = this.rect ? this.lastImage.clone().extract(this.rect) : this.lastImage.clone();
        this.ocrManager.recognize(this.lastCropImage, (e, res) => {
            if (this.lastCropImage !== res.img) return;
            let text: string;
            if (e) {
                text = e.message ?? JSON.stringify(e);
            } else {
                text = res.text;
            }
            const key = `ocr-${res.providerId}`;
            if (text !== this.text_[key]) {
                this.text_[key] = text;
                this.emit(`update:${key}`, { key, text });
                this.emit('update:any', { key, text });
            }
        });
    }

    public get text(): Readonly<Ame.Extractor.Result> {
        return this.text_;
    }

    public async getLastCapture(): Promise<sharp.Sharp> {
        return this.lastImage ?? this.screenCapturer.capture();
    }

    public destroy() {
        this.screenCapturer.destroy();
        this.lastImage = undefined;
        if (this.setTimeoutId) clearTimeout(this.setTimeoutId);
        this.hook.off('mouse-left-up', this.mouseLeftHookCallback);
        this.hook.off('mouse-wheel', this.mouseWheelHookCallback);
        this.hook.off('key-up', this.keyboardHookCallback);
        this.hook.off('window-minimize', this.minimizeHookCallback);
        this.hook.off('window-restore', this.restoreHookCallback);
        this.hook.unregisterKeyboardAndMouseHook();
    }
}
