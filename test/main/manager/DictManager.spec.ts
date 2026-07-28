import { DictManager } from '@main/manager/DictManager';
import { DictProvider } from '@main/providers/DictProvider';
import { expect } from 'chai';
import type { SinonSandbox } from 'sinon';
import { createSandbox } from 'sinon';

describe('DictManager', () => {
  let dictManager: DictManager;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    if (dictManager) {
      dictManager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create a DictManager instance', () => {
      dictManager = new DictManager();
      expect(dictManager).to.be.instanceOf(DictManager);
    });

    it('should initialize providers array', () => {
      dictManager = new DictManager();
      expect(dictManager.providers).to.be.an('array');
    });

    it('should create instances of available dict providers', () => {
      dictManager = new DictManager();
      expect(dictManager.providers.length).to.be.greaterThan(0);
      expect(dictManager.providers.every((p) => p instanceof DictProvider)).to.be.true;
    });
  });

  describe('query', () => {
    beforeEach(() => {
      dictManager = new DictManager();
    });

    it('should call query on the default provider when ready', async () => {
      const firstProvider = dictManager.providers[0];
      dictManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(true);
      const queryStub = sandbox.stub(firstProvider, 'query').resolves();

      await dictManager.query('test');
      expect(queryStub.calledOnceWith('test')).to.be.true;
    });

    it('should not call query when default provider is not ready', async () => {
      const firstProvider = dictManager.providers[0];
      dictManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(false);
      const queryStub = sandbox.stub(firstProvider, 'query').resolves();

      await dictManager.query('test');
      expect(queryStub.called).to.be.false;
    });

    it('should not throw when no providers match default', async () => {
      dictManager.providers = [];
      await dictManager.query('test');
    });
  });

  describe('destroy', () => {
    it('should destroy all providers', () => {
      dictManager = new DictManager();
      const providers = dictManager.providers;
      dictManager.destroy();
      expect(dictManager.providers).to.deep.equal([]);
    });
  });
});
