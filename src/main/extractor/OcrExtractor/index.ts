import logger from '@logger/extractor/OcrExtractor';
import { IExtractor } from '@main/extractor/IExtractor';
import { ScreenCapturer } from '@main/extractor/OcrExtractor//ScreenCapturer';
import { MovementDetector } from '@main/extractor/OcrExtractor/MovementDetector';
import type { OcrExtractorOptions } from '@main/extractor/OcrExtractor/options';
import type { Hook } from '@main/hook';
import { OcrManager } from '@main/manager/OcrManager';
import store from '@main/store';
import { TaskQueue } from '@main/utils';
import type sharp from 'sharp';

export interface PreprocessOption {
  color: 'colorful' | 'grey' | 'red' | 'green' | 'blue';
  threshold?: number;
}

export class OcrExtractor extends IExtractor {
  private lastImage?: sharp.Sharp;
  private lastCropImage?: sharp.Sharp;
  private windowVisible = true;
  private paused = false;
  private mouseLeftHookCallback: () => void;
  private mouseWheelHookCallback: () => void;
  private keyboardHookCallback: (code: number) => void;
  private minimizeHookCallback: () => void;
  private restoreHookCallback: () => void;
  private options: OcrExtractorOptions;
  private timeoutId?: ReturnType<typeof setTimeout>;
  private movementDetector?: MovementDetector;
  private optionsUnsubscribe?: () => void;

  public rect?: sharp.Region;
  public preprocessOption: PreprocessOption = {
    color: 'colorful',
  };

  public constructor(
    public gamePids: number[],
    public hook: Hook,
    private screenCapturer: ScreenCapturer = new ScreenCapturer(gamePids),
    private ocrManager: OcrManager = new OcrManager(),
  ) {
    super();
    this.options = store.get('ocrExtractor');
    this.optionsUnsubscribe = store.onDidChange('ocrExtractor', () => {
      this.options = store.get('ocrExtractor');
      this.screenCapturer?.destroy();
      this.setupMovementDetector();
    });

    this.mouseLeftHookCallback = () => {
      if (this.shouldCapture && this.options.trigger.mouse.left) {
        this.extractLatter();
      }
    };
    this.hook.on('mouse-left-up', this.mouseLeftHookCallback);
    this.mouseWheelHookCallback = () => {
      if (this.shouldCapture && this.options.trigger.mouse.wheel) {
        this.extractLatter();
      }
    };
    this.hook.on('mouse-wheel', this.mouseWheelHookCallback);
    this.keyboardHookCallback = (code: number) => {
      if (this.shouldCapture && this.shouldCaptureAtKeyboard(code)) {
        this.extractLatter();
      }
    };
    this.hook.on('key-up', this.keyboardHookCallback);

    this.minimizeHookCallback = () => {
      this.windowVisible = false;
      this.hook.unregister();
    };
    this.hook.on('window-minimize', this.minimizeHookCallback);
    this.restoreHookCallback = () => {
      this.windowVisible = true;
      if (this.shouldCapture) {
        this.hook.register();
      }
    };
    this.hook.on('window-restore', this.restoreHookCallback);

    this.hook.register();

    this.setupMovementDetector();
  }

  private setupMovementDetector() {
    if (this.options.trigger.movement.interval > 0) {
      this.movementDetector = new MovementDetector(
        this.screenCapturer,
        this.options.trigger.movement.threshold,
        this.options.trigger.movement.interval,
        async (img) => {
          img = await this.crop(img);
          img = await this.preprocess(img);
          return img;
        },
      );
      this.movementDetector.on('movement', () => {
        this.extract();
      });
    }
  }

  private get shouldCapture() {
    return this.windowVisible && !this.paused;
  }

  private shouldCaptureAtKeyboard(code: number) {
    if (code === 0x20 && this.options.trigger.keyboard.space) {
      return true;
    }
    if (code === 0x0d && this.options.trigger.keyboard.enter) {
      return true;
    }
    return false;
  }

  private extractLatter() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      logger('triggerRecognize');
      this.timeoutId = undefined;
      this.extract();
    }, this.options.delay);
  }

  private async extract() {
    this.lastImage = await this.screenCapturer.capture();
    this.lastCropImage = await this.crop(this.lastImage);
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

  private async crop(img: sharp.Sharp, rect = this.rect) {
    if (!rect) {
      return img.clone();
    }
    // NOTE: 我们把图像flip过，所以这里rect同样要反转
    const meta = await img.metadata();
    rect = {
      left: rect.left,
      width: rect.width,
      top: (meta?.height ?? 0) - rect.top - rect.height,
      height: rect.height,
    };
    return img.clone().extract(rect);
  }

  public preprocess(img: sharp.Sharp, option = this.preprocessOption) {
    if (option.color === 'grey') {
      img = img.clone().greyscale();
    } else if (['red', 'green', 'blue'].includes(option.color)) {
      img = img.clone().extractChannel(option.color as any);
    }
    if (option.threshold) {
      img = img.threshold(option.threshold, { greyscale: false });
    }
    return img;
  }

  public async getLastCapture(force = false): Promise<sharp.Sharp> {
    if (force || !this.lastImage) {
      this.lastImage = await this.screenCapturer.capture();
    }
    return this.lastImage;
  }

  public pause() {
    this.paused = true;
    this.hook.unregister();
  }

  public resume() {
    this.paused = false;
    if (this.shouldCapture) {
      this.hook.register();
    }
  }

  public destroy() {
    this.optionsUnsubscribe?.();
    this.optionsUnsubscribe = undefined;
    this.screenCapturer.destroy();
    this.lastImage = undefined;
    this.timeoutId && clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
    this.hook.off('mouse-left-up', this.mouseLeftHookCallback);
    this.hook.off('mouse-wheel', this.mouseWheelHookCallback);
    this.hook.off('key-up', this.keyboardHookCallback);
    this.hook.off('window-minimize', this.minimizeHookCallback);
    this.hook.off('window-restore', this.restoreHookCallback);
    this.hook.unregister();
    this.ocrManager.destroy();
    this.movementDetector?.destroy();
    this.movementDetector = undefined;
  }
}
