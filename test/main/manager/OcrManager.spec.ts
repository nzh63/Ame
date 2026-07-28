import { OcrManager } from '@main/manager/OcrManager';
import { OcrProvider } from '@main/providers/OcrProvider';
import { expect } from 'chai';
import type { SinonSandbox } from 'sinon';
import { createSandbox } from 'sinon';

describe('OcrManager', () => {
  let ocrManager: OcrManager;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    if (ocrManager) {
      ocrManager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create an OcrManager instance', () => {
      ocrManager = new OcrManager();
      expect(ocrManager).to.be.instanceOf(OcrManager);
    });

    it('should initialize providers array', () => {
      ocrManager = new OcrManager();
      expect(ocrManager.providers).to.be.an('array');
    });

    it('should create instances of available ocr providers', () => {
      ocrManager = new OcrManager();
      expect(ocrManager.providers.length).to.be.greaterThan(0);
      expect(ocrManager.providers.every((p) => p instanceof OcrProvider)).to.be.true;
    });
  });

  describe('recognize', () => {
    beforeEach(() => {
      ocrManager = new OcrManager();
    });

    it('should call recognize on ready providers and invoke callback with result', (done) => {
      const firstProvider = ocrManager.providers[0];
      ocrManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(true);
      sandbox.stub(firstProvider, 'recognize').resolves('recognized text');

      const fakeImg = {} as any;
      ocrManager.recognize(fakeImg, (err, res) => {
        expect(err).to.be.undefined;
        expect(res.providerId).to.equal(firstProvider.$id);
        expect(res.text).to.equal('recognized text');
        expect(res.img).to.equal(fakeImg);
        done();
      });
    });

    it('should skip providers that are not ready', () => {
      const firstProvider = ocrManager.providers[0];
      ocrManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(false);
      const recognizeStub = sandbox.stub(firstProvider, 'recognize').resolves('text');

      const callback = sandbox.spy();
      ocrManager.recognize({} as any, callback);
      expect(recognizeStub.called).to.be.false;
      expect(callback.called).to.be.false;
    });

    it('should invoke callback with error when recognize fails', (done) => {
      const firstProvider = ocrManager.providers[0];
      ocrManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(true);
      sandbox.stub(firstProvider, 'recognize').rejects(new Error('ocr failed'));

      ocrManager.recognize({} as any, (err, res) => {
        expect(err).to.be.instanceOf(Error);
        expect(res.text).to.equal('');
        done();
      });
    });

    it('should call recognize on all ready providers', () => {
      const providers = ocrManager.providers.slice(0, 2);
      ocrManager.providers = providers;
      providers.forEach((p) => {
        sandbox.stub(p, 'isReady').returns(true);
        sandbox.stub(p, 'recognize').resolves('text');
      });

      const callback = sandbox.spy();
      ocrManager.recognize({} as any, callback);

      providers.forEach((p) => {
        expect((p.recognize as any).calledOnce).to.be.true;
      });
    });
  });

  describe('destroy', () => {
    it('should destroy all providers', () => {
      ocrManager = new OcrManager();
      ocrManager.destroy();
      expect(ocrManager.providers).to.deep.equal([]);
    });
  });
});
