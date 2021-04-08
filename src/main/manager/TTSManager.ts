import { availableTTSConfigs, AvailableTTSConfigs } from '@main/providers/tts';
import { TTSProvider } from '@main/providers';
import { TTSManagerOptions } from '@main/manager/TTSManagerOptions';
import store from '@main/store';
import logger from '@logger/manager/tts';

export class TTSManager {
    public providers: TTSProvider<
        AvailableTTSConfigs[number]['id'],
        AvailableTTSConfigs[number]['optionsSchema'],
        ReturnType<AvailableTTSConfigs[number]['data']>
    >[] = [];

    protected options: TTSManagerOptions;

    private static instance: null | TTSManager = null;
    static getInstance() {
        if (!TTSManager.instance) TTSManager.instance = new TTSManager();
        return TTSManager.instance;
    }

    constructor() {
        this.setupProviders();
        store.onDidChange('ttsProviders', () => this.refreshProviders());
        this.options = store.get('ttsManager');
        store.onDidChange('ttsProviders', () => { this.options = store.get('ttsManager'); });
    }

    private setupProviders() {
        logger('setup providers');
        for (const config of availableTTSConfigs) {
            this.providers.push(new TTSProvider<
                AvailableTTSConfigs[number]['id'],
                AvailableTTSConfigs[number]['optionsSchema'],
                ReturnType<AvailableTTSConfigs[number]['data']>
            >(config));
        }
    }

    private destroyProviders() {
        logger('destroy providers');
        for (const provider of this.providers) {
            provider.destroy();
        }
        this.providers = [];
    }

    public refreshProviders() {
        logger('refresh providers');
        this.destroyProviders();
        this.setupProviders();
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
