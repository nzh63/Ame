import '../env';
import { TranslateProvider } from '@main/providers/TranslateProvider';
import type { TranslateProviderConfig } from '@main/providers/TranslateProvider';
import { expect } from 'chai';
import sinon from 'sinon';

function defineConfig(config: TranslateProviderConfig<string, any, unknown, any>) {
  return config;
}

describe('TranslateProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should have providersStoreKey "translateProviders"', () => {
    expect(TranslateProvider.providersStoreKey).to.equal('translateProviders');
  });

  it('should call config.translate and return result', async () => {
    const config = defineConfig({
      id: 'test-translate',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      translate: (text: string) => `translated: ${text}`,
    });

    const provider = new TranslateProvider(config, () => null);
    const result = await provider.translate('hello');
    expect(result).to.equal('translated: hello');
    provider.destroy();
  });

  it('should reject when config.translate throws', async () => {
    const config = defineConfig({
      id: 'test-translate-error',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      translate: () => {
        throw new Error('translate failed');
      },
    });

    const provider = new TranslateProvider(config, () => null);
    await expect(provider.translate('hello')).to.be.rejectedWith('translate failed');
    provider.destroy();
  });

  it('should support async translate', async () => {
    const config = defineConfig({
      id: 'test-async-translate',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      translate: async (text: string) => {
        await new Promise<void>((r) => {
          setTimeout(r, 10);
        });
        return `async: ${text}`;
      },
    });

    const provider = new TranslateProvider(config, () => null);
    const result = await provider.translate('world');
    expect(result).to.equal('async: world');
    provider.destroy();
  });

  it('should support generator translate', async () => {
    const config = defineConfig({
      id: 'test-gen-translate',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      translate: function* (text: string) {
        yield text[0];
        yield text.slice(1);
      },
    });

    const provider = new TranslateProvider(config, () => null);
    const result = await provider.translate('hi');
    // Generator is returned as-is
    expect(result).to.not.be.a('string');
    provider.destroy();
  });
});
