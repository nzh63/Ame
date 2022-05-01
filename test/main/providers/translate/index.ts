/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import type { SchemaType } from '@main/schema';
import { TranslateProvider, TranslateProviderConfig } from '@main/providers/TranslateProvider';
import { Suite, Test } from 'mocha';
import { providerSuite } from '..';

const translateProviderSuite = Suite.create(providerSuite, 'TranslateProvider');
export function buildTest<C extends TranslateProviderConfig<string, any, unknown, any>>(config: C, options: SchemaType<C['optionsSchema']>, skip = false) {
    const suite = Suite.create(translateProviderSuite, config.id);
    let provider: TranslateProvider;
    suite.addTest(new Test('init', async function(this: Mocha.Context) {
        this.timeout(20000);
        provider = new TranslateProvider(config, () => options);
        await provider.whenInitDone();
        expect(provider.isReady()).to.be.true;
    }));

    suite.addTest(new Test('translate', async function(this: Mocha.Context) {
        this.timeout(60000);
        const result = await provider.translate('こんにちは。');
        expect(result).to.be.a('string').and.not.to.be.empty;
        expect(result).to.match(/[你您]好[.。!！]?/);
    }));

    suite.afterAll(function() {
        provider.destroy();
    });
    suite.pending = skip;
}
