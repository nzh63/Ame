/** JSON Schema shape consumed by the frontend Options editor. */
export interface JSONSchema {
  type?: string | string[];
  enum?: unknown[];
  default?: unknown;
  items?: JSONSchema;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}
