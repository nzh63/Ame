import logger from '@logger/manager';
import type { BaseProvider } from '@main/providers';
import store from '@main/store';

export class BaseManager<P extends BaseProvider> {
  public providers: P[] = [];
  private unsubscribe?: () => void;

  public constructor(
    private availableConfigs: readonly P['$config'][],
    private Class: { readonly providersStoreKey: string; new (arg: P['$config']): P },
  ) {
    this.setupProviders();
    this.unsubscribe = store.onDidChange(Class.providersStoreKey as any, () => this.refreshProviders());
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
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
