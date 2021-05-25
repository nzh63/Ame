import { availableDictConfigs } from '@main/providers/Dict';
import { DictProvider } from '@main/providers';
import { DictManagerOptions } from '@main/manager/DictManager/options';
import { BaseManager } from '@main/manager/BaseManager';
import store from '@main/store';
import logger from '@logger/manager/Dict';

export class DictManager extends BaseManager<DictProvider> {
    protected options: DictManagerOptions;

    constructor() {
        super(availableDictConfigs, DictProvider);
        this.options = store.get('dictManager');
        store.onDidChange('dictManager', () => { this.options = store.get('dictManager'); });
    }

    public async query(text: string): Promise<void> {
        const defaultProvider = this.providers.find(i => i.$id === this.options.defaultProvider);
        if (defaultProvider && defaultProvider.isReady()) {
            return await defaultProvider.query(text);
        } else {
            logger('warning: defaultProvider not ready');
        }
    }
}
