import type { SchemaDefinition, ValidationFieldError } from './types.js';
import { ValidationError } from './errors.js';

class FieldBuilder {
  private def: SchemaDefinition[string] = { type: 'string' };

  required(): this {
    this.def.required = true;
    return this;
  }

  optional(): this {
    this.def.required = false;
    return this;
  }

  default(value: unknown): this {
    this.def.default = value;
    return this;
  }

  min(value: number): this {
    this.def.min = value;
    return this;
  }

  max(value: number): this {
    this.def.max = value;
    return this;
  }

  minLength(value: number): this {
    this.def.minLength = value;
    return this;
  }

  maxLength(value: number): this {
    this.def.maxLength = value;
    return this;
  }

  email(): this {
    this.def.email = true;
    return this;
  }

  url(): this {
    this.def.url = true;
    return this;
  }

  enum<T extends unknown[]>(values: T): this {
    this.def.enum = values;
    return this;
  }

  pattern(regex: string): this {
    this.def.pattern = regex;
    return this;
  }

  build(): SchemaDefinition[string] {
    return { ...this.def };
  }
}

function stringField(): FieldBuilder {
  const b = new FieldBuilder();
  b['def'] = { type: 'string' };
  return b;
}

function numberField(): FieldBuilder {
  const b = new FieldBuilder();
  b['def'] = { type: 'number' };
  return b;
}

function booleanField(): FieldBuilder {
  const b = new FieldBuilder();
  b['def'] = { type: 'boolean' };
  return b;
}

function arrayField(): FieldBuilder {
  const b = new FieldBuilder();
  b['def'] = { type: 'array' };
  return b;
}

function objectField(): FieldBuilder {
  const b = new FieldBuilder();
  b['def'] = { type: 'object' };
  return b;
}

export const Schema = {
  string: stringField,
  number: numberField,
  boolean: booleanField,
  array: arrayField,
  object: objectField,
};

export function validateData(
  data: Record<string, unknown>,
  schema: SchemaDefinition
): Record<string, unknown> {
  const errors: ValidationFieldError[] = [];
  const result = { ...data };

  for (const [field, def] of Object.entries(schema)) {
    let value = result[field];

    if ((value === undefined || value === null) && def.default !== undefined) {
      value = def.default;
      result[field] = value;
    }

    if ((value === undefined || value === null) && def.required) {
      errors.push({ field, message: 'Required field is missing' });
      continue;
    }

    if (value === undefined || value === null) continue;

    switch (def.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({ field, message: 'Expected string' });
          break;
        }
        if (def.minLength != null && value.length < def.minLength) {
          errors.push({ field, message: `Minimum length is ${def.minLength}` });
        }
        if (def.maxLength != null && value.length > def.maxLength) {
          errors.push({ field, message: `Maximum length is ${def.maxLength}` });
        }
        if (def.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({ field, message: 'Invalid email' });
        }
        if (def.url) {
          try {
            new URL(value);
          } catch {
            errors.push({ field, message: 'Invalid URL' });
          }
        }
        if (def.pattern && !new RegExp(def.pattern).test(value)) {
          errors.push({ field, message: 'Does not match pattern' });
        }
        break;
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push({ field, message: 'Expected number' });
          break;
        }
        if (def.min != null && value < def.min) {
          errors.push({ field, message: `Minimum value is ${def.min}` });
        }
        if (def.max != null && value > def.max) {
          errors.push({ field, message: `Maximum value is ${def.max}` });
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') errors.push({ field, message: 'Expected boolean' });
        break;
      case 'array':
        if (!Array.isArray(value)) errors.push({ field, message: 'Expected array' });
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({ field, message: 'Expected object' });
        }
        break;
    }

    if (def.enum && !def.enum.includes(value)) {
      errors.push({ field, message: `Must be one of: ${def.enum.join(', ')}` });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  return result;
}

export function schemaFromBuilders(
  builders: Record<string, FieldBuilder>
): SchemaDefinition {
  const schema: SchemaDefinition = {};
  for (const [key, builder] of Object.entries(builders)) {
    schema[key] = builder.build();
  }
  return schema;
}
