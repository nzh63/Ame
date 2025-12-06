import logger from '@logger/manager/Dict';
import { BaseManager } from '@main/manager/BaseManager';
import type { DictManagerOptions } from '@main/manager/DictManager/options';
import { DictProvider } from '@main/providers';
import { availableDictConfigs } from '@main/providers/dict';
import store from '@main/store';

export class DictManager extends BaseManager<DictProvider> {
  protected options: DictManagerOptions;
  private optionsUnsubscribe?: () => void;

  public constructor() {
    super(availableDictConfigs, DictProvider);
    this.options = store.get('dictManager');
    this.optionsUnsubscribe = store.onDidChange('dictManager', () => {
      this.options = store.get('dictManager');
    });
  }

  public async query(text: string): Promise<void> {
    const defaultProvider = this.providers.find((i) => i.$id === this.options.defaultProvider);
    if (defaultProvider && defaultProvider.isReady()) {
      return await defaultProvider.query(text);
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
