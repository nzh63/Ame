import { availableTranslateConfigs, AvailableTranslateConfigs } from '@main/providers/translate';
import { TranslateProvider } from '@main/providers';
import store from '@main/store';
import logger from '@logger/manager/translate';

export class TranslateManager {
    private providers: TranslateProvider<
        AvailableTranslateConfigs[number]['id'],
        AvailableTranslateConfigs[number]['optionsSchema'],
        ReturnType<AvailableTranslateConfigs[number]['data']>
    >[] = [];

    private static instance: null | TranslateManager = null;
    static getInstance() {
        if (!TranslateManager.instance) TranslateManager.instance = new TranslateManager();
        return TranslateManager.instance;
    }

    constructor() {
        this.setupProviders();
        store.onDidChange('translateProviders', () => this.refreshProviders());
    }

    private setupProviders() {
        logger('setup providers');
        for (const config of availableTranslateConfigs) {
            this.providers.push(new TranslateProvider<
                AvailableTranslateConfigs[number]['id'],
                AvailableTranslateConfigs[number]['optionsSchema'],
                ReturnType<AvailableTranslateConfigs[number]['data']>
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

    public translate(key: string, originalText: string, callback: (err: any, res: Ame.Translator.TranslateResult) => void) {
        for (const provider of this.providers) {
            if (!provider.isReady()) continue;
            provider.translate(originalText)
                .then(translateText => callback(undefined, { providerId: provider.id, key, originalText, translateText }))
                .catch((e) => callback(e, { providerId: provider.id, key, originalText, translateText: '' }));
        }
    }
}
