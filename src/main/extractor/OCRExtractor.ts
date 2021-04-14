import type { DModel as M } from 'win32-def';
import type { Extractor } from '@main/extractor';
import { gdi32, user32 } from '@main/win32';
import EventEmitter from 'events';
import fs from 'fs';
import { nativeImage } from 'electron';
import logger from '@logger/extractor/OCRExtractor';

export class OCRExtractor extends EventEmitter implements Extractor {
    constructor() {
        super();
        throw new Error('Not implemented.');
    }

    public get text(): Readonly<Ame.Extractor.Result> {
        throw new Error('Not implemented.');
    }

    public destroy() {
        throw new Error('Not implemented.');
    }
}

export class ScreenCapturer {
    private hwnd?: M.HWND;
    constructor(
        public gamePids: number[],
        hwnd?: M.HWND
    ) {
        if (hwnd) this.hwnd = hwnd;
        else this.findWindow();
        logger(this.hwnd);
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

    public capture() {
        if (!this.hwnd) throw new Error('window not found');

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
        user32.PrintWindow(this.hwnd, saveDC, 0x00000001 | 0x00000002 /* PW_CLIENTONLY | PW_RENDERFULLCONTENT */);
        const buf = Buffer.alloc(width * height * 4, 0);
        gdi32.GetBitmapBits(saveBitmap, width * height * 4, buf);
        gdi32.DeleteObject(saveBitmap);
        user32.ReleaseDC(this.hwnd, hwndDC);
        gdi32.DeleteObject(saveBitmap);

        const img = nativeImage.createFromBitmap(buf, { width, height });
        fs.writeFile('./a.png', img.toPNG(), () => { });
        return img;
    }
}
