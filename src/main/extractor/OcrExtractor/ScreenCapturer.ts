import type { DModel as M } from 'win32-def';
import sharp from 'sharp';
import { findWindow, capture, CaptureResult, HWND } from '@addons/ScreenCapturer';

export class ScreenCapturer {
    private static emptyImage = () => sharp(Buffer.alloc(1, 0), { raw: { width: 1, height: 1, channels: 1 } });
    private hwnd?: HWND;
    constructor(
        public gamePids: number[],
        hwnd?: M.HWND
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
            if (canRetry) return this.capture(false);
            else return ScreenCapturer.emptyImage();
        }
        const { width, height, buffer } = result;

        const img = sharp(buffer, { raw: { width, height, channels: 4 } });
        const [rBuffer, gBuffer, bBuffer, aBuffer] = await Promise.all([
            img.clone().extractChannel(2).raw().toColorspace('b-w').toBuffer(),
            img.clone().extractChannel(1).raw().toColorspace('b-w').toBuffer(),
            img.clone().extractChannel(0).raw().toColorspace('b-w').toBuffer(),
            img.clone().extractChannel(3).raw().toColorspace('b-w').toBuffer()
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
