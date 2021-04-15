import type { DModel as M } from 'win32-def';
import type { Extractor } from '@main/extractor';
import type { Hook } from '@main/hook';
import { nativeImage } from 'electron';
import { promisify } from 'util';
import EventEmitter from 'events';
import { gdi32, user32 } from '@main/win32';
import { OCRManager } from '@main/manager/OCRManager';
import logger from '@logger/extractor/OCRExtractor';

export class OCRExtractor extends EventEmitter implements Extractor {
    private screenCapturer: ScreenCapturer;
    private lastImage?: nativeImage;
    private lastCropImage?: nativeImage;
    private shouldCapture = true;
    private mouseHookCallback: () => void;
    private minimizeHookCallback: () => void;
    private restoreHookCallback: () => void;
    public rect?: Electron.Rectangle;
    private text_: Ame.Extractor.Result = {};
    constructor(
        public gamePids: number[],
        public hook: Hook,
        private ocrManager: OCRManager = OCRManager.getInstance()
    ) {
        super();
        this.screenCapturer = new ScreenCapturer(this.gamePids);
        this.mouseHookCallback = () => {
            if (this.shouldCapture) {
                setTimeout(() => {
                    logger('triggerRecognize');
                    this.triggerRecognize();
                }, 500);
            }
        };
        this.hook.on('mouse-left-down', this.mouseHookCallback);
        this.minimizeHookCallback = () => { this.shouldCapture = false; };
        this.hook.on('window-minimize', this.minimizeHookCallback);
        this.restoreHookCallback = () => { this.shouldCapture = true; };
        this.hook.on('window-restore', this.restoreHookCallback);
        this.hook.registerKeyboardAndMouseHook();
    }

    private async triggerRecognize() {
        this.lastImage = await this.screenCapturer.capture();
        if (!this.rect) {
            this.rect = {
                x: Math.round(this.lastImage.getSize().width * 0.1),
                y: Math.round(this.lastImage.getSize().height * 0.6),
                width: Math.round(this.lastImage.getSize().width * 0.8),
                height: Math.round(this.lastImage.getSize().height * 0.2)
            };
        }
        this.lastCropImage = this.lastImage.crop(this.rect);
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

    public getLastCapture() {
        return this.lastImage ?? nativeImage.createEmpty();
    }

    public destroy() {
        this.screenCapturer.destroy();
        this.lastImage = undefined;
        this.hook.off('mouse-left-down', this.mouseHookCallback);
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
        if (!this.hwnd) return nativeImage.createEmpty();

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

        const img = nativeImage.createFromBitmap(buf, { width, height });
        return img;
    }

    public destroy() { }
}
