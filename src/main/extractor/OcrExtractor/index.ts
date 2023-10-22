import type { Hook } from '@main/hook';
import type { OcrExtractorOptions } from '@main/extractor/OcrExtractor/options';
import sharp from 'sharp';
import store from '@main/store';
import { IExtractor } from '@main/extractor/IExtractor';
import { ScreenCapturer } from '@main/extractor/OcrExtractor//ScreenCapturer';
import { OcrManager } from '@main/manager/OcrManager';
import logger from '@logger/extractor/OcrExtractor';

export interface PreprocessOption {
    color: 'colorful' | 'grey' | 'red' | 'green' | 'blue';
    threshold?: number
}

export class OcrExtractor extends IExtractor {
    private lastImage?: sharp.Sharp;
    private lastCropImage?: sharp.Sharp;
    private shouldCapture1 = true;
    private shouldCapture2 = true;
    private mouseLeftHookCallback: () => void;
    private mouseWheelHookCallback: () => void;
    private keyboardHookCallback: (code: number) => void;
    private minimizeHookCallback: () => void;
    private restoreHookCallback: () => void;
    private options: OcrExtractorOptions;
    private setTimeoutId?: ReturnType<typeof setTimeout>;

    public rect?: sharp.Region;
    public preprocessOption: PreprocessOption = {
        color: 'colorful'
    };

    constructor(
        public gamePids: number[],
        public hook: Hook,
        private screenCapturer: ScreenCapturer = new ScreenCapturer(gamePids),
        private ocrManager: OcrManager = new OcrManager()
    ) {
        super();
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
        this.minimizeHookCallback = () => {
            this.shouldCapture1 = false;
            this.hook.unregisterKeyboardAndMouseHook();
        };
        this.hook.on('window-minimize', this.minimizeHookCallback);
        this.restoreHookCallback = () => {
            this.shouldCapture1 = true;
            if (this.shouldCapture) {
                this.hook.registerKeyboardAndMouseHook();
            }
        };
        this.hook.on('window-restore', this.restoreHookCallback);
        this.hook.registerKeyboardAndMouseHook();
    }

    private get shouldCapture() {
        return this.shouldCapture1 && this.shouldCapture2;
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
        if (this.rect) {
            // NOTE: 我们把图像flip过，所以这里rect同样要反转
            const metatdat = await this.lastImage.metadata();
            const rect: sharp.Region = {
                left: this.rect.left,
                width: this.rect.width,
                top: (metatdat.height ?? 0) - this.rect.top - this.rect.height,
                height: this.rect.height
            };
            this.lastCropImage = this.lastImage.clone().extract(rect);
        } else {
            this.lastCropImage = this.lastImage.clone();
        }
        this.lastCropImage = this.preprocess(this.lastCropImage);
        this.ocrManager.recognize(this.lastCropImage, (e, res) => {
            if (this.lastCropImage !== res.img) return;
            let text: string;
            if (e) {
                text = e.message ?? JSON.stringify(e);
            } else {
                text = res.text;
            }
            const key = `ocr-${res.providerId}`;
            this.update(key, text);
        });
    }

    private preprocess(img: sharp.Sharp) {
        if (this.preprocessOption.color === 'grey') {
            img = img.clone().greyscale();
        } else if (['red', 'green', 'blue'].includes(this.preprocessOption.color)) {
            img = img.clone().extractChannel(this.preprocessOption.color as any);
        }
        if (this.preprocessOption.threshold) {
            img = img.threshold(this.preprocessOption.threshold, { greyscale: false });
        }
        return img;
    }

    public async getLastCapture(force = false): Promise<sharp.Sharp> {
        if (force) {
            return this.screenCapturer.capture();
        } else {
            return this.lastImage ?? this.screenCapturer.capture();
        }
    }

    public pause() {
        this.shouldCapture2 = false;
        this.hook.unregisterKeyboardAndMouseHook();
    }

    public resume() {
        this.shouldCapture2 = true;
        if (this.shouldCapture) {
            this.hook.registerKeyboardAndMouseHook();
        }
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
        this.ocrManager.destroy();
    }
}
