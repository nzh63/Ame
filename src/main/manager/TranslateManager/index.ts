import type { TranslateProviderConfig } from '@main/providers/TranslateProvider';
import { availableTranslateConfigs, AvailableTranslateConfigs } from '@main/providers/translate';
import { TranslateProvider } from '@main/providers';
import { BaseManager } from '@main/manager/BaseManager';

export class TranslateManager extends BaseManager<
    TranslateProviderConfig<
        AvailableTranslateConfigs[number]['id'],
        AvailableTranslateConfigs[number]['optionsSchema'],
        ReturnType<AvailableTranslateConfigs[number]['data']>
    >,
    TranslateProvider<string>
> {
    private static instance: null | TranslateManager = null;
    static getInstance() {
        if (!TranslateManager.instance) TranslateManager.instance = new TranslateManager();
        return TranslateManager.instance;
    }

    constructor() {
        super(availableTranslateConfigs, TranslateProvider);
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
