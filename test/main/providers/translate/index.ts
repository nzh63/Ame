/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import type { SchemaType } from '@main/schema';
import { TranslateProvider, TranslateProviderConfig } from '@main/providers/TranslateProvider';

export function buildTest<C extends TranslateProviderConfig<string, any, unknown, any>>(config: C, options: SchemaType<C['optionsSchema']>, skip = false) {
    describe('TranslateProvider', function() {
        (skip ? describe.skip : describe)(config.id, function() {
            let provider: TranslateProvider;
            it('init', async function() {
                this.timeout(20000);
                provider = new TranslateProvider(config, () => options);
                await provider.whenInitDone();
                expect(provider.isReady()).to.be.true;
            });
            it('translate', async function() {
                this.timeout(20000);
                const result = await provider.translate('こんにちは。');
                expect(result).to.be.a('string').and.not.to.be.empty;
            });
            this.afterAll(function() {
                provider.destroy();
            });
        });
    });
}
