import { availableTtsConfigs } from '@main/providers/tts';
import { TtsProvider } from '@main/providers';
import { TtsManagerOptions } from '@main/manager/TtsManager/options';
import { BaseManager } from '@main/manager/BaseManager';
import store from '@main/store';
import logger from '@logger/manager/tts';

export class TtsManager extends BaseManager<TtsProvider> {
    protected options: TtsManagerOptions;

    constructor() {
        super(availableTtsConfigs, TtsProvider);
        this.options = store.get('ttsManager');
        store.onDidChange('ttsProviders', () => { this.options = store.get('ttsManager'); });
    }

    public async speak(text: string, type: 'original' | 'translate'): Promise<void> {
        const defaultProvider = this.providers.find(i => i.$id === this.options.defaultProvider);
        if (defaultProvider && defaultProvider.isReady()) {
            return await defaultProvider.speak(text, type);
        } else {
            logger('warning: defaultProvider not ready');
        }
    }
}
