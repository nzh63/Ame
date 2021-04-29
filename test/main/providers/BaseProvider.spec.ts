/* eslint-disable no-unused-expressions */
import { BaseProvider, BaseProviderConfig } from '@main/providers/BaseProvider';
import { expect } from 'chai';

describe('BaseProvider', function() {
    const optionsSchema = { foo: String };
    const data = () => ({ bar: 'baz' });
    let provider: BaseProvider<'test', typeof optionsSchema, ReturnType<typeof data>, { check(bar?: string, foo?: string): boolean }>;
    let initSuccess = false;
    let isReadySuccess = false;
    let destroySuccess = false;

    before(async function() {
        const config: BaseProviderConfig<'test', typeof optionsSchema, ReturnType<typeof data>, { check(bar?: string, foo?: string): boolean }> = {
            providersStoreKey: 'test',
            id: 'test',
            optionsSchema,
            defaultOptions: { foo: 'defaultValue' },
            data,
            init() {
                if (this.check()) {
                    initSuccess = true;
                }
            },
            isReady() {
                if (this.check()) {
                    isReadySuccess = true;
                }
                return true;
            },
            destroy() {
                if (this.check()) {
                    destroySuccess = true;
                }
            },
            methods: {
                check(bar = 'baz', foo = 'defaultValue') {
                    let success = true;
                    if (this.bar !== bar || this.$data.bar !== bar) success = false;
                    if (this.foo !== foo || this.$options.foo !== foo) success = false;
                    return success;
                }
            }
        };
        provider = new BaseProvider(config);
    });

    it('init', async function() {
        expect(initSuccess).to.be.true;
    });

    it('isReady', async function() {
        provider.isReady();
        expect(isReadySuccess).to.be.true;
    });

    it('data', async function() {
        provider.$data.bar = 'baz-baz';
        expect(provider.$methods.check('baz-baz')).to.be.true;
        provider.$data.bar = 'baz';
        expect(provider.$methods.check()).to.be.true;
    });

    it('destroy', async function() {
        provider.destroy();
        expect(destroySuccess).to.be.true;
    });
});
