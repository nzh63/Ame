import '../env';
import { DictProvider } from '@main/providers/DictProvider';
import type { DictProviderConfig } from '@main/providers/DictProvider';
import { expect } from 'chai';
import sinon from 'sinon';

function defineConfig(config: DictProviderConfig<string, any, unknown, any>) {
  return config;
}

describe('DictProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should have providersStoreKey "dictProviders"', () => {
    expect(DictProvider.providersStoreKey).to.equal('dictProviders');
  });

  it('should call config.query with the word', async () => {
    const querySpy = sinon.spy((word: string) => undefined);
    const config = defineConfig({
      id: 'test-dict',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      query: querySpy,
    });

    const provider = new DictProvider(config, () => null);
    await provider.query('hello');
    expect(querySpy.calledOnceWith('hello')).to.be.true;
    provider.destroy();
  });

  it('should reject when config.query throws', async () => {
    const config = defineConfig({
      id: 'test-dict-error',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      query: () => {
        throw new Error('query failed');
      },
    });

    const provider = new DictProvider(config, () => null);
    await expect(provider.query('hello')).to.be.rejectedWith('query failed');
    provider.destroy();
  });

  it('should support async query', async () => {
    let queried = '';
    const config = defineConfig({
      id: 'test-async-dict',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      query: async (word: string) => {
        await new Promise<void>((r) => {
          setTimeout(r, 10);
        });
        queried = word;
      },
    });

    const provider = new DictProvider(config, () => null);
    await provider.query('world');
    expect(queried).to.equal('world');
    provider.destroy();
  });
});
