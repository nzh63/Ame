import type { BaseProviderConfig } from '@main/providers';
import type { SchemaType } from '@main/schema';

export type FindById<A, T extends BaseProviderConfig, N> = A extends readonly [infer S, ...infer R]
  ? S extends T
    ? S['id'] extends N
      ? S
      : FindById<R, T, N>
    : never
  : never;
export type ProvidersStore<T extends readonly BaseProviderConfig[]> = {
  [K in T[number]['id']]: SchemaType<FindById<T, T[number], K>['optionsSchema']>;
};
