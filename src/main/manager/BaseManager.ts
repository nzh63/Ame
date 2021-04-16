import { BaseProvider } from '@main/providers';
import store from '@main/store';
import logger from '@logger/manager/translate';

export class BaseManager<C extends { providersStoreKey: string }, P extends BaseProvider<string, any>> {
    public providers: P[] = [];

    constructor(
        private availableConfigs: readonly C[],
        private Class: new (arg: C) => P
    ) {
        this.setupProviders();
        store.onDidChange(availableConfigs[0].providersStoreKey as any, () => this.refreshProviders());
    }

    private setupProviders() {
        logger('setup providers');
        for (const config of this.availableConfigs) {
            this.providers.push(new this.Class(config));
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
}
