import logger from '@logger/extractor/OcrExtractor/MovementDetector';
import type { ScreenCapturer } from '@main/extractor/OcrExtractor/ScreenCapturer';
import { TaskQueue } from '@main/utils';
import EventEmitter from 'events';
import type sharp from 'sharp';

export declare interface MovementDetector extends NodeJS.EventEmitter {
  on: (event: 'movement', listener: () => void) => this;
  once: (event: 'movement', listener: () => void) => this;
  off: (event: 'movement', listener: () => void) => this;
}

export class MovementDetector extends EventEmitter {
  private queue = new TaskQueue();
  private intervalId?: ReturnType<typeof setInterval>;
  private lastImage?: sharp.Sharp;

  public constructor(
    private screenCapturer: ScreenCapturer,
    private threshold: number,
    interval: number,
    private preprocess: (img: sharp.Sharp) => Promise<sharp.Sharp> | sharp.Sharp = (img) => img,
  ) {
    super();

    this.intervalId = setInterval(() => {
      this.queue
        .dispatch(() => this.detect())
        .catch((e) => {
          if (e === TaskQueue.Canceled) {
            logger('the previous task is still running');
          } else {
            logger('auto detect screen error: %O', e);
          }
        });
    }, interval);
  }

  public destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  private async detect() {
    const captured = await this.screenCapturer.capture();
    if (!this.lastImage) {
      this.lastImage = captured;
      return;
    }
    let last = (await this.preprocess(this.lastImage.clone())).greyscale();
    let now = (await this.preprocess(captured.clone())).greyscale();
    const lastRaw = await last.raw().toBuffer({ resolveWithObject: true });
    const nowRaw = await now.raw().toBuffer({ resolveWithObject: true });
    if (lastRaw.info.width !== nowRaw.info.width || lastRaw.info.height !== nowRaw.info.height) {
      this.lastImage = captured;
      return;
    }

    let sum = 0;
    for (let i = 0; i < lastRaw.data.length; i++) {
      sum += Math.abs(lastRaw.data[i] - nowRaw.data[i]);
    }
    const v = sum / (lastRaw.info.width * lastRaw.info.height * 255);
    if (v > this.threshold) {
      logger('movement detected: value=%f', v);
      this.lastImage = captured;
      this.emit('movement');
    }
  }
}
