import { providerSuite } from '..';
import type { TranslateProviderConfig } from '@main/providers/TranslateProvider';
import { TranslateProvider } from '@main/providers/TranslateProvider';
import type { SchemaType } from '@main/schema';
import { expect } from 'chai';
import { Suite, Test } from 'mocha';

const translateProviderSuite = Suite.create(providerSuite, 'TranslateProvider');
export function buildTest<C extends TranslateProviderConfig<string, any, unknown, any>>(
  config: C,
  options: SchemaType<C['optionsSchema']>,
  skip = false,
) {
  const suite = Suite.create(translateProviderSuite, config.id);
  let provider: TranslateProvider;
  suite.addTest(
    new Test('init', async function (this: Mocha.Context) {
      this.timeout(20000);
      provider = new TranslateProvider(config, () => options);
      await provider.whenInitDone();
      expect(provider.isReady()).to.be.true;
    }),
  );

  suite.addTest(
    new Test('translate', async function (this: Mocha.Context) {
      this.timeout(60000);
      const cases = [
        {
          from: 'こんにちは。',
          to: /[你您]好[.。!！]?/,
        },
        {
          from: 'またね。',
          to: /再见[.。!！]?/,
        },
      ];
      for (const { from, to } of cases) {
        let result = await provider.translate(from);
        if (typeof result !== 'string') {
          const chunks = [];
          for await (const chunk of result) {
            chunks.push(chunk);
          }
          result = chunks.join('');
        }
        expect(result).to.be.a('string').and.not.to.be.empty;
        expect(result).to.match(to);
      }
    }),
  );

  suite.afterAll(() => {
    provider.destroy();
  });
  suite.pending = skip;
}
