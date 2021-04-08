import type { JSONSchema as _JSONSchema } from 'json-schema-typed';
export type JSONSchema = _JSONSchema;

export type Schema = null | TrueBooleanSchema | FalseBooleanSchema | BooleanSchema | NumberSchema | StringSchema | ArraySchema | UnionSchema | _UnionSchemaEnum | ObjectSchema;
type TrueBooleanSchema = true | { type: true, enum?: [true] };
type FalseBooleanSchema = false | { type: false, enum?: [false] };
type BooleanSchema = BooleanConstructor | { type: BooleanConstructor, enum?: [true, false] | [false, true] | [true] | [false] };
type NumberSchema = NumberConstructor | { type: NumberConstructor, enum?: readonly number[] };
type StringSchema = StringConstructor | { type: StringConstructor, enum?: readonly string[] };
type ObjectSchema = {
    [key: string]: Schema;
};
type ArraySchema = { type: ArrayConstructor, items: Schema };
type UnionSchema = readonly Schema[];
type _UnionSchemaEnum = { type: UnionSchema, enum?: any[] };
type UnionSchemaEnum<T> = { type: T, enum?: SchemaType<T>[] };

export type SchemaType<S> = [S] extends [null] ? null
    : [S] extends [TrueBooleanSchema] ? true
    : [S] extends [FalseBooleanSchema] ? false
    : [S] extends [BooleanSchema] ? EnumOrCommon<S, boolean>
    : [S] extends [NumberSchema] ? EnumOrCommon<S, number>
    : [S] extends [StringSchema] ? EnumOrCommon<S, string>
    : [S] extends [ArraySchema] ? SchemaArrayType<S>
    : [S] extends [UnionSchema] ? SchemaUnionType<S>
    : [S] extends [UnionSchemaEnum<infer R>] ? SchemaUnionType<R>
    : [S] extends [Record<string, Schema | _UnionSchemaEnum>] ? SchemaObjectType<S>
    : never;
type SchemaArrayType<T extends ArraySchema> = SchemaType<T['items']>[];
type SchemaObjectType<T extends Record<string, Schema>> = {
    [key in keyof T]: SchemaType<T[key]>;
};
type EnumOrCommon<T, D> = T extends { enum: infer R } ? (R extends readonly D[] ? R[number] : D) : D;
type Rest<S extends readonly [T, ...Schema[]], T> = S extends readonly [T, ...infer R] ? R : never;
type SchemaUnionType<S> = S extends readonly [null] ? null
    : S extends readonly [TrueBooleanSchema] ? true
    : S extends readonly [FalseBooleanSchema] ? false
    : S extends readonly [BooleanSchema] ? boolean
    : S extends readonly [NumberSchema] ? number
    : S extends readonly [StringSchema] ? string
    : S extends readonly [ArraySchema] ? SchemaArrayType<S[0]>
    : S extends readonly [Record<string, Schema>] ? SchemaObjectType<S[0]>
    : S extends readonly [null, ...Schema[]] ? null | SchemaUnionType<Rest<S, null>>
    : S extends readonly [TrueBooleanSchema, ...Schema[]] ? true | SchemaUnionType<Rest<S, TrueBooleanSchema>>
    : S extends readonly [FalseBooleanSchema, ...Schema[]] ? false | SchemaUnionType<Rest<S, FalseBooleanSchema>>
    : S extends readonly [BooleanSchema, ...Schema[]] ? boolean | SchemaUnionType<Rest<S, BooleanSchema>>
    : S extends readonly [NumberSchema, ...Schema[]] ? number | SchemaUnionType<Rest<S, NumberSchema>>
    : S extends readonly [StringSchema, ...Schema[]] ? string | SchemaUnionType<Rest<S, StringSchema>>
    : S extends readonly [ArraySchema, ...Schema[]] ? SchemaArrayType<S[0]> | SchemaUnionType<Rest<S, ArraySchema>>
    : S extends readonly [Record<string, Schema>, ...Schema[]] ? SchemaObjectType<S[0]> | SchemaUnionType<Rest<S, Record<string, Schema>>>
    : never;

export type SchemaDescription<S> = [S] extends [null] ? (string | undefined)
    : [S] extends [TrueBooleanSchema] ? (Description | undefined)
    : [S] extends [FalseBooleanSchema] ? (Description | undefined)
    : [S] extends [BooleanSchema] ? (Description | undefined)
    : [S] extends [NumberSchema] ? (Description | undefined)
    : [S] extends [StringSchema] ? (Description | undefined)
    : [S] extends [ArraySchema] ? (Description | undefined)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    : [S] extends [UnionSchemaEnum<infer R>] ? (Description | undefined)
    : [S] extends [UnionSchema] ? (Description | undefined)
    : [S] extends [Record<string, Schema | _UnionSchemaEnum>] ? (SchemaObjectDescription<S> | undefined)
    : never;
type Description = string | { readableName: string, description: string };
type SchemaObjectDescription<T extends Record<string, Schema>> = {
    [key in keyof T]?: SchemaDescription<T[key]>;
};

export function toJSONSchema<T extends Schema>(root: T, defaultValue?: any): JSONSchema {
    if (root === null) {
        return { type: 'null', default: null };
    } else if (root === true || (root !== false && 'type' in root && root.type === true)) {
        return { type: 'boolean', enum: [true], default: defaultValue };
    } else if (root === false || ('type' in root && root.type === false)) {
        return { type: 'boolean', enum: [false], default: defaultValue };
    } else if (root === Boolean || ('type' in root && root.type === Boolean)) {
        return { type: 'boolean', enum: (root as any).enum ?? [true, false], default: defaultValue };
    } else if (root === Number || ('type' in root && root.type === Number)) {
        const schema: JSONSchema = { type: 'number', default: defaultValue };
        if ('enum' in root) {
            schema.enum = (root as any).enum;
        }
        return schema;
    } else if (root === String || ('type' in root && root.type === String)) {
        const schema: JSONSchema = { type: 'string', default: defaultValue };
        if ('enum' in root) {
            schema.enum = (root as any).enum;
        }
        return schema;
    } else if (root instanceof Array) { // Union
        const schema: JSONSchema = {
            anyOf: root.map(i => toJSONSchema(i, undefined)).map(i => { delete i.default; return i; }),
            default: defaultValue
        };
        return schema;
    } else if ('type' in root && root.type instanceof Array) {
        const schema: JSONSchema = {
            anyOf: root.type.map(i => toJSONSchema(i, undefined)).map(i => { delete i.default; return i; }),
            default: defaultValue
        };
        if ('enum' in root) {
            schema.enum = (root as any).enum;
        }
        return schema;
    } else if ('type' in root && root.type === Array) {
        const schema: JSONSchema = { type: 'array', default: defaultValue };
        schema.items = toJSONSchema((root as ArraySchema).items, undefined);
        return schema;
    } else {
        const schema: JSONSchema = { type: 'object', required: Object.keys(root as Record<string, unknown>), default: defaultValue };
        schema.properties = {};
        for (const i in root) {
            schema.properties[i] = toJSONSchema((root as ObjectSchema)[i], (defaultValue as any)?.[i]);
        }
        return JSON.parse(JSON.stringify(schema));
    }
}
