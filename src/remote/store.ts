import logger from '@logger/store';
import { defineRemoteFunction } from '@remote/common';

export const storeGet = defineRemoteFunction(
  'store-get',
  async <K extends string>(event: any, key: K, defaultValue?: any) => {
    const { default: store } = await import('@main/store');
    return store.get(key, defaultValue);
  },
);

export const storeSet = defineRemoteFunction('store-set', async (event, key: string, value?: any) => {
  const { default: store } = await import('@main/store');
  return store.set(key, value);
});

export const storeHas = defineRemoteFunction('store-has', async (event, key: string) => {
  const { default: store } = await import('@main/store');
  return store.has(key);
});

export const storeReset = defineRemoteFunction('store-reset', async (event, ...keys: string[]) => {
  logger('reset %O', keys);
  const { default: store } = await import('@main/store');
  return store.reset(...(keys as any[]));
});

export const storeDelete = defineRemoteFunction('store-delete', async (event, key: string) => {
  logger('delete %s', key);
  const { default: store } = await import('@main/store');
  return store.delete(key as any);
});

export const storeClear = defineRemoteFunction('store-clear', async () => {
  logger('clear');
  const { default: store } = await import('@main/store');
  return store.clear();
});
