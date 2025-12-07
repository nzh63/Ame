import { providerSuite } from '..';
// @ts-expect-error Test data import by rollup
import image from './testdata/image.png';
import type { OcrProviderConfig } from '@main/providers/OcrProvider';
import { OcrProvider } from '@main/providers/OcrProvider';
import type { SchemaType } from '@main/schema';
import { expect } from 'chai';
import { Suite, Test } from 'mocha';
import sharp from 'sharp';

const ocrProviderSuite = Suite.create(providerSuite, 'OcrProvider');
export function buildTest<C extends OcrProviderConfig<string, any, unknown, any>>(
  config: C,
  options: SchemaType<C['optionsSchema']>,
  skip = false,
) {
  const suite = Suite.create(ocrProviderSuite, config.id);
  let provider: OcrProvider;

  suite.addTest(
    new Test('init', async function (this: Mocha.Context) {
      this.timeout(20000);
      provider = new OcrProvider(config, () => options);
      await provider.whenInitDone();
      expect(provider.isReady()).to.be.true;
    }),
  );

  suite.addTest(
    new Test('recognize', async function (this: Mocha.Context) {
      this.timeout(20000);
      this.retries(3);
      const result = await provider.recognize(
        sharp(Buffer.from(image.replace('data:image/png;base64,', ''), 'base64')),
      );
      expect(result).to.be.a('string').and.not.to.be.empty;
      // 有的模型会混淆平假名和片假名  ┑(￣Д ￣)┍
      expect(result.trim()).to.match(/私はガラスを食[べベ]られます[\s\S]*それは私を傷つけません/);
    }),
  );

  suite.afterAll(async () => {
    provider?.destroy();
  });
  suite.pending = skip;
}
