/**
 * Generic JSON type definitions
 * These types represent any valid JSON value
 */

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];
