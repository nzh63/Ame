import logger from '@logger/manager/segment';
import { BaseManager } from '@main/manager/BaseManager';
import type { SegmentManagerOptions } from '@main/manager/SegmentManager/options';
import { SegmentProvider } from '@main/providers';
import type { SegmentWord } from '@main/providers/SegmentProvider';
import { availableSegmentConfigs } from '@main/providers/segment';
import store from '@main/store';

export class SegmentManager extends BaseManager<SegmentProvider> {
  protected options: SegmentManagerOptions;
  private optionsUnsubscribe?: () => void;

  public constructor() {
    super(availableSegmentConfigs, SegmentProvider);
    this.options = store.get('segmentManager');
    this.optionsUnsubscribe = store.onDidChange('segmentManager', () => {
      this.options = store.get('segmentManager');
    });
  }

  public async segment(text: string): Promise<SegmentWord[] | undefined> {
    const defaultProvider = this.providers.find((i) => i.$id === this.options.defaultProvider);
    if (defaultProvider && defaultProvider.isReady()) {
      return (await defaultProvider.segment(text)).map((i) => (typeof i === 'string' ? { word: i } : i));
    } else {
      logger('warning: defaultProvider not ready');
    }
  }

  public override destroy() {
    this.optionsUnsubscribe?.();
    this.optionsUnsubscribe = undefined;
    super.destroy();
  }
}
