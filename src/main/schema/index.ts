import type { JSONSchema as _JSONSchema } from 'json-schema-typed';
export type JSONSchema = _JSONSchema;

export type Schema =
    null
    | TrueBooleanSchema
    | FalseBooleanSchema
    | BooleanSchema
    | NumberSchema
    | StringSchema
    | ArraySchema
    | UnionSchema
    | _UnionSchemaEnum
    | ObjectSchema;
type TrueBooleanSchema = true | { type: true, enum?: [true] };
type FalseBooleanSchema = false | { type: false, enum?: [false] };
type BooleanSchema = BooleanConstructor | { type: BooleanConstructor, enum?: [true, false] | [false, true] | [true] | [false] };
type NumberSchema = NumberConstructor | { type: NumberConstructor, enum?: readonly number[] };
type StringSchema = StringConstructor | { type: StringConstructor, enum?: readonly string[] };
type ObjectSchema = {
    type?: undefined;
    enum?: undefined;
    items?: undefined;
    [key: string]: Schema | undefined;
};
type ArraySchema = { type: ArrayConstructor, items: Schema };
type UnionSchema = readonly Schema[];
type _UnionSchemaEnum = { type: UnionSchema, enum?: any[] };
type UnionSchemaEnum<T extends UnionSchema> = { type: T, enum?: SchemaType<T>[] };

export type SchemaType<S extends Schema> =
    S extends never ? unknown
    : S extends null ? null
    : S extends TrueBooleanSchema ? true
    : S extends FalseBooleanSchema ? false
    : S extends BooleanSchema ? MayBeEnum<S, boolean>
    : S extends NumberSchema ? MayBeEnum<S, number>
    : S extends StringSchema ? MayBeEnum<S, string>
    : S extends ArraySchema ? SchemaArrayType<S>
    : S extends UnionSchema ? SchemaUnionType<S>
    : S extends UnionSchemaEnum<infer R> ? SchemaUnionType<R>
    : S extends Record<string, Schema> ? SchemaObjectType<S>
    : never;
type SchemaArrayType<T extends ArraySchema> = SchemaType<T['items']>[];
type SchemaObjectType<T extends Record<string, Schema>> = {
    [key in keyof T]: SchemaType<T[key]>;
};
type MayBeEnum<T, D> = T extends { enum: infer R } ? (R extends readonly D[] ? R[number] : D) : D;
type Rest<S extends readonly [T, ...Schema[]], T> = S extends readonly [T, ...infer R] ? R extends Schema ? R : never : never;
type SchemaUnionType<S extends UnionSchema> =
    S extends readonly [null] ? null
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

export type SchemaDescription<S extends Schema> =
    S extends never ? unknown
    : S extends null ? (Description | undefined)
    : S extends TrueBooleanSchema ? (Description | undefined)
    : S extends FalseBooleanSchema ? (Description | undefined)
    : S extends BooleanSchema ? (Description | undefined)
    : S extends NumberSchema ? (Description | undefined)
    : S extends StringSchema ? (Description | undefined)
    : S extends ArraySchema ? (Description | undefined) | readonly (Description | undefined)[]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    : S extends UnionSchemaEnum<infer R> ? (Description | undefined)
    : S extends UnionSchema ? (Description | undefined)
    : S extends Record<string, Schema> ? (SchemaObjectDescription<S> | undefined)
    : never;
type Description = string | { readableName: string, description: string };
type SchemaObjectDescription<T extends Record<string, Schema>> = {
    [key in keyof T]?: SchemaDescription<T[key]>;
};

function isNull(s: Schema): s is null {
    return s === null;
}
function isBoolean(s: Schema): s is BooleanSchema | TrueBooleanSchema | FalseBooleanSchema {
    let type: unknown = s;
    if (s !== null && typeof s === 'object' && 'type' in s) { type = s.type; }
    return type === true || type === false || type === Boolean;
}
function isTrueBoolean(s: Schema): s is TrueBooleanSchema {
    let type: unknown = s;
    if (s !== null && typeof s === 'object' && 'type' in s) { type = s.type; }
    return type === true;
}
function isFalseBoolean(s: Schema): s is FalseBooleanSchema {
    let type: unknown = s;
    if (s !== null && typeof s === 'object' && 'type' in s) { type = s.type; }
    return type === false;
}
function isNumber(s: Schema): s is NumberSchema {
    return s === Number || (s !== null && typeof s === 'object' && 'type' in s && s.type === Number);
}
function isString(s: Schema): s is StringSchema {
    return s === String || (s !== null && typeof s === 'object' && 'type' in s && s.type === String);
}
function isUnion(s: Schema): s is UnionSchema | _UnionSchemaEnum {
    return s instanceof Array || (s !== null && typeof s === 'object' && 'type' in s && s.type instanceof Array);
}
function isArray(s: Schema): s is ArraySchema {
    return s !== null && typeof s === 'object' && 'type' in s && s.type === Array;
}

export function toJSONSchema(root: Schema, defaultValue?: any): JSONSchema {
    if (isNull(root)) {
        return { type: 'null', default: null };
    } else if (isTrueBoolean(root)) {
        return { type: 'boolean', enum: [true], default: defaultValue };
    } else if (isFalseBoolean(root)) {
        return { type: 'boolean', enum: [false], default: defaultValue };
    } else if (isBoolean(root)) {
        return { type: 'boolean', enum: 'enum' in root && root.enum ? root.enum : [true, false], default: defaultValue };
    } else if (isNumber(root)) {
        const schema: JSONSchema = { type: 'number', default: defaultValue };
        if ('enum' in root && root.enum) {
            schema.enum = [...root.enum];
        }
        return schema;
    } else if (isString(root)) {
        const schema: JSONSchema = { type: 'string', default: defaultValue };
        if ('enum' in root && root.enum) {
            schema.enum = [...root.enum];
        }
        return schema;
    } else if (isUnion(root)) {
        const type = 'type' in root ? root.type : root;
        return {
            anyOf: type.map(i => toJSONSchema(i, undefined)).map(i => { delete i.default; return i; }),
            default: defaultValue,
            enum: 'enum' in root ? root.enum : undefined
        };
    } else if (isArray(root)) {
        const schema: JSONSchema = { type: 'array', default: defaultValue };
        schema.items = toJSONSchema((root as ArraySchema).items, undefined);
        return schema;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _typeCheck: ObjectSchema = root;
        const schema: JSONSchema = { type: 'object', required: Object.keys(root as Record<string, unknown>), default: defaultValue };
        schema.properties = {};
        for (const prop in root) {
            const propSchema = root[prop];
            const propDefaultValue = defaultValue?.[prop];
            if (propSchema !== undefined) schema.properties[prop] = toJSONSchema(propSchema, propDefaultValue);
        }
        return JSON.parse(JSON.stringify(schema));
    }
}
