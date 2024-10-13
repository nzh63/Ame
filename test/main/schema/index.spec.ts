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

  it('null', () => {
    const schema = null;
    const value: SchemaType<typeof schema> = null;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(1)).to.be.false;
    expect(validate('foo')).to.be.false;
  });

  it('boolean', () => {
    const schema = Boolean;
    const value: SchemaType<typeof schema> = true;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(1)).to.be.false;
    expect(validate('foo')).to.be.false;
  });

  it('boolean: true', () => {
    const schema = true;
    const value: SchemaType<typeof schema> = true;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(false)).to.be.false;
    expect(validate('foo')).to.be.false;
  });

  it('boolean: false', () => {
    const schema = false;
    const value: SchemaType<typeof schema> = false;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(true)).to.be.false;
    expect(validate('foo')).to.be.false;
  });

  it('number', () => {
    const schema = Number;
    const value: SchemaType<typeof schema> = 1;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(true)).to.be.false;
    expect(validate('foo')).to.be.false;
  });

  it('string', () => {
    const schema = String;
    const value: SchemaType<typeof schema> = 'foo';
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(true)).to.be.false;
    expect(validate(1)).to.be.false;
  });

  it('array', () => {
    const schema = { type: Array, items: String };
    const value: SchemaType<typeof schema> = ['foo', 'bar'];
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate(['foo', 1])).to.be.false;
    expect(validate({ foo: 'foo' })).to.be.false;
  });

  it('object', () => {
    const schema = { foo: String };
    const value: SchemaType<typeof schema> = { foo: 'foo' };
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate(value)).to.be.true;
    expect(validate({})).to.be.false;
    expect(validate({ foo: 1 })).to.be.false;
  });

  it('union', () => {
    const schema = [String, Number] as const;
    'foo' satisfies SchemaType<typeof schema>;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate('foo')).to.be.true;
    expect(validate(1)).to.be.true;
    expect(validate(true)).to.be.false;
  });

  it('enum', () => {
    const schema = { type: String, enum: ['foo', 'bar'] as const };
    'foo' satisfies SchemaType<typeof schema>;
    const jsonSchema = toJSONSchema(schema);
    const validate = ajv.compile(jsonSchema);
    expect(validate('foo')).to.be.true;
    expect(validate('bar')).to.be.true;
    expect(validate('baz')).to.be.false;
  });
});
