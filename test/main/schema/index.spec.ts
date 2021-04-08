/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { SchemaType, toJSONSchema } from '@main/schema';
import Ajv from 'ajv';
import { expect } from 'chai';

describe('Schema', function() {
    let ajv: Ajv;

    before(function() {
        ajv = new Ajv();
    });

    after(function() {
    });

    it('null', function() {
        const schema = null;
        const value: SchemaType<typeof schema> = null;
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(1)).to.be.false;
        expect(validate('foo')).to.be.false;
    });

    it('boolean', function() {
        const schema = Boolean;
        const value: SchemaType<typeof schema> = true;
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(1)).to.be.false;
        expect(validate('foo')).to.be.false;
    });

    it('boolean: true', function() {
        const schema = true;
        const value: SchemaType<typeof schema> = true;
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(false)).to.be.false;
        expect(validate('foo')).to.be.false;
    });

    it('boolean: false', function() {
        const schema = false;
        const value: SchemaType<typeof schema> = false;
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(true)).to.be.false;
        expect(validate('foo')).to.be.false;
    });

    it('number', function() {
        const schema = Number;
        const value: SchemaType<typeof schema> = 1;
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(true)).to.be.false;
        expect(validate('foo')).to.be.false;
    });

    it('string', function() {
        const schema = String;
        const value: SchemaType<typeof schema> = 'foo';
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(true)).to.be.false;
        expect(validate(1)).to.be.false;
    });

    it('array', function() {
        const schema = { type: Array, items: String };
        const value: SchemaType<typeof schema> = ['foo', 'bar'];
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate(['foo', 1])).to.be.false;
        expect(validate({ foo: 'foo' })).to.be.false;
    });

    it('object', function() {
        const schema = { foo: String };
        const value: SchemaType<typeof schema> = { foo: 'foo' };
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate(value)).to.be.true;
        expect(validate({})).to.be.false;
        expect(validate({ foo: 1 })).to.be.false;
    });

    it('union', function() {
        const schema = [String, Number] as const;
        const value: SchemaType<typeof schema> = 'foo';
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate('foo')).to.be.true;
        expect(validate(1)).to.be.true;
        expect(validate(true)).to.be.false;
    });

    it('enum', function() {
        const schema = { type: String, enum: ['foo', 'bar'] as const };
        const value: SchemaType<typeof schema> = 'foo';
        const jsonSchema = toJSONSchema(schema);
        const validate = ajv.compile(jsonSchema);
        expect(validate('foo')).to.be.true;
        expect(validate('bar')).to.be.true;
        expect(validate('baz')).to.be.false;
    });
});
