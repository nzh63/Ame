import '../env';
import { TtsProvider } from '@main/providers/TtsProvider';
import type { TtsProviderConfig } from '@main/providers/TtsProvider';
import { expect } from 'chai';
import sinon from 'sinon';

function defineConfig(config: TtsProviderConfig<string, any, unknown, any>) {
  return config;
}

describe('TtsProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should have providersStoreKey "ttsProviders"', () => {
    expect(TtsProvider.providersStoreKey).to.equal('ttsProviders');
  });

  it('should call config.speak with text and type', async () => {
    const speakSpy = sinon.spy((text: string, type: 'original' | 'translate') => undefined);
    const config = defineConfig({
      id: 'test-tts',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      speak: speakSpy,
    });

    const provider = new TtsProvider(config, () => null);
    await provider.speak('hello', 'original');
    expect(speakSpy.calledOnceWith('hello', 'original')).to.be.true;
    provider.destroy();
  });

  it('should reject when config.speak throws', async () => {
    const config = defineConfig({
      id: 'test-tts-error',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      speak: () => {
        throw new Error('speak failed');
      },
    });

    const provider = new TtsProvider(config, () => null);
    await expect(provider.speak('hello', 'translate')).to.be.rejectedWith('speak failed');
    provider.destroy();
  });

  it('should support async speak', async () => {
    let spoken = '';
    const config = defineConfig({
      id: 'test-async-tts',
      optionsSchema: null,
      defaultOptions: null,
      data: () => undefined,
      speak: async (text: string) => {
        await new Promise<void>((r) => {
          setTimeout(r, 10);
        });
        spoken = text;
      },
    });

    const provider = new TtsProvider(config, () => null);
    await provider.speak('world', 'original');
    expect(spoken).to.equal('world');
    provider.destroy();
  });
});
