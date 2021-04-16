import type { TTSProviderConfig } from '@main/providers/TTSProvider';
import { availableTTSConfigs, AvailableTTSConfigs } from '@main/providers/tts';
import { TTSProvider } from '@main/providers';
import { TTSManagerOptions } from '@main/manager/TTSManager/options';
import { BaseManager } from '@main/manager/BaseManager';
import store from '@main/store';
import logger from '@logger/manager/tts';

export class TTSManager extends BaseManager<
    TTSProviderConfig<
        AvailableTTSConfigs[number]['id'],
        AvailableTTSConfigs[number]['optionsSchema'],
        ReturnType<AvailableTTSConfigs[number]['data']>
    >,
    TTSProvider<string>
> {
    protected options: TTSManagerOptions;

    private static instance: null | TTSManager = null;
    static getInstance() {
        if (!TTSManager.instance) TTSManager.instance = new TTSManager();
        return TTSManager.instance;
    }

    constructor() {
        super(availableTTSConfigs, TTSProvider);
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
