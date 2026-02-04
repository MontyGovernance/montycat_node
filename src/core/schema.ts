import GenericKV from '../classes/generic.js';
import { convertCustomKey } from '../functions/storeGenericFunctions.js';

/** * Interface for schema properties
 * @interface
 */
// interface SchemaProperties {
//   key?: string;
//   pointers?: { [key: string]: [string, string] };
//   timestamps?: { [key: string]: string };
//   schema?: string;
// }

/** * Interface for pointer configuration
 * @interface
 */
interface PointerConfig {
  keyspace: { keyspace: string } | GenericKV;
  key?: string | number;
  customKey?: string;
}

/** * Interface for timestamp configuration
 * @interface
 */
interface TimestampConfig {
  timestamp: string;
}

/** * Interface for timestamp range configuration
 * @interface
 */
interface TimestampRangeConfig {
  startTimestamp: string;
  endTimestamp: string;
}

/**
 * Schema class
 * @class
 * @param properties - The properties of the schema
 * @property {Record<string, string>} metadata - The metadata object containing field types
 * @returns The schema object
 * @example
 * const schema = new Schema({ username: 'user', location: 'city' });
 * 
 * Metadata is used to define the types of properties to enforce in the schema.
 * Types can be 'String', 'Number', 'Pointer', 'Timestamp', "Object", "Array".
 * 
 * @throws {Error} If a required property is missing or not defined
 * @throws {Error} If a property is not defined in the schema
 * @throws {Error} If a pointer is not valid (missing keyspace or key)
 */
class Schema {

  [key: string]: any;

  static metadata: Record<string, Field> | null = null;

  // how to check metadata type?

  constructor(properties: { [key: string]: any }) {
    Object.assign(this, properties);
  }

  validate(): void {
    Object.keys(this).forEach((key) => {
      if (this[key] === undefined) {
        throw new Error(`Property ${key} is missing`);
      }

      if (!this.hasOwnProperty(key)) {
        throw new Error(`Property ${key} is not defined`);
      }

    });
  }

  get className(): string {
    return this.constructor.name;
  }

  serialize(): Schema {

    if (Object.values(this).some((value) => value instanceof Pointer)) {
      this.pointers = {};
    }

    if (Object.values(this).some((value) => value instanceof Timestamp)) {
      this.timestamps = {};
    }

    this.schema = this.className;
    this.validate();

    Object.keys(this).forEach((key) => {
      if (this[key] instanceof Pointer) {
        this.pointers![key] = this[key].setupPointer();
        delete this[key];
      }
      if (this[key] instanceof Timestamp) {
        this.timestamps![key] = this[key].timestamp;
        delete this[key];
      }
    });

    return { ...this };
  }
}

/**
 * Pointer class
 * @class
 * @param config - The pointer configuration
 * @returns The pointer object
 */
class Pointer {
  private key?: string;
  private keyspace: string;

  constructor({ keyspace, key = '', customKey = '' }: PointerConfig) {
    this.keyspace = keyspace.keyspace;
    this.key = key ? key.toString() : customKey ? convertCustomKey(customKey) : undefined;
  }

  setupPointer(): [string, string] {
    if (this.keyspace && this.key) {
      return [this.keyspace, this.key];
    } else {
      throw new Error('Pointer is not valid. Please provide a keyspace and a key.');
    }
  }
}

/**
 * Timestamp class
 * @class
 * @param timestamp - The timestamp object
 * @returns The timestamp object
 * @example
 * const timestamp = new Timestamp({ timestamp: Date.now() });
 */
class Timestamp {

  timestamp: string;

  constructor({ timestamp }: TimestampConfig) {
    this.timestamp = timestamp;
  }

  static after = class After {
    after_timestamp: number | string;

    constructor(after: number | string) {
      this.after_timestamp = after;
    }
  };

  static before = class Before {
    before_timestamp: number | string;

    constructor(before: number | string) {
      this.before_timestamp = before;
    }
  };

  static range = class Range {
    range_timestamp: [number | string, number | string];

    constructor({ startTimestamp, endTimestamp }: TimestampRangeConfig) {
      this.range_timestamp = [startTimestamp, endTimestamp];
    }
  };
}

/**
 * Field class
 * @class
 * @param fieldType - The type of the field
 * @param nullable - Whether the field is nullable // default is false
 * @returns The field object
 * @example
 * const field = new Field('String', true);
 */
class Field {
  fieldType: string;
  nullable: boolean;

  constructor(fieldType: string, nullable: boolean = false) {
    this.fieldType = fieldType;
    this.nullable = nullable;
  }

  getType(): string {
    return this.fieldType;
  }

  getNullable(): boolean {
    return this.nullable;
  }

}

export { Schema, Pointer, Timestamp, Field };