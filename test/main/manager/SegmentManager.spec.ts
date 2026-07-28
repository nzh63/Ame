import { SegmentManager } from '@main/manager/SegmentManager';
import { SegmentProvider } from '@main/providers/SegmentProvider';
import { expect } from 'chai';
import type { SinonSandbox } from 'sinon';
import { createSandbox } from 'sinon';

describe('SegmentManager', () => {
  let segmentManager: SegmentManager;
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    if (segmentManager) {
      segmentManager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create a SegmentManager instance', () => {
      segmentManager = new SegmentManager();
      expect(segmentManager).to.be.instanceOf(SegmentManager);
    });

    it('should initialize providers array', () => {
      segmentManager = new SegmentManager();
      expect(segmentManager.providers).to.be.an('array');
    });

    it('should create instances of available segment providers', () => {
      segmentManager = new SegmentManager();
      expect(segmentManager.providers.length).to.be.greaterThan(0);
      expect(segmentManager.providers.every((p) => p instanceof SegmentProvider)).to.be.true;
    });
  });

  describe('segment', () => {
    beforeEach(() => {
      segmentManager = new SegmentManager();
    });

    it('should call segment on the default provider when ready', async () => {
      const firstProvider = segmentManager.providers[0];
      segmentManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(true);
      const segmentStub = sandbox.stub(firstProvider, 'segment').resolves(['hello', 'world']);

      const result = await segmentManager.segment('hello world');
      expect(segmentStub.calledOnceWith('hello world')).to.be.true;
      expect(result).to.deep.equal([{ word: 'hello' }, { word: 'world' }]);
    });

    it('should convert SegmentWord results correctly', async () => {
      const firstProvider = segmentManager.providers[0];
      segmentManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(true);
      sandbox.stub(firstProvider, 'segment').resolves([{ word: 'test', extraInfo: 'noun' }]);

      const result = await segmentManager.segment('test');
      expect(result).to.deep.equal([{ word: 'test', extraInfo: 'noun' }]);
    });

    it('should return undefined when default provider is not ready', async () => {
      const firstProvider = segmentManager.providers[0];
      segmentManager.providers = [firstProvider];
      sandbox.stub(firstProvider, 'isReady').returns(false);

      const result = await segmentManager.segment('test');
      expect(result).to.be.undefined;
    });

    it('should return undefined when no providers match default', async () => {
      segmentManager.providers = [];
      const result = await segmentManager.segment('test');
      expect(result).to.be.undefined;
    });
  });

  describe('destroy', () => {
    it('should destroy all providers', () => {
      segmentManager = new SegmentManager();
      segmentManager.destroy();
      expect(segmentManager.providers).to.deep.equal([]);
    });
  });
});
