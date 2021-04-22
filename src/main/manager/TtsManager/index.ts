import type { TtsProviderConfig } from '@main/providers/TtsProvider';
import { availableTtsConfigs, AvailableTtsConfigs } from '@main/providers/tts';
import { TtsProvider } from '@main/providers';
import { TtsManagerOptions } from '@main/manager/TtsManager/options';
import { BaseManager } from '@main/manager/BaseManager';
import store from '@main/store';
import logger from '@logger/manager/tts';

export class TtsManager extends BaseManager<
    TtsProviderConfig<
        AvailableTtsConfigs[number]['id'],
        AvailableTtsConfigs[number]['optionsSchema'],
        ReturnType<AvailableTtsConfigs[number]['data']>
    >,
    TtsProvider<string>
> {
    protected options: TtsManagerOptions;

    constructor() {
        super(availableTtsConfigs, TtsProvider);
        this.options = store.get('ttsManager');
        store.onDidChange('ttsProviders', () => { this.options = store.get('ttsManager'); });
    }

    public async speak(text: string, type: 'original' | 'translate'): Promise<void> {
        if (this.options.defaultProvider) {
            const defaultProvider = this.providers.find(i => i.id === this.options.defaultProvider);
            if (defaultProvider && defaultProvider.isReady()) {
                return await defaultProvider.speak(text, type);
            }
        }
        const enabledProviders = this.providers.filter(i => i.isReady());
        if (!enabledProviders.length) {
            logger('no enabled provider found, skip');
            return;
        }
        const randomProvider = enabledProviders[Math.floor(Math.random() * enabledProviders.length)];
        if (randomProvider) return await randomProvider.speak(text, type);
    }
}
