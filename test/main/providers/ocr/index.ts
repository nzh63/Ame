import { providerSuite } from '..';
import { SimpleWindow } from '../../../SimpleWindow';
import { ScreenCapturer } from '@main/extractor/OcrExtractor/ScreenCapturer';
import type { OcrProviderConfig } from '@main/providers/OcrProvider';
import { OcrProvider } from '@main/providers/OcrProvider';
import type { SchemaType } from '@main/schema';
import { expect } from 'chai';
import { Suite, Test } from 'mocha';

const ocrProviderSuite = Suite.create(providerSuite, 'OcrProvider');
export function buildTest<C extends OcrProviderConfig<string, any, unknown, any>>(
  config: C,
  options: SchemaType<C['optionsSchema']>,
  skip = false,
) {
  const suite = Suite.create(ocrProviderSuite, config.id);
  let provider: OcrProvider;
  let screenCapturer: ScreenCapturer;
  let window: SimpleWindow;

  suite.beforeAll(async function () {
    this.timeout(60000);
    this.retries(3);
    window = new SimpleWindow();
    await window.whenReady();
    const width = 600;
    const height = 400;
    await window.run(
      `(function(){const { width, height } = screen.screenToDipRect(window, { x: 0, y: 0, width: ${width}, height: ${height} }); window.setSize(width, height);})()`,
    );
    await window.run(
      'window.webContents.executeJavaScript(`document.open();document.write(\'<div style="width:100%;height:100%;display:flex;align-items:center;align-content:center;justify-content:center;"><div><h2>私はガラスを食べられます。</h2><h2>それは私を傷つけません。</h2></div></div>\');document.close();`)',
    );
    screenCapturer = new ScreenCapturer(window.pids);
  });

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
        (await screenCapturer.capture()).extract({ left: 50, top: 100, width: 500, height: 200 }),
      );
      expect(result).to.be.a('string').and.not.to.be.empty;
      expect(result.trim()).to.match(/私はガラスを食べられます[\s\S]*それは私を傷つけません/);
    }),
  );

  suite.afterAll(async () => {
    provider?.destroy();
    await window.destroy();
    screenCapturer.destroy();
  });
  suite.pending = skip;
}
