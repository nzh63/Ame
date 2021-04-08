/* eslint-disable no-unused-expressions */
import { BaseProvider, BaseProviderConfig } from '@main/providers/BaseProvider';
import { expect } from 'chai';

describe('BaseProvider', function() {
    const optionsSchema = { foo: String };
    const data = () => ({ bar: 'baz' });
    let provider: BaseProvider<'test', typeof optionsSchema, ReturnType<typeof data>>;
    let initSuccess = false;
    let isReadySuccess = false;
    let destroySuccess = false;
    function check(that: any) {
        let success = true;
        if (!that || !that.options || that.options.foo !== 'defaultValue') {
            success = false;
        }
        if (!that || !that.data || that.data.bar !== 'baz') {
            success = false;
        }
        return success;
    }
    before(async function() {
        const config: BaseProviderConfig<'test', typeof optionsSchema, ReturnType<typeof data>> = {
            providersStoreKey: 'test',
            id: 'test',
            optionsSchema,
            defaultOptions: { foo: 'defaultValue' },
            data,
            init() {
                if (check(this)) {
                    initSuccess = true;
                }
            },
            isReady() {
                if (check(this)) {
                    isReadySuccess = true;
                }
                return true;
            },
            destroy() {
                if (check(this)) {
                    destroySuccess = true;
                }
            }
        };
        provider = new BaseProvider<'test', typeof optionsSchema, ReturnType<typeof data>>(config);
    });

    it('init', async function() {
        expect(initSuccess).to.be.true;
    });

    it('isEnabled', async function() {
        provider.isReady();
        expect(isReadySuccess).to.be.true;
    });

    it('destroy', async function() {
        provider.destroy();
        expect(destroySuccess).to.be.true;
    });
});
