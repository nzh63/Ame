import sharp from 'sharp';
import { findWindow, capture, CaptureResult, HWND } from '@addons/ScreenCapturer';
import logger from '@logger/extractor/OcrExtractor/ScreenCapturer';

export class ScreenCapturer {
    private static emptyImage = () => sharp(Buffer.alloc(1, 0), { raw: { width: 1, height: 1, channels: 1 } });
    private hwnd?: HWND;
    constructor(
        public gamePids: number[],
        hwnd?: HWND
    ) {
        if (hwnd) this.hwnd = BigInt(hwnd);
        else this.findWindow();
    }

    private async findWindow() {
        this.hwnd = await findWindow(this.gamePids);
    }

    public async capture(canRetry = true): Promise<sharp.Sharp> {
        if (!this.hwnd) await this.findWindow();
        if (!this.hwnd) return ScreenCapturer.emptyImage();

        let result: CaptureResult;
        try {
            result = await capture(this.hwnd);
        } catch (e) {
            logger('fail to capture screen: %O', e);
            if (canRetry) return this.capture(false);
            else return ScreenCapturer.emptyImage();
        }
        const { width, height, buffer } = result;

        const img = sharp(buffer, { raw: { width, height, channels: 4 } })
            .recomb([[0, 0, 1], [0, 1, 0], [1, 0, 0]])
            .flip();

        return img;
    }

    public destroy() { }
}
