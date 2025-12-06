import logger from '@logger/manager/tts';
import { BaseManager } from '@main/manager/BaseManager';
import type { TtsManagerOptions } from '@main/manager/TtsManager/options';
import { TtsProvider } from '@main/providers';
import { availableTtsConfigs } from '@main/providers/tts';
import store from '@main/store';

export class TtsManager extends BaseManager<TtsProvider> {
  protected options: TtsManagerOptions;
  private optionsUnsubscribe?: () => void;

  public constructor() {
    super(availableTtsConfigs, TtsProvider);
    this.options = store.get('ttsManager');
    this.optionsUnsubscribe = store.onDidChange('ttsProviders', () => {
      this.options = store.get('ttsManager');
    });
  }

  public async speak(text: string, type: 'original' | 'translate'): Promise<void> {
    const defaultProvider = this.providers.find((i) => i.$id === this.options.defaultProvider);
    if (defaultProvider && defaultProvider.isReady()) {
      return await defaultProvider.speak(text, type);
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
