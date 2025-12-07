import type { SchemaType } from '@main/schema';
import { toJSONSchema } from '@main/schema';
import Ajv from 'ajv';
import { expect } from 'chai';

describe('Schema', () => {
  let ajv: Ajv;

  before(() => {
    ajv = new Ajv();
  });

  after(() => {});

  describe('Basic Types', () => {
    it('null', () => {
      const schema = null;
      const value: SchemaType<typeof schema> = null;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate(1)).to.be.false;
      expect(validate('foo')).to.be.false;
      expect(validate(undefined)).to.be.false;
    });

    it('boolean', () => {
      const schema = Boolean;
      const value: SchemaType<typeof schema> = true;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate(false)).to.be.true;
      expect(validate(1)).to.be.false;
      expect(validate('foo')).to.be.false;
      expect(validate(null)).to.be.false;
    });

    it('boolean: true', () => {
      const schema = true;
      const value: SchemaType<typeof schema> = true;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate(false)).to.be.false;
      expect(validate(1)).to.be.false;
      expect(validate('true')).to.be.false;
    });

    it('boolean: false', () => {
      const schema = false;
      const value: SchemaType<typeof schema> = false;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate(true)).to.be.false;
      expect(validate(0)).to.be.false;
      expect(validate('false')).to.be.false;
    });

    it('number', () => {
      const schema = Number;
      const value: SchemaType<typeof schema> = 1;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate(0)).to.be.true;
      expect(validate(-1)).to.be.true;
      expect(validate(3.14)).to.be.true;
      // Note: Ajv doesn't validate Infinity or NaN as valid numbers by default
      expect(validate(Number.POSITIVE_INFINITY)).to.be.false;
      expect(validate(Number.NaN)).to.be.false;
      expect(validate('1')).to.be.false;
      expect(validate(true)).to.be.false;
    });

    it('string', () => {
      const schema = String;
      const value: SchemaType<typeof schema> = 'foo';
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate('')).to.be.true;
      expect(validate('123')).to.be.true;
      expect(validate(true)).to.be.false;
      expect(validate(1)).to.be.false;
      expect(validate(null)).to.be.false;
    });
  });

  describe('Complex Types', () => {
    it('array with string items', () => {
      const schema = { type: Array, items: String };
      const value: SchemaType<typeof schema> = ['foo', 'bar'];
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate([])).to.be.true;
      expect(validate(['foo', 1])).to.be.false;
      expect(validate(['foo', true])).to.be.false;
      expect(validate({ foo: 'foo' })).to.be.false;
      expect(validate('not an array')).to.be.false;
    });

    it('array with number items', () => {
      const schema = { type: Array, items: Number };
      const value: SchemaType<typeof schema> = [1, 2, 3];
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate([])).to.be.true;
      expect(validate([1, '2'])).to.be.false;
      expect(validate([1, true])).to.be.false;
    });

    it('array with boolean items', () => {
      const schema = { type: Array, items: Boolean };
      const value: SchemaType<typeof schema> = [true, false];
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate([true])).to.be.true;
      expect(validate([1])).to.be.false;
      expect(validate(['true'])).to.be.false;
    });

    it('nested array', () => {
      const schema = { type: Array, items: { type: Array, items: String } };
      const value: SchemaType<typeof schema> = [['foo', 'bar'], ['baz']];
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate([])).to.be.true;
      expect(validate([[]])).to.be.true;
      expect(validate([['foo', 1]])).to.be.false;
      expect(validate(['not an array'])).to.be.false;
    });

    it('simple object', () => {
      const schema = { foo: String };
      const value: SchemaType<typeof schema> = { foo: 'foo' };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate({ foo: '' })).to.be.true;
      expect(validate({})).to.be.false;
      expect(validate({ foo: 1 })).to.be.false;
      expect(validate({ foo: 'foo', bar: 'bar' })).to.be.true; // additional properties allowed
    });

    it('object with multiple properties', () => {
      const schema = { name: String, age: Number, active: Boolean };
      const value: SchemaType<typeof schema> = { name: 'John', age: 30, active: true };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate({ name: 'John', age: 30, active: false })).to.be.true;
      expect(validate({ name: 'John' })).to.be.false;
      expect(validate({ name: 'John', age: '30', active: true })).to.be.false;
    });

    it('nested object', () => {
      const schema = {
        user: {
          name: String,
          age: Number,
        },
        settings: {
          theme: ['light', 'dark'] as const,
          notifications: Boolean,
        },
      };
      const value: SchemaType<typeof schema> = {
        user: { name: 'John', age: 30 },
        settings: { theme: 'light', notifications: true },
      };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(
        validate({
          user: { name: 'John', age: 30 },
          settings: { theme: 'dark', notifications: false },
        }),
      ).to.be.true;
      expect(validate({})).to.be.false;
      expect(
        validate({
          user: { name: 'John' },
          settings: { theme: 'light', notifications: true },
        }),
      ).to.be.false;
    });
  });

  describe('Union Types', () => {
    it('simple union of primitives', () => {
      const schema = [String, Number] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate('foo')).to.be.true;
      expect(validate(1)).to.be.true;
      expect(validate(3.14)).to.be.true;
      expect(validate(true)).to.be.false;
      expect(validate(null)).to.be.false;
      expect(validate({})).to.be.false;
    });

    it('union of literals (enum)', () => {
      const schema = ['foo', 'bar'] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate('foo')).to.be.true;
      expect(validate('bar')).to.be.true;
      expect(validate('baz')).to.be.false;
      expect(validate('')).to.be.false;
      expect(validate(1)).to.be.false;
    });

    it('union of mixed literals', () => {
      const schema = ['active', 'inactive', true, false] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate('active')).to.be.true;
      expect(validate('inactive')).to.be.true;
      expect(validate(true)).to.be.true;
      expect(validate(false)).to.be.true;
      expect(validate('foo')).to.be.false;
      expect(validate(1)).to.be.false;
    });

    it('union of numbers', () => {
      const schema = [1, 2, 3] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(1)).to.be.true;
      expect(validate(2)).to.be.true;
      expect(validate(3)).to.be.true;
      expect(validate(4)).to.be.false;
      expect(validate('1')).to.be.false;
    });

    it('complex union with objects', () => {
      const schema = [String, { type: Array, items: Number }] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate('foo')).to.be.true;
      expect(validate([1, 2, 3])).to.be.true;
      expect(validate([])).to.be.true;
      expect(validate(['foo'])).to.be.false;
      expect(validate({})).to.be.false;
    });

    it('union with null', () => {
      const schema = [String, null] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate('foo')).to.be.true;
      expect(validate('')).to.be.true;
      expect(validate(null)).to.be.true;
      expect(validate(undefined)).to.be.false;
      expect(validate(1)).to.be.false;
    });
  });

  describe('Default Values', () => {
    it('default value for null', () => {
      const jsonSchema = toJSONSchema(null, null) as any;
      expect(jsonSchema.default).to.equal(null);
    });

    it('default value for boolean', () => {
      const jsonSchema = toJSONSchema(Boolean, true) as any;
      expect(jsonSchema.default).to.equal(true);
    });

    it('default value for number', () => {
      const jsonSchema = toJSONSchema(Number, 42) as any;
      expect(jsonSchema.default).to.equal(42);
    });

    it('default value for string', () => {
      const jsonSchema = toJSONSchema(String, 'default') as any;
      expect(jsonSchema.default).to.equal('default');
    });

    it('default value for literal', () => {
      const jsonSchema = toJSONSchema('literal', 'literal') as any;
      expect(jsonSchema.default).to.equal('literal');
    });

    it('default value for array', () => {
      const schema = { type: Array, items: String };
      const jsonSchema = toJSONSchema(schema, ['default']) as any;
      expect(jsonSchema.default).to.deep.equal(['default']);
    });

    it('default value for object', () => {
      const schema = { foo: String };
      const jsonSchema = toJSONSchema(schema, { foo: 'default' }) as any;
      expect(jsonSchema.default).to.deep.equal({ foo: 'default' });
    });

    it('default value for union', () => {
      const schema = [String, Number] as const;
      const jsonSchema = toJSONSchema(schema, 'default') as any;
      expect(jsonSchema.default).to.equal('default');
    });

    it('default value propagation to nested object properties', () => {
      const schema = {
        user: {
          name: String,
          age: Number,
        },
        settings: {
          theme: ['light', 'dark'] as const,
        },
      };
      const defaultValue = {
        user: { name: 'John', age: 30 },
        settings: { theme: 'light' as const },
      };
      const jsonSchema = toJSONSchema(schema, defaultValue) as any;
      expect(jsonSchema.default).to.deep.equal(defaultValue);
    });
  });

  describe('Edge Cases', () => {
    it('empty object schema', () => {
      const schema = {};
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate({})).to.be.true;
      expect(validate({ foo: 'bar' })).to.be.true;
    });

    it('empty array schema', () => {
      const schema = { type: Array, items: String };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate([])).to.be.true;
    });

    it('deeply nested structure', () => {
      const schema = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: String,
              },
            },
          },
        },
      };
      const value: SchemaType<typeof schema> = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(value)).to.be.true;
      expect(validate({})).to.be.false;
      expect(
        validate({
          level1: {
            level2: {
              level3: {
                level4: {},
              },
            },
          },
        }),
      ).to.be.false;
    });

    it('mixed types in union', () => {
      const schema = [String, Number, Boolean, null] as const;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate('test')).to.be.true;
      expect(validate(42)).to.be.true;
      expect(validate(true)).to.be.true;
      expect(validate(false)).to.be.true;
      expect(validate(null)).to.be.true;
      expect(validate({})).to.be.false;
      expect(validate([])).to.be.false;
      expect(validate(undefined)).to.be.false;
    });

    it('array with union items', () => {
      const schema = { type: Array, items: [String, Number] as const };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate(['test', 42, 'another'])).to.be.true;
      expect(validate([])).to.be.true;
      expect(validate(['test', true])).to.be.false;
      expect(validate([{}, 'test'])).to.be.false;
    });

    it('object with union properties', () => {
      const schema = { value: [String, Number] as const };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      expect(validate({ value: 'test' })).to.be.true;
      expect(validate({ value: 42 })).to.be.true;
      expect(validate({ value: true })).to.be.false;
      expect(validate({})).to.be.false;
    });
  });

  describe('JSON Schema Output Validation', () => {
    it('produces valid JSON Schema structure', () => {
      const schema = { name: String, age: Number };
      const jsonSchema = toJSONSchema(schema) as any;

      expect(jsonSchema).to.have.property('type', 'object');
      expect(jsonSchema).to.have.property('required');
      expect(jsonSchema.required).to.include.members(['name', 'age']);
      expect(jsonSchema).to.have.property('properties');
      expect(jsonSchema.properties).to.have.property('name');
      expect(jsonSchema.properties).to.have.property('age');
      expect(jsonSchema.properties.name).to.have.property('type', 'string');
      expect(jsonSchema.properties.age).to.have.property('type', 'number');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles zero and negative numbers', () => {
      const schema = Number;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      expect(validate(0)).to.be.true;
      expect(validate(-1)).to.be.true;
      expect(validate(-3.14)).to.be.true;
      // Ajv doesn't validate Infinity as a valid number by default
      expect(validate(Number.NEGATIVE_INFINITY)).to.be.false;
    });

    it('handles special number values', () => {
      const schema = Number;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      // Ajv doesn't validate Infinity or NaN as valid numbers by default
      expect(validate(Number.POSITIVE_INFINITY)).to.be.false;
      expect(validate(Number.NEGATIVE_INFINITY)).to.be.false;
      expect(validate(Number.MAX_VALUE)).to.be.true;
      expect(validate(Number.MIN_VALUE)).to.be.true;
      expect(validate(Number.EPSILON)).to.be.true;
      expect(validate(Number.NaN)).to.be.false;
    });

    it('handles empty string and whitespace', () => {
      const schema = String;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      expect(validate('')).to.be.true;
      expect(validate(' ')).to.be.true;
      expect(validate('\t\n\r')).to.be.true;
      expect(validate('   trimmed   ')).to.be.true;
    });

    it('handles unicode strings', () => {
      const schema = String;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      expect(validate('🚀')).to.be.true;
      expect(validate('中文')).to.be.true;
      expect(validate('ñáéíóú')).to.be.true;
      expect(validate('\u0000')).to.be.true;
    });

    it('handles large arrays', () => {
      const schema = { type: Array, items: Number };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      const largeArray = Array(500)
        .fill(0)
        .map((_, i) => i);
      expect(validate(largeArray)).to.be.true;

      const emptyArray: number[] = [];
      expect(validate(emptyArray)).to.be.true;
    });

    it('handles sparse arrays', () => {
      const schema = { type: Array, items: Number };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      const sparseArray = new Array(10);
      sparseArray[0] = 1;
      sparseArray[9] = 9;
      // Sparse arrays have undefined elements which may not be valid according to the schema
      expect(validate(sparseArray)).to.be.false;
    });

    it('handles objects with many properties', () => {
      const schema: Record<string, typeof String> = {};
      for (let i = 0; i < 20; i++) {
        // Reduced from 100 for better performance
        schema[`prop${i}`] = String;
      }

      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      const value: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        value[`prop${i}`] = `value${i}`;
      }
      expect(validate(value)).to.be.true;
    });

    it('handles objects with special property names', () => {
      const schema = {
        '': String,
        ' ': String,
        constructor: String,
        toString: String,
        __proto__: String,
      };

      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      const value = {
        '': 'empty',
        ' ': 'space',
        constructor: 'ctor',
        toString: 'string',
        __proto__: 'proto',
      };
      expect(validate(value)).to.be.true;
    });
  });

  describe('Type System Edge Cases', () => {
    it('handles deeply nested unions', () => {
      const schema = [String, [Number, Boolean] as const, { type: Array, items: ['a', 'b'] as const }] as const;

      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      expect(validate('test')).to.be.true;
      expect(validate(42)).to.be.true;
      expect(validate(true)).to.be.true;
      expect(validate(['a', 'b', 'a'])).to.be.true;
      expect(validate(['c'])).to.be.false;
      expect(validate({})).to.be.false;
    });

    it('handles arrays with union of objects', () => {
      const schema = {
        type: Array,
        items: [{ type: String }, { type: Number, value: Number }] as const,
      };

      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      // Both object types in the union should be valid
      expect(validate([{ type: 'test' }])).to.be.true;
      expect(validate([{ type: 'number', value: 42 }])).to.be.true;
      expect(validate([{ type: 'test' }, { type: 'number', value: 42 }])).to.be.true;
      // Objects with additional properties should still be valid due to additionalProperties: true by default
      expect(validate([{ type: 'invalid' }])).to.be.true;
      expect(validate([{ type: 'number' }])).to.be.true; // Missing 'value' is still valid due to union rules
    });

    it('handles mixed literal types in unions', () => {
      const schema = [0, 1, '', 'false', true, false, null] as const;

      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      expect(validate(0)).to.be.true;
      expect(validate(1)).to.be.true;
      expect(validate('')).to.be.true;
      expect(validate('false')).to.be.true;
      expect(validate(true)).to.be.true;
      expect(validate(false)).to.be.true;
      expect(validate(null)).to.be.true;
      expect(validate(2)).to.be.false;
      expect(validate('true')).to.be.false;
      expect(validate(undefined)).to.be.false;
    });

    it('handles recursive-like structures safely', () => {
      const schema = {
        node: {
          value: String,
          children: { type: Array, items: undefined as any },
        },
      };

      // Remove the recursive reference for this test
      schema.node.children = { type: Array, items: { value: String } };

      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      expect(
        validate({
          node: {
            value: 'root',
            children: [{ value: 'child1' }, { value: 'child2' }],
          },
        }),
      ).to.be.true;
    });
  });

  describe('Default Values Edge Cases', () => {
    it('handles nested default values with unions', () => {
      const schema = {
        value: [String, Number] as const,
        items: { type: Array, items: Boolean },
      };

      const defaultValue = {
        value: 'default',
        items: [true, false],
      };

      const jsonSchema = toJSONSchema(schema, defaultValue) as any;
      expect(jsonSchema.default).to.deep.equal(defaultValue);
    });

    it('handles default values for mixed literal unions', () => {
      const schema = [true, false, 'yes', 'no'] as const;
      const jsonSchema = toJSONSchema(schema, true) as any;
      expect(jsonSchema.default).to.equal(true);
    });

    it('handles undefined default values', () => {
      const schema = String;
      const jsonSchema = toJSONSchema(schema, undefined) as any;
      expect(jsonSchema.default).to.be.undefined;
    });

    it('handles function default values gracefully', () => {
      const schema = String;
      const testFunction = () => 'test';
      const jsonSchema = toJSONSchema(schema, testFunction) as any;
      expect(jsonSchema.default).to.be.a('function');
    });
  });

  describe('Performance and Stress Tests', () => {
    it('handles very large objects efficiently', () => {
      const schema: Record<string, typeof String> = {};
      for (let i = 0; i < 200; i++) {
        // Reduced from 1000 for better test performance
        schema[`prop${i}`] = String;
      }

      const startTime = Date.now();
      const jsonSchema = toJSONSchema(schema) as any;
      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).to.be.lessThan(1000);
      expect(jsonSchema.properties).to.have.property('prop0');
      expect(jsonSchema.properties).to.have.property('prop199');
    });

    it('handles deeply nested structures without stack overflow', () => {
      let schema: any = String;
      for (let i = 0; i < 100; i++) {
        schema = { type: Array, items: schema };
      }

      const startTime = Date.now();
      const jsonSchema = toJSONSchema(schema);
      const endTime = Date.now();

      expect(endTime - startTime).to.be.lessThan(1000);
      expect(jsonSchema).to.have.property('type', 'array');
    });

    it('validates complex schemas efficiently', () => {
      const schema = {
        users: {
          type: Array,
          items: {
            id: Number,
            name: String,
            active: Boolean,
            profile: {
              age: Number,
              email: String,
              settings: {
                theme: ['light', 'dark'] as const,
                notifications: Boolean,
              },
            },
          },
        },
        metadata: {
          version: String,
          created: Number,
          tags: { type: Array, items: String },
        },
      };

      // Helper function to create test user
      const createUser = (i: number) => ({
        id: i,
        name: `User${i}`,
        active: i % 2 === 0,
        profile: {
          age: 20 + (i % 50),
          email: `user${i}@example.com`,
          settings: {
            theme: i % 2 === 0 ? ('light' as const) : ('dark' as const),
            notifications: true,
          },
        },
      });

      const value = {
        users: Array(50)
          .fill(0)
          .map((_, i) => createUser(i)),
        metadata: {
          version: '1.0.0',
          created: Date.now(),
          tags: ['test', 'performance'],
        },
      };

      const startTime = Date.now();
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);
      const result = validate(value);
      const endTime = Date.now();

      expect(result).to.be.true;
      expect(endTime - startTime).to.be.lessThan(1000);
    });
  });

  describe('Boundary Value Testing', () => {
    it('tests array boundaries', () => {
      const schema = { type: Array, items: Number };
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      // Empty array
      expect(validate([])).to.be.true;

      // Single element
      expect(validate([42])).to.be.true;

      // Large array (reduced size for performance)
      const largeArray = Array(1000)
        .fill(0)
        .map(() => Math.random());
      expect(validate(largeArray)).to.be.true;
    });

    it('tests number boundaries', () => {
      const schema = Number;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      // Very large numbers
      expect(validate(Number.MAX_SAFE_INTEGER)).to.be.true;
      expect(validate(Number.MIN_SAFE_INTEGER)).to.be.true;

      // Very small numbers
      expect(validate(Number.EPSILON)).to.be.true;
      expect(validate(1e-10)).to.be.true;

      // Scientific notation
      expect(validate(1e20)).to.be.true;
      expect(validate(1e-20)).to.be.true;
    });

    it('tests string boundaries', () => {
      const schema = String;
      const jsonSchema = toJSONSchema(schema);
      const validate = ajv.compile(jsonSchema);

      // Very long string
      const longString = 'a'.repeat(10000);
      expect(validate(longString)).to.be.true;

      // String with various escape sequences
      expect(validate('Hello\nWorld\t!')).to.be.true;
      expect(validate('"quotes" and \'apostrophes\'')).to.be.true;
      expect(validate('\\backslashes\\')).to.be.true;
    });
  });
});
