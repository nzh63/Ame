import { expect } from 'chai';
import { ScreenCapturer } from '@main/extractor/OcrExtractor/ScreenCapturer';
import { SimpleWindow } from '../../../SimpleWindow';

describe('ScreenCapturer', function () {
    let screenCapturer: ScreenCapturer;
    let window: SimpleWindow;

    before(async function () {
        this.timeout(10000);
        this.retries(3);
        window = new SimpleWindow();
        await window.whenReady();
    });

    after(async function () {
        await window.destroy();
    });

    beforeEach(function () {
        screenCapturer = new ScreenCapturer(window.pids);
    });

    afterEach(function () {
        screenCapturer.destroy();
    });

    it('capture', async function () {
        for (const [width, height] of [[400, 300], [200, 600]]) {
            await window.run(`(function(){const { width, height } = screen.screenToDipRect(window, { x: 0, y: 0, width: ${width}, height: ${height} }); window.setSize(width, height);})()`);
            const img = await screenCapturer.capture();
            const meta = await img.metadata();
            expect(meta.width).to.gt(width - 20).and.lt(width + 20);
            expect(meta.height).to.gt(height - 20).and.lt(height + 20);
        }
    });

    it('capture without window', async function () {
        await window.run('app.on(\'window-all-closed\',() => { });window.destroy();');
        const img = await screenCapturer.capture();
        const meta = await img.metadata();
        expect(meta.width).to.equal(1);
        expect(meta.height).to.equal(1);
    });
});
