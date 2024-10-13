import { SimpleWindow } from '../../../SimpleWindow';
import { OcrExtractor } from '@main/extractor/OcrExtractor';
import type { ScreenCapturer } from '@main/extractor/OcrExtractor//ScreenCapturer';
import type { OcrExtractorOptions } from '@main/extractor/OcrExtractor/options';
import type { Hook } from '@main/hook';
import type { OcrManager } from '@main/manager';
import { expect } from 'chai';
import EventEmitter from 'events';
import sharp from 'sharp';

class MockHook extends EventEmitter {
  public registerKeyboardAndMouseHook(): void {}

  public unregisterKeyboardAndMouseHook(): void {}

  public destroy(): void {}
}

type OcrCallback = (err: any, res: { providerId: string; img: sharp.Sharp; text: string }) => void;
class MockOcrManager {
  public flag = false;
  public p: Promise<void> = Promise.resolve();
  public resolve = () => {};
  public recognize(img: sharp.Sharp, callback: OcrCallback) {
    this.flag = true;
    this.resolve();
    setImmediate(() => callback(undefined, { providerId: 'mock', img, text: 'mock-mock' }));
  }

  public destroy() {}
}

class MockScreenCapturer {
  public async capture() {
    return sharp(Buffer.alloc(1, 0), { raw: { width: 1, height: 1, channels: 1 } });
  }

  public destroy() {}
}

describe('OcrExtractor', () => {
  let ocrExtractor: OcrExtractor;
  let window: SimpleWindow;
  let hook: Hook;
  let screenCapturer: ScreenCapturer;
  let ocrManager: OcrManager & MockOcrManager;
  let options: OcrExtractorOptions;

  before(async function () {
    this.timeout(10000);
    this.retries(3);
    window = new SimpleWindow();
    await window.whenReady();
  });

  after(async () => {
    await window.destroy();
  });

  beforeEach(() => {
    hook = new MockHook() as any;
    ocrManager = new MockOcrManager() as any;
    screenCapturer = new MockScreenCapturer() as any;
    ocrExtractor = new OcrExtractor(window.pids, hook, screenCapturer, ocrManager);
    options = (ocrExtractor as any).options;
    options.delay = 0;
  });

  afterEach(() => {
    hook.destroy();
    ocrExtractor.destroy();
  });

  function addTest(name: string, set: (v: boolean) => void, value?: any, displayName = name) {
    it(displayName, async () => {
      set(true);
      ocrManager.flag = false;
      ocrManager.p = new Promise<void>((resolve) => {
        ocrManager.resolve = resolve;
      });
      hook.emit(name, value);
      await Promise.race([
        ocrManager.p,
        new Promise((resolve) => {
          setTimeout(resolve, 0);
        }),
      ]);
      expect(ocrManager.flag).to.be.true;

      set(false);
      ocrManager.flag = false;
      ocrManager.p = new Promise<void>((resolve) => {
        ocrManager.resolve = resolve;
      });
      hook.emit(name, value);
      await Promise.race([
        ocrManager.p,
        new Promise((resolve) => {
          setTimeout(resolve, 0);
        }),
      ]);
      expect(ocrManager.flag).to.be.false;
    });
  }
  addTest('mouse-left-up', (v) => {
    options.trigger.mouse.left = v;
  });
  addTest('mouse-wheel', (v) => {
    options.trigger.mouse.wheel = v;
  });
  addTest(
    'key-up',
    (v) => {
      options.trigger.keyboard.space = v;
    },
    0x20,
    'key-space',
  );
  addTest(
    'key-up',
    (v) => {
      options.trigger.keyboard.enter = v;
    },
    0x0d,
    'key-space',
  );

  async function expectPause(value: boolean) {
    options.trigger.mouse.left = true;
    options.trigger.mouse.wheel = true;
    options.trigger.keyboard.space = true;
    options.trigger.keyboard.enter = true;
    ocrManager.flag = false;
    ocrManager.p = new Promise<void>((resolve) => {
      ocrManager.resolve = resolve;
    });
    hook.emit('mouse-left-up');
    hook.emit('mouse-wheel');
    hook.emit('key-up', 0x20);
    hook.emit('key-up', 0x0d);
    await Promise.race([
      ocrManager.p,
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }),
    ]);
    expect(ocrManager.flag).to.equal(value);
  }

  it('minimize-restore', async () => {
    hook.emit('window-minimize');
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    await expectPause(false);
    hook.emit('window-restore');
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    await expectPause(true);
  });

  it('pause-resume', async () => {
    ocrExtractor.pause();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    await expectPause(false);
    ocrExtractor.resume();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    await expectPause(true);
  });
});
