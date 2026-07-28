import '../env';
import { OcrProvider } from '@main/providers/OcrProvider';
import type { OcrProviderConfig } from '@main/providers/OcrProvider';
import { expect } from 'chai';
import sinon from 'sinon';

function defineConfig(config: OcrProviderConfig<string, any, unknown, any>) {
  return config;
}

describe('OcrProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should have providersStoreKey "ocrProviders"', () => {
    expect(OcrProvider.providersStoreKey).to.equal('ocrProviders');
  });

  it('should call config.recognize and return result', async () => {
    const config = defineConfig({
      id: 'test-ocr',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      recognize: () => 'recognized text',
    });

    const provider = new OcrProvider(config, () => null);
    // Pass a fake Sharp object since we only test the wrapper logic
    const result = await provider.recognize({} as any);
    expect(result).to.equal('recognized text');
    provider.destroy();
  });

  it('should reject when config.recognize throws', async () => {
    const config = defineConfig({
      id: 'test-ocr-error',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      recognize: () => {
        throw new Error('recognize failed');
      },
    });

    const provider = new OcrProvider(config, () => null);
    await expect(provider.recognize({} as any)).to.be.rejectedWith('recognize failed');
    provider.destroy();
  });

  it('should support async recognize', async () => {
    const config = defineConfig({
      id: 'test-async-ocr',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      recognize: async () => {
        await new Promise<void>((r) => {
          setTimeout(r, 10);
        });
        return 'async recognized';
      },
    });

    const provider = new OcrProvider(config, () => null);
    const result = await provider.recognize({} as any);
    expect(result).to.equal('async recognized');
    provider.destroy();
  });
});
