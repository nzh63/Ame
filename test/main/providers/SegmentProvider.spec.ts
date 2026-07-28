import '../env';
import { SegmentProvider } from '@main/providers/SegmentProvider';
import type { SegmentProviderConfig } from '@main/providers/SegmentProvider';
import { expect } from 'chai';
import sinon from 'sinon';

function defineConfig(config: SegmentProviderConfig<string, any, unknown, any>) {
  return config;
}

describe('SegmentProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should have providersStoreKey "segmentProviders"', () => {
    expect(SegmentProvider.providersStoreKey).to.equal('segmentProviders');
  });

  it('should call config.segment and return result', async () => {
    const config = defineConfig({
      id: 'test-segment',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      segment: (text: string) => text.split(''),
    });

    const provider = new SegmentProvider(config, () => null);
    const result = await provider.segment('abc');
    expect(result).to.deep.equal(['a', 'b', 'c']);
    provider.destroy();
  });

  it('should reject when config.segment throws', async () => {
    const config = defineConfig({
      id: 'test-segment-error',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      segment: () => {
        throw new Error('segment failed');
      },
    });

    const provider = new SegmentProvider(config, () => null);
    await expect(provider.segment('abc')).to.be.rejectedWith('segment failed');
    provider.destroy();
  });

  it('should support async segment', async () => {
    const config = defineConfig({
      id: 'test-async-segment',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      segment: async (text: string) => {
        await new Promise<void>((r) => {
          setTimeout(r, 10);
        });
        return [{ word: text, extraInfo: 'noun' }];
      },
    });

    const provider = new SegmentProvider(config, () => null);
    const result = await provider.segment('hello');
    expect(result).to.deep.equal([{ word: 'hello', extraInfo: 'noun' }]);
    provider.destroy();
  });
});
