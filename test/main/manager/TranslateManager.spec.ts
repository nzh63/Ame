import { TranslateManager } from '@main/manager/TranslateManager';
import { TranslateProvider } from '@main/providers/TranslateProvider';
import { expect } from 'chai';
import type { SinonSandbox } from 'sinon';
import { createSandbox } from 'sinon';

describe('TranslateManager', () => {
  let translateManager: TranslateManager;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    if (translateManager) {
      translateManager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create a TranslateManager instance', () => {
      translateManager = new TranslateManager();
      expect(translateManager).to.be.instanceOf(TranslateManager);
    });

    it('should initialize providers array', () => {
      translateManager = new TranslateManager();
      expect(translateManager.providers).to.be.an('array');
    });

    it('should create instances of available translate providers', () => {
      translateManager = new TranslateManager();
      expect(translateManager.providers.length).to.be.greaterThan(0);
      expect(translateManager.providers.every((p) => p instanceof TranslateProvider)).to.be.true;
    });
  });

  describe('translate', () => {
    beforeEach(() => {
      translateManager = new TranslateManager();
    });

    it('should call translate on first ready provider with string result', function (done) {
      this.timeout(5000);
      const testText = 'Hello world';
      const expectedTranslation = '你好世界';
      const key = 'test-key';

      // Mock the first provider to be ready and return a string
      const firstProvider = translateManager.providers[0];
      translateManager.providers = [firstProvider];
      const isReadyStub = sandbox.stub(firstProvider, 'isReady').returns(true);
      const translateStub = sandbox.stub(firstProvider, 'translate').resolves(expectedTranslation);

      translateManager.translate(key, testText, (err, result) => {
        expect(err).to.be.undefined;
        expect(result).to.deep.equal({
          providerId: firstProvider.$id,
          key,
          originalText: testText,
          translateText: expectedTranslation,
        });
        expect(isReadyStub.called).to.be.true;
        expect(translateStub.calledOnceWith(testText)).to.be.true;
        done();
      });
    });

    it('should handle translation errors', function (done) {
      this.timeout(5000);
      const testText = 'Hello world';
      const error = new Error('Translation failed');
      const key = 'test-key';

      const firstProvider = translateManager.providers[0];
      translateManager.providers = [firstProvider];
      const isReadyStub = sandbox.stub(firstProvider, 'isReady').returns(true);
      const translateStub = sandbox.stub(firstProvider, 'translate').rejects(error);

      translateManager.translate(key, testText, (err, result) => {
        expect(err).to.deep.equal(error);
        expect(result).to.deep.equal({
          providerId: firstProvider.$id,
          key,
          originalText: testText,
          translateText: '',
        });
        expect(isReadyStub.called).to.be.true;
        expect(translateStub.calledOnceWith(testText)).to.be.true;
        done();
      });
    });

    it('should skip providers that are not ready', function (done) {
      this.timeout(5000);
      const testText = 'Hello world';
      const key = 'test-key';

      // Mock all providers except the last one to not be ready
      const providers = translateManager.providers;
      providers.slice(0, -1).forEach((provider) => {
        sandbox.stub(provider, 'isReady').returns(false);
      });

      const lastProvider = providers[providers.length - 1];
      const isReadyStub = sandbox.stub(lastProvider, 'isReady').returns(true);
      const translateStub = sandbox.stub(lastProvider, 'translate').resolves('Translation');

      translateManager.translate(key, testText, (err, result) => {
        expect(err).to.be.undefined;
        expect(result.providerId).to.equal(lastProvider.$id);
        expect(isReadyStub.called).to.be.true;
        expect(translateStub.calledOnceWith(testText)).to.be.true;
        done();
      });
    });

    it('should not call callback if no providers are ready', function (done) {
      this.timeout(5000);
      const testText = 'Hello world';
      const key = 'test-key';

      // Mock all providers to not be ready
      translateManager.providers.forEach((provider) => {
        sandbox.stub(provider, 'isReady').returns(false);
      });

      const callbackSpy = sandbox.spy();

      translateManager.translate(key, testText, callbackSpy);

      // Wait to ensure callback is not called
      setTimeout(() => {
        expect(callbackSpy.called).to.be.false;
        done();
      }, 100);
    });

    it('should handle async generator translation results', function (done) {
      this.timeout(5000);
      const testText = 'Hello world';
      const key = 'test-key';

      const firstProvider = translateManager.providers[0];
      sandbox.stub(firstProvider, 'isReady').returns(true);

      // Create an async generator that yields chunks
      async function* mockGenerator() {
        yield '你';
        yield '好';
        yield '世';
        yield '界';
      }

      const translateStub = sandbox.stub(firstProvider, 'translate').resolves(mockGenerator());

      const results: string[] = [];
      translateManager.translate(key, testText, (err, result) => {
        expect(err).to.be.undefined;
        results.push(result.translateText);

        if (result.translateText === '你好世界') {
          expect(results).to.deep.equal(['你', '你好', '你好世', '你好世界']);
          expect(translateStub.calledOnceWith(testText)).to.be.true;
          done();
        }
      });
    });
  });

  describe('BaseManager inherited functionality', () => {
    it('should have refreshProviders method inherited from BaseManager', () => {
      translateManager = new TranslateManager();
      expect(translateManager.refreshProviders).to.be.a('function');
    });

    it('should have destroy method inherited from BaseManager', () => {
      translateManager = new TranslateManager();
      expect(translateManager.destroy).to.be.a('function');
    });

    it('should refresh providers when requested', () => {
      translateManager = new TranslateManager();
      const initialProviderCount = translateManager.providers.length;

      translateManager.refreshProviders();

      expect(translateManager.providers.length).to.equal(initialProviderCount);
      expect(translateManager.providers.every((p) => p instanceof TranslateProvider)).to.be.true;
    });

    it('should destroy providers properly', () => {
      translateManager = new TranslateManager();

      const destroySpies = translateManager.providers.map((provider) => sandbox.spy(provider, 'destroy'));

      translateManager.destroy();

      destroySpies.forEach((spy) => expect(spy.calledOnce).to.be.true);
      expect(translateManager.providers.length).to.equal(0);
    });
  });
});
