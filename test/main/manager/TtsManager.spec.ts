import { TtsManager } from '@main/manager/TtsManager';
import { TtsProvider } from '@main/providers/TtsProvider';
import { expect } from 'chai';
import type { SinonSandbox } from 'sinon';
import { createSandbox } from 'sinon';

describe('TtsManager', () => {
  let ttsManager: TtsManager;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    if (ttsManager) {
      ttsManager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create a TtsManager instance', () => {
      ttsManager = new TtsManager();
      expect(ttsManager).to.be.instanceOf(TtsManager);
    });

    it('should initialize providers array', () => {
      ttsManager = new TtsManager();
      expect(ttsManager.providers).to.be.an('array');
    });

    it('should create instances of available tts providers', () => {
      ttsManager = new TtsManager();
      expect(ttsManager.providers.length).to.be.greaterThan(0);
      expect(ttsManager.providers.every((p) => p instanceof TtsProvider)).to.be.true;
    });
  });

  describe('speak', () => {
    beforeEach(() => {
      ttsManager = new TtsManager();
    });

    it('should call speak on the default provider when ready', async () => {
      const firstProvider = ttsManager.providers[0];
      ttsManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(true);
      const speakStub = sandbox.stub(firstProvider, 'speak').resolves();

      await ttsManager.speak('hello', 'original');
      expect(speakStub.calledOnceWith('hello', 'original')).to.be.true;
    });

    it('should not call speak when default provider is not ready', async () => {
      const firstProvider = ttsManager.providers[0];
      ttsManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(false);
      const speakStub = sandbox.stub(firstProvider, 'speak').resolves();

      await ttsManager.speak('hello', 'translate');
      expect(speakStub.called).to.be.false;
    });

    it('should not throw when no providers match default', async () => {
      ttsManager.providers = [];
      await ttsManager.speak('hello', 'original');
    });
  });

  describe('destroy', () => {
    it('should destroy all providers', () => {
      ttsManager = new TtsManager();
      ttsManager.destroy();
      expect(ttsManager.providers).to.deep.equal([]);
    });
  });
});
