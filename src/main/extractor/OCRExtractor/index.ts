import type { DModel as M } from 'win32-def';
import type { Extractor } from '@main/extractor';
import type { Hook } from '@main/hook';
import type { OCRExtractorOptions } from '@main/extractor/OCRExtractor/options';
import { promisify } from 'util';
import EventEmitter from 'events';
import sharp from 'sharp';
import store from '@main/store';
import { gdi32, user32 } from '@main/win32';
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
        this.hook.off('mouse-left-up', this.mouseLeftHookCallback);
        this.hook.off('mouse-wheel', this.mouseWheelHookCallback);
        this.hook.off('key-up', this.keyboardHookCallback);
        this.hook.off('window-minimize', this.minimizeHookCallback);
        this.hook.off('window-restore', this.restoreHookCallback);
        this.hook.unregisterKeyboardAndMouseHook();
    }
}

class ScreenCapturer {
    private hwnd?: M.HWND;
    constructor(
        public gamePids: number[],
        hwnd?: M.HWND
    ) {
        if (hwnd) this.hwnd = hwnd;
        else this.findWindow();
    }

    private findWindow() {
        const ret = user32.EnumWindows(hwnd => {
            const lpdwProcessId = Buffer.alloc(4, 0);
            user32.GetWindowThreadProcessId(hwnd, lpdwProcessId);
            const pid = lpdwProcessId.readUInt32LE(0);
            if (user32.IsWindowEnabled(hwnd) && user32.IsWindowVisible(hwnd) && this.gamePids.includes(pid)) {
                this.hwnd = hwnd;
                return 0;
            } else {
                return 1;
            }
        }, 0);
        delete ret.callbackEntry;
    }

    public async capture() {
        if (!this.hwnd) this.findWindow();
        if (!this.hwnd) return sharp(Buffer.from(''));

        const rect = Buffer.alloc(4 * 4, 0);
        user32.GetWindowRect(this.hwnd, rect);
        const left = rect.readInt32LE(0);
        const top = rect.readInt32LE(4);
        const right = rect.readInt32LE(8);
        const bottom = rect.readInt32LE(12);
        const width = right - left;
        const height = bottom - top;

        const hwndDC = user32.GetWindowDC(this.hwnd);
        const saveDC = gdi32.CreateCompatibleDC(hwndDC);
        const saveBitmap = gdi32.CreateCompatibleBitmap(hwndDC, width, height);
        gdi32.SelectObject(saveDC, saveBitmap);
        await promisify(user32.PrintWindow.async)(this.hwnd, saveDC, 0x00000001 | 0x00000002 /* PW_CLIENTONLY | PW_RENDERFULLCONTENT */);
        const buf = Buffer.alloc(width * height * 4, 0);
        promisify(gdi32.GetBitmapBits.async)(saveBitmap, width * height * 4, buf);
        gdi32.DeleteObject(saveBitmap);
        user32.ReleaseDC(this.hwnd, hwndDC);
        gdi32.DeleteObject(saveBitmap);

        const img = sharp(buf, { raw: { width, height, channels: 4 } });
        const [rBuffer, gBuffer, bBuffer, aBuffer] = await Promise.all([
            img.clone().extractChannel(2).raw().toColourspace('b-w').toBuffer(),
            img.clone().extractChannel(1).raw().toColourspace('b-w').toBuffer(),
            img.clone().extractChannel(0).raw().toColourspace('b-w').toBuffer(),
            img.clone().extractChannel(3).raw().toColourspace('b-w').toBuffer()
        ]);
        const r = sharp(rBuffer, { raw: { width, height, channels: 1 } });
        const rgba = r
            .joinChannel(gBuffer, { raw: { width, height, channels: 1 } })
            .joinChannel(bBuffer, { raw: { width, height, channels: 1 } })
            .joinChannel(aBuffer, { raw: { width, height, channels: 1 } });
        return sharp(await rgba.raw().toBuffer(), { raw: { width, height, channels: 4 } });
    }

    public destroy() { }
}
