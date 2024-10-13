import { providerSuite } from '..';
import type { SegmentProviderConfig } from '@main/providers/SegmentProvider';
import { SegmentProvider } from '@main/providers/SegmentProvider';
import type { SchemaType } from '@main/schema';
import { expect } from 'chai';
import { Suite, Test } from 'mocha';

const segmentProviderSuite = Suite.create(providerSuite, 'SegmentProvider');
export function buildTest<C extends SegmentProviderConfig<string, any, unknown, any>>(
  config: C,
  options: SchemaType<C['optionsSchema']>,
  skip = false,
) {
  const suite = Suite.create(segmentProviderSuite, config.id);
  let provider: SegmentProvider;
  suite.addTest(
    new Test('init', async function (this: Mocha.Context) {
      this.timeout(20000);
      provider = new SegmentProvider(config, () => options);
      await provider.whenInitDone();
      expect(provider.isReady()).to.be.true;
    }),
  );

  suite.addTest(
    new Test('segment', async function (this: Mocha.Context) {
      this.timeout(20000);
      const result = await provider.segment('李さんは中国人です。');
      expect(result).to.be.instanceOf(Array);
      expect(result.length).to.be.greaterThan(0);
    }),
  );

  suite.afterAll(() => {
    provider.destroy();
  });
  suite.pending = skip;
}
