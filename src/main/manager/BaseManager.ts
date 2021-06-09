import { BaseProvider } from '@main/providers';
import store from '@main/store';
import logger from '@logger/manager';

export class BaseManager<P extends BaseProvider> {
    public providers: P[] = [];

    constructor(
        private availableConfigs: readonly P['$config'][],
        private Class: { new(arg: P['$config']): P; readonly providersStoreKey: string; }
    ) {
        this.setupProviders();
        store.onDidChange(Class.providersStoreKey as any, () => this.refreshProviders());
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

    public destroy() {
        this.destroyProviders();
    }
}
