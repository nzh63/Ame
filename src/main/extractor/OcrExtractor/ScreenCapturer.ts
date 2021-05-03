import type { DModel as M } from 'win32-def';
import { promisify } from 'util';
import sharp from 'sharp';
import { gdi32, user32 } from '@main/win32';
import { TaskQueue } from '@main/utils';

export class ScreenCapturer {
    private static emptyImage = () => sharp(Buffer.alloc(1, 0), { raw: { width: 1, height: 1, channels: 1 } });
    private hwnd?: M.HWND;
    private taskQueue = new TaskQueue();
    constructor(
        public gamePids: number[],
        hwnd?: M.HWND
    ) {
        if (hwnd) this.hwnd = hwnd;
        else this.findWindow();
    }

    private async findWindow() {
        let findHwnd: M.HWND | undefined;
        // 不能同时运行两个EnumWindows函数，否则会造成效率明显降低，原因不详
        // 这里使用taskQueue来等待上一个EnumWindows运行完成会再运行新的
        const ret = await this.taskQueue.dispatch(
            () => user32.EnumWindows.async(hwnd => {
                Promise.resolve().then(() => {
                    const lpdwProcessId = Buffer.alloc(4, 0);
                    user32.GetWindowThreadProcessId(hwnd, lpdwProcessId);
                    const pid = lpdwProcessId.readUInt32LE(0);
                    if (user32.IsWindowEnabled(hwnd) && user32.IsWindowVisible(hwnd) && this.gamePids.includes(pid)) {
                        findHwnd = hwnd;
                    }
                });
                return findHwnd ? 0 : 1;
            }, 0)
        );
        this.hwnd = findHwnd;
        delete ret.callbackEntry;
    }

    public async capture(canRetry = true): Promise<sharp.Sharp> {
        if (!this.hwnd) await this.findWindow();
        if (!this.hwnd) return ScreenCapturer.emptyImage();

        const rect = Buffer.alloc(4 * 4, 0);
        user32.GetWindowRect(this.hwnd, rect);
        const left = rect.readInt32LE(0);
        const top = rect.readInt32LE(4);
        const right = rect.readInt32LE(8);
        const bottom = rect.readInt32LE(12);
        const width = right - left;
        const height = bottom - top;

        if (!width || !height) {
            this.hwnd = undefined;
            return canRetry ? this.capture(false) : ScreenCapturer.emptyImage();
        }

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
