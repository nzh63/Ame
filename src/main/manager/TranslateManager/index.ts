import { availableTranslateConfigs } from '@main/providers/translate';
import { TranslateProvider } from '@main/providers';
import { BaseManager } from '@main/manager/BaseManager';

export class TranslateManager extends BaseManager<TranslateProvider> {
    constructor() {
        super(availableTranslateConfigs, TranslateProvider);
    }

    public translate(key: string, originalText: string, callback: (err: any, res: Ame.Translator.TranslateResult) => void) {
        for (const provider of this.providers) {
            if (!provider.isReady()) continue;
            provider.translate(originalText)
                .then(async output => {
                    if (typeof output === 'string') {
                        callback(undefined, { providerId: provider.$id, key, originalText, translateText: output });
                    } else {
                        let text = '';
                        for await (const chunk of output) {
                            text += chunk;
                            callback(undefined, { providerId: provider.$id, key, originalText, translateText: text });
                        }
                    }
                })
                .catch((e) => callback(e, { providerId: provider.$id, key, originalText, translateText: '' }));
        }
    }
}
