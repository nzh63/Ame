import type { JSONSchema as _JSONSchema } from 'json-schema-typed';

export type JSONSchema = _JSONSchema;

export type Schema =
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | LiteralSchema
  | ArraySchema
  | ObjectSchema
  | UnionSchema;
type BooleanSchema = BooleanConstructor;
type NumberSchema = NumberConstructor;
type StringSchema = StringConstructor;
type LiteralSchema = null | boolean | number | string;
interface ArraySchema {
  type: ArrayConstructor;
  items: Schema;
}
interface ObjectSchema {
  [key: string]: Schema | undefined;
}
type UnionSchema = readonly Schema[];

export type SchemaType<S extends Schema> = S extends UnionSchema ? UnionSchemaType<S> : SchemaTypeWithoutUnion<S>;
export type SchemaTypeWithoutUnion<S extends Schema> = //
  S extends SimpleSchema
    ? SimpleSchemaType<S>
    : S extends ArraySchema
      ? ArraySchemaType<S>
      : S extends Record<string, Schema>
        ? ObjectSchemaType<S>
        : never;
type SimpleSchema = BooleanSchema | NumberSchema | StringSchema | LiteralSchema;
type SimpleSchemaType<S extends Schema> = //
  S extends BooleanSchema
    ? boolean
    : S extends NumberSchema
      ? number
      : S extends StringSchema
        ? string
        : S extends LiteralSchema
          ? S
          : never;
type ArraySchemaType<T extends ArraySchema> = SchemaType<T['items']>[];
type ObjectSchemaType<T extends Record<string, Schema>> = {
  [key in keyof T]: SchemaType<T[key]>;
};
type UnionSchemaType<S extends UnionSchema> = SchemaTypeWithoutUnion<S[number]>;

export type SchemaDescription<S extends Schema> = //
  S extends never
    ? unknown
    : S extends Record<string, Schema>
      ? SchemaObjectDescription<S> | undefined
      : S extends ArraySchema
        ? (Description | undefined) | readonly (Description | undefined)[]
        : Description | undefined;
type Description = string | { readableName: string; description: string };
type SchemaObjectDescription<T extends Record<string, Schema>> = {
  [key in keyof T]?: SchemaDescription<T[key]>;
};

function isNull(s: Schema): s is null {
  return s === null;
}
function isBoolean(s: Schema): s is BooleanSchema {
  return s === Boolean;
}
function isNumber(s: Schema): s is NumberSchema {
  return s === Number;
}
function isString(s: Schema): s is StringSchema {
  return s === String;
}
function isLiteral(s: Schema): s is LiteralSchema {
  return ['null', 'boolean', 'number', 'string'].includes(typeof s);
}
function isUnion(s: Schema): s is UnionSchema {
  return s instanceof Array;
}
function isArray(s: Schema): s is ArraySchema {
  return s !== null && typeof s === 'object' && 'type' in s && s.type === Array;
}

export function toJSONSchema(root: Schema, defaultValue?: any): JSONSchema {
  if (isNull(root)) {
    return { type: 'null', default: null };
  } else if (isBoolean(root)) {
    return { type: 'boolean', enum: [true, false], default: defaultValue };
  } else if (isNumber(root)) {
    const schema: JSONSchema = { type: 'number', default: defaultValue };
    return schema;
  } else if (isString(root)) {
    const schema: JSONSchema = { type: 'string', default: defaultValue };
    return schema;
  } else if (isLiteral(root)) {
    const schema: JSONSchema = { type: typeof root as any, enum: [root], default: defaultValue };
    return schema;
  } else if (isUnion(root)) {
    if (root.every(isLiteral)) {
      return {
        anyOf: Object.entries(
          Object.groupBy(
            root.map((i) => ({ type: typeof i, value: i })),
            ({ type }) => type,
          ),
        ).map(([type, values]) => ({ type: type as any, enum: values.map((i) => i.value) })),
        enum: [...root],
        default: defaultValue,
      };
    }
    return {
      anyOf: root
        .map((i) => toJSONSchema(i, undefined))
        .map((i) => {
          if (typeof i === 'object') {
            delete i.default;
          }
          return i;
        }),
      default: defaultValue,
    };
  } else if (isArray(root)) {
    const schema: JSONSchema = { type: 'array', default: defaultValue };
    schema.items = toJSONSchema((root as ArraySchema).items, undefined);
    return schema;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _typeCheck: ObjectSchema = root;
    const schema: JSONSchema = {
      type: 'object',
      required: Object.keys(root as Record<string, unknown>),
      default: defaultValue,
    };
    schema.properties = {};
    for (const prop in root) {
      if (!Object.hasOwn(root, prop)) continue;
      const propSchema = root[prop];
      const propDefaultValue = defaultValue?.[prop];
      if (propSchema !== undefined) schema.properties[prop] = toJSONSchema(propSchema, propDefaultValue);
    }
    return JSON.parse(JSON.stringify(schema));
  }
}
