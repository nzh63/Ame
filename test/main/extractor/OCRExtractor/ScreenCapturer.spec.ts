import { expect } from 'chai';
import { ScreenCapturer } from '@main/extractor/OCRExtractor/ScreenCapturer';
import { SimpleWindow } from '../../../SimpleWindow';

describe('ScreenCapturer', function() {
    let screenCapturer: ScreenCapturer;
    let window: SimpleWindow;

    before(async function() {
        this.timeout(5000);
        window = new SimpleWindow();
        await window.whenReady();
    });

    after(async function() {
        await window.destroy();
    });

    beforeEach(function() {
        screenCapturer = new ScreenCapturer(window.pids);
    });

    afterEach(function() {
        screenCapturer.destroy();
    });

    it('capture', async function() {
        for (const [width, height] of [[400, 300], [200, 600]]) {
            await window.run(`(function(){const { width, height } = screen.screenToDipRect(window, { x: 0, y: 0, width: ${width}, height: ${height} }); window.setSize(width, height);})()`);
            const img = await screenCapturer.capture();
            const meta = await img.metadata();
            expect(meta.width).to.equal(width);
            expect(meta.height).to.equal(height);
        }
    });

    it('capture without window', async function() {
        await window.run('app.on(\'window-all-closed\',() => { });window.destroy();');
        const img = await screenCapturer.capture();
        const meta = await img.metadata();
        expect(meta.width).to.equal(1);
        expect(meta.height).to.equal(1);
    });
});
