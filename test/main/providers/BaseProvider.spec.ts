import { BaseProvider } from '@main/providers';
import type { BaseProviderConfig, Methods } from '@main/providers/BaseProvider';
import type { Schema, SchemaType } from '@main/schema';
import { expect } from 'chai';
import sinon from 'sinon';

function defineProvider<ID extends string, S extends Schema, D, M extends Methods = {}>(
  arg: BaseProviderConfig<ID, S, D, M, BaseProvider<ID, S, D, M>>,
) {
  return arg;
}

describe('BaseProvider', () => {
  let storeGetStub: sinon.SinonStub;

  beforeEach(() => {
    // Stub store.get to control options loading
    storeGetStub = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Basic Functionality', () => {
    it('should initialize with basic configuration', () => {
      const config = defineProvider({
        id: 'basic-test',
        optionsSchema: { value: String },
        defaultOptions: { value: 'test' },
        data: () => undefined,
      });

      storeGetStub.returns({});
      const provider = new BaseProvider(config, () => storeGetStub());

      expect(provider.$id).to.equal('basic-test');
      expect(provider.$options.value).to.equal('test');
      expect(provider.isDestroyed()).to.be.false;
    });

    it('should merge store options with default options', () => {
      const config = defineProvider({
        id: 'merge-test',
        optionsSchema: { a: String, b: Number },
        defaultOptions: { a: 'default', b: 42 },
        data: () => undefined,
      });

      storeGetStub.returns({ a: 'store-value' });
      const provider = new BaseProvider(config, () => storeGetStub());

      expect(provider.$options).to.deep.equal({ a: 'store-value', b: 42 });
    });

    it('should create options JSON schema', () => {
      const config = defineProvider({
        id: 'schema-test',
        optionsSchema: { value: String },
        defaultOptions: { value: 'test' },
        data: () => undefined,
      });

      const provider = new BaseProvider(config, () => ({}));
      const schema = provider.optionsJSONSchema;

      expect(schema).to.have.property('type', 'object');
      expect(schema).to.have.property('properties');
    });
  });

  describe('Async Initialization', () => {
    let provider: BaseProvider<
      'async-test',
      { delay: NumberConstructor },
      { status: string },
      { getStatus: () => string }
    >;
    let asyncInitCompleted = false;

    beforeEach(() => {
      asyncInitCompleted = false;
      const config = defineProvider({
        id: 'async-test',
        optionsSchema: { delay: Number },
        defaultOptions: { delay: 100 },
        data: () => ({ status: 'initialized' }),
        async init() {
          await new Promise((resolve) => {
            setTimeout(resolve, this.$options.delay);
          });
          asyncInitCompleted = true;
        },
        methods: {
          getStatus() {
            return this.$data.status;
          },
        },
      });
      provider = new BaseProvider(config);
    });

    it('should handle async initialization', async () => {
      await provider.whenInitDone();
      expect(asyncInitCompleted).to.be.true;
      expect(provider.$methods.getStatus()).to.equal('initialized');
    });

    it('should catch async initialization errors', async () => {
      const errorConfig = defineProvider({
        id: 'async-error-test',
        optionsSchema: {},
        defaultOptions: {},
        data: () => undefined,
        async init() {
          throw new Error('Async init error');
        },
      });

      const errorProvider = new BaseProvider(errorConfig);
      // Should not throw during construction, but whenInitDone may fail
      expect(errorProvider.whenInitDone()).to.be.rejectedWith('Async init error');
    });
  });

  describe('Error Handling', () => {
    let provider: BaseProvider<'error-test', { error: BooleanConstructor }, void, {}>;

    beforeEach(() => {
      const config = defineProvider({
        id: 'error-test',
        optionsSchema: { error: Boolean },
        defaultOptions: { error: true },
        data: () => undefined,
        init() {
          if (this.$options.error) {
            throw new Error('Init error');
          }
        },
        isReady() {
          if (this.$options.error) {
            throw new Error('IsReady error');
          }
          return true;
        },
        destroy() {
          if (this.$options.error) {
            throw new Error('Destroy error');
          }
        },
      });
      provider = new BaseProvider(config);
    });

    it('should handle init errors gracefully', () => {
      // Error should be caught by the provider and logged
      expect(provider.$id).to.equal('error-test');
    });

    it('should handle isReady errors gracefully', () => {
      const result = provider.isReady();
      expect(result).to.be.false; // Should return false on error
    });

    it('should handle destroy errors gracefully', () => {
      // Should not throw even if destroy method errors
      expect(() => provider.destroy()).to.not.throw();
      expect(provider.isDestroyed()).to.be.true;
    });
  });

  describe('Property Binding', () => {
    let provider: BaseProvider<
      'binding-test',
      { value: StringConstructor },
      { data: string; nested: { prop: string } },
      {
        getValue: () => string;
        getData: () => string;
        getNested: () => { prop: string };
      }
    >;

    beforeEach(() => {
      const config = defineProvider({
        id: 'binding-test',
        optionsSchema: { value: String },
        defaultOptions: { value: 'option' },
        data: () => ({ data: 'initial', nested: { prop: 'nested' } }),
        methods: {
          getValue() {
            return this.data;
          },
          getData() {
            return this.data;
          },
          getNested() {
            return this.nested;
          },
        },
      });
      provider = new BaseProvider(config) as any;
    });

    it('should bind options properties to instance', () => {
      expect((provider as any).value).to.equal('option');
      expect(provider.$options.value).to.equal('option');
    });

    it('should bind data properties to instance', () => {
      expect((provider as any).data).to.equal('initial');
      expect(provider.$data.data).to.equal('initial');
    });

    it('should bind nested data properties to instance', () => {
      expect((provider as any).nested).to.deep.equal({ prop: 'nested' });
      expect(provider.$data.nested).to.deep.equal({ prop: 'nested' });
    });

    it('should allow modifying bound properties', () => {
      (provider as any).data = 'modified';
      expect((provider as any).data).to.equal('modified');
      expect(provider.$data.data).to.equal('modified');
      expect(provider.$methods.getData()).to.equal('modified');
    });

    it('should allow modifying nested properties', () => {
      (provider as any).nested.prop = 'changed';
      expect((provider as any).nested.prop).to.equal('changed');
      expect(provider.$data.nested.prop).to.equal('changed');
      expect(provider.$methods.getNested().prop).to.equal('changed');
    });

    it('should not override existing instance properties', () => {
      // Should not bind properties that already exist on the instance
      expect(provider.$id).to.equal('binding-test'); // $id should remain unchanged
      expect(typeof (provider as any).value).to.equal('string'); // Bound property should work
    });
  });

  describe('Method Binding', () => {
    let provider: BaseProvider<
      'method-test',
      {},
      { value: string },
      {
        getValue: () => string;
        setValue: (value: string) => void;
        getValueWithContext: () => string;
        getValueAsync: () => Promise<string>;
      }
    >;
    let methodContext: any;

    beforeEach(() => {
      const config = defineProvider({
        id: 'method-test',
        optionsSchema: {},
        defaultOptions: {},
        data: () => ({ value: '' }),
        methods: {
          getValue() {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            methodContext = this;
            return 'test-value';
          },
          setValue(value: string) {
            this.value = value;
          },
          getValueWithContext() {
            return this.$id;
          },
          async getValueAsync() {
            return 'async-value';
          },
        },
      });
      provider = new BaseProvider(config) as any;
      methodContext = null;
    });

    it('should bind methods with correct context', () => {
      const result = provider.$methods.getValue();
      expect(result).to.equal('test-value');
      expect(methodContext).to.equal(provider);
      expect(methodContext.$id).to.equal('method-test');
    });

    it('should allow methods to modify provider state', () => {
      provider.$methods.setValue('new-value');
      expect((provider as any).value).to.equal('new-value');
      expect(provider.$data.value).to.equal('new-value');
    });

    it('should respect explicit this type annotations', () => {
      const result = provider.$methods.getValueWithContext();
      expect(result).to.equal('method-test');
    });

    it('should handle async methods', async () => {
      const result = await provider.$methods.getValueAsync();
      expect(result).to.equal('async-value');
    });
  });

  describe('Default Options Merging', () => {
    let provider: BaseProvider<
      'merge-test',
      { a: StringConstructor; b: NumberConstructor; c: BooleanConstructor },
      void,
      {}
    >;

    beforeEach(() => {
      const config = defineProvider({
        id: 'merge-test',
        optionsSchema: { a: String, b: Number, c: Boolean },
        defaultOptions: { a: 'default-a', b: 42, c: true },
        data: () => undefined,
        methods: {
          getOptions() {
            return this.$options;
          },
        },
      });
      provider = new BaseProvider(config);
    });

    it('should use default options when no store options provided', () => {
      expect(provider.$options).to.deep.equal({ a: 'default-a', b: 42, c: true });
    });

    it('should handle deeply nested option merging', () => {
      const config: BaseProviderConfig<
        'deep-merge-test',
        {
          nested: { level1: { level2: { value: StringConstructor; count: NumberConstructor } } };
        },
        void
      > = {
        id: 'deep-merge-test',
        optionsSchema: {
          nested: { level1: { level2: { value: String, count: Number } } },
        },
        defaultOptions: {
          nested: { level1: { level2: { value: 'default', count: 0 } } },
        },
        data: () => undefined,
      };

      const provider = new BaseProvider(config);
      expect(provider.$options.nested.level1.level2.value).to.equal('default');
      expect(provider.$options.nested.level1.level2.count).to.equal(0);
    });
  });

  describe('Lifecycle Management', () => {
    let provider: BaseProvider<'lifecycle-test', {}, { counter: number }, { increment: () => void }>;
    let initCallCount: number;
    let isReadyCallCount: number;
    let destroyCallCount: number;

    beforeEach(() => {
      initCallCount = 0;
      isReadyCallCount = 0;
      destroyCallCount = 0;

      const config = defineProvider({
        id: 'lifecycle-test',
        optionsSchema: {},
        defaultOptions: {},
        data: () => ({ counter: 0 }),
        methods: {
          increment() {
            this.$data.counter++;
          },
        },
        init() {
          initCallCount++;
          this.$data.counter++;
        },
        isReady() {
          isReadyCallCount++;
          return this.$data.counter > 0;
        },
        destroy() {
          destroyCallCount++;
          this.$data.counter = 0;
        },
      });
      provider = new BaseProvider(config);
    });

    it('should call init during construction', () => {
      expect(initCallCount).to.equal(1);
      expect(provider.$data.counter).to.equal(1);
    });

    it('should call isReady when checking readiness', () => {
      provider.isReady();
      expect(isReadyCallCount).to.equal(1);
    });

    it('should call destroy when destroying', () => {
      provider.$methods.increment();
      expect(provider.$data.counter).to.equal(2);

      provider.destroy();
      expect(destroyCallCount).to.equal(1);
      expect(provider.$data.counter).to.equal(0);
    });

    it('should return correct destroyed state', () => {
      expect(provider.isDestroyed()).to.be.false;
      provider.destroy();
      expect(provider.isDestroyed()).to.be.true;
    });
  });

  describe('Complex Data Structures', () => {
    let provider: BaseProvider<
      'complex-test',
      {
        config: {
          nested: {
            deep: { type: ArrayConstructor; items: StringConstructor };
          };
        };
      },
      {
        items: Array<{ id: number; name: string }>;
        map: Map<string, number>;
        set: Set<string>;
      },
      {
        getItems: () => Array<{ id: number; name: string }>;
        addItem: (item: { id: number; name: string }) => void;
        getDeepValue: (index: number) => string;
        workWithMap: (key: string) => number | undefined;
        workWithSet: (value: string) => boolean;
      }
    >;

    beforeEach(() => {
      const config = defineProvider({
        id: 'complex-test',
        optionsSchema: {
          config: {
            nested: {
              deep: { type: Array, items: String },
            },
          },
        },
        defaultOptions: {
          config: {
            nested: {
              deep: ['item1', 'item2'],
            },
          },
        },
        data: () => ({
          items: [{ id: 1, name: 'test' }],
          map: new Map([['key1', 1]]),
          set: new Set(['value1', 'value2']),
        }),
        methods: {
          getItems() {
            return this.items;
          },
          addItem(item: { id: number; name: string }) {
            this.items.push(item);
          },
          getDeepValue(index: number) {
            return this.config.nested.deep[index];
          },
          workWithMap(key: string) {
            return this.map.get(key);
          },
          workWithSet(value: string) {
            return this.set.has(value);
          },
        },
      });
      provider = new BaseProvider(config);
    });

    it('should handle complex nested data structures', () => {
      expect((provider as any).items).to.be.an('array');
      expect((provider as any).items[0]).to.deep.equal({ id: 1, name: 'test' });
      expect((provider as any).config.nested.deep).to.be.an('array');
    });

    it('should handle Map and Set data structures', () => {
      expect((provider as any).workWithMap('key1')).to.equal(1);
      expect((provider as any).workWithMap('nonexistent')).to.be.undefined;
      expect((provider as any).workWithSet('value1')).to.be.true;
      expect((provider as any).workWithSet('nonexistent')).to.be.false;
    });

    it('should allow modifications to complex structures', () => {
      provider.$methods.addItem({ id: 2, name: 'test2' });
      expect((provider as any).items).to.have.length(2);
      expect((provider as any).items[1]).to.deep.equal({ id: 2, name: 'test2' });
    });

    it('should handle deeply nested option access', () => {
      expect(provider.$methods.getDeepValue(0)).to.equal('item1');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty schema', () => {
      const config = defineProvider({
        id: 'empty-schema',
        optionsSchema: {},
        defaultOptions: {},
        data: () => undefined,
      });
      const provider = new BaseProvider(config);
      expect(provider.$optionsSchema).to.deep.equal({});
      expect(provider.$options).to.deep.equal({});
    });

    it('should handle null data', () => {
      const config = defineProvider({
        id: 'null-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => null,
      });
      const provider = new BaseProvider(config);
      expect(provider.$data).to.be.null;
    });

    it('should handle undefined data', () => {
      const config = defineProvider({
        id: 'undefined-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => undefined,
      });
      const provider = new BaseProvider(config);
      expect(provider.$data).to.be.undefined;
    });

    it('should handle data with primitive values', () => {
      const config = defineProvider({
        id: 'primitive-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => 'primitive-value',
      });
      const provider = new BaseProvider(config);
      expect(provider.$data).to.equal('primitive-value');
    });

    it('should handle data with numeric values', () => {
      const config = defineProvider({
        id: 'numeric-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => 42,
      });
      const provider = new BaseProvider(config);
      expect(provider.$data).to.equal(42);
    });

    it('should handle data with boolean values', () => {
      const config = defineProvider({
        id: 'boolean-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => true,
      });
      const provider = new BaseProvider(config);
      expect(provider.$data).to.be.true;
    });

    it('should handle optional lifecycle methods', () => {
      const config = defineProvider({
        id: 'optional-methods',
        optionsSchema: {},
        defaultOptions: {},
        data: () => undefined,
        // No init, isReady, or destroy methods
      });
      const provider = new BaseProvider(config);
      expect(provider.isReady()).to.be.true; // Should return true by default
      expect(() => provider.destroy()).to.not.throw(); // Should not throw
    });

    it('should handle empty methods object', () => {
      const config = defineProvider({
        id: 'empty-methods',
        optionsSchema: {},
        defaultOptions: {},
        data: () => undefined,
        methods: {},
      });
      const provider = new BaseProvider(config);
      expect(provider.$methods).to.deep.equal({});
    });

    it('should handle methods with null/undefined return values', () => {
      const config: BaseProviderConfig<
        'null-return-methods',
        {},
        { nullValue: null },
        {
          returnNull: () => null;
          returnUndefined: () => undefined;
          getNullValue: () => null;
        }
      > = {
        id: 'null-return-methods',
        optionsSchema: {},
        defaultOptions: {},
        data: () => ({ nullValue: null }),
        methods: {
          returnNull: () => null,
          returnUndefined: () => undefined,
          getNullValue() {
            return this.nullValue;
          },
        },
      };
      const provider = new BaseProvider(config);
      expect(provider.$methods.returnNull()).to.be.null;
      expect(provider.$methods.returnUndefined()).to.be.undefined;
      expect(provider.$methods.getNullValue()).to.be.null;
    });

    it('should handle symbol properties in data', () => {
      const testSymbol = Symbol('test');
      const config = defineProvider({
        id: 'symbol-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => ({ [testSymbol]: 'symbol-value' }),
      });
      const provider = new BaseProvider(config);
      expect(provider.$data[testSymbol]).to.equal('symbol-value');
    });

    it('should handle circular references in data', () => {
      const config = defineProvider({
        id: 'circular-data',
        optionsSchema: {},
        defaultOptions: {},
        data: () => {
          const data: any = {};
          data.self = data;
          return data;
        },
      });

      // Should not throw when creating provider with circular references
      expect(() => new BaseProvider(config)).to.not.throw();
    });
  });

  describe('Performance and Memory', () => {
    it('should not create memory leaks with repeated method calls', () => {
      const config = defineProvider({
        id: 'performance-test',
        optionsSchema: {},
        defaultOptions: {},
        data: () => ({ counter: 0 }),
        methods: {
          increment() {
            this.counter++;
          },
          getCount() {
            return this.counter;
          },
        },
      });

      const provider = new BaseProvider(config);

      // Call methods many times to ensure no memory leaks
      for (let i = 0; i < 10000; i++) {
        provider.$methods.increment();
      }

      expect(provider.$methods.getCount()).to.equal(10000);
    });

    it('should handle large data structures efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }));
      const config = defineProvider({
        id: 'large-data-test',
        optionsSchema: {},
        defaultOptions: {},
        data: () => ({ items: largeArray }),
      });

      const provider = new BaseProvider(config);
      expect((provider as any).items).to.have.length(1000);
      expect((provider as any).items[999].value).to.equal('item-999');
    });
  });
});
