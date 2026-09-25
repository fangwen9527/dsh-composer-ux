// ../../../DeepSeek Harness/vendor/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
var write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
  if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
  } finally {
    ancestors.delete(value);
  }
}
function createVolatile(value) {
  let current = snapshot(value);
  return Object.freeze({
    get: () => current,
    [write]: (value2) => {
      current = value2;
    }
  });
}
function isVolatile(value) {
  return typeof value === "object" && value !== null && write in value;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    throw new Error("Binary.fromBase64: 本发行产物只在 Node 环境（Buffer 可用）下运行");
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  const ancestors = /* @__PURE__ */ new Set();
  function compare(a2, b2) {
    if (a2 === b2) return true;
    if (isVolatile(a2) || isVolatile(b2)) return isVolatile(a2) && isVolatile(b2);
    if (!strict && isNullable(a2) && isNullable(b2)) return true;
    if (typeof a2 !== typeof b2 || typeof a2 !== "object" || !a2 || !b2) return false;
    if (ancestors.has(a2)) return false;
    function check(test, then) {
      return test(a2) ? test(b2) ? then(a2, b2) : false : test(b2) ? false : void 0;
    }
    ancestors.add(a2);
    try {
      return check(Array.isArray, (a3, b3) => {
        if (a3.length !== b3.length) return false;
        for (let index = 0; index < a3.length; index++) if (!compare(a3[index], b3[index])) return false;
        return true;
      }) ?? check(is("Date"), (a3, b3) => a3.valueOf() === b3.valueOf()) ?? check(is("URL"), (a3, b3) => a3.href === b3.href) ?? check(is("RegExp"), (a3, b3) => a3.source === b3.source && a3.flags === b3.flags) ?? check(isArrayBufferLike, (a3, b3) => {
        if (a3.byteLength !== b3.byteLength) return false;
        const viewA = new Uint8Array(a3);
        const viewB = new Uint8Array(b3);
        for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
        return true;
      }) ?? ((!strict || [a2, b2].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
        ...a2,
        ...b2
      }).every((key) => compare(a2[key], b2[key])));
    } finally {
      ancestors.delete(a2);
    }
  }
  return compare(a, b);
}
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// ../../../DeepSeek Harness/vendor/schemastery/lib/index.mjs
var kSchema = Symbol.for("schemastery");
var kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = null;
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (isVolatile(value)) value = value.get();
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.volatile = function volatile() {
  if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
  return this.extra("volatile", true);
};
var resolvers = {};
var checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
  const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
  if (states.has(blocked)) return;
  states.add(blocked);
  seen.set(schema, states);
  if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
  const nested = blocked || !!schema.meta?.volatile;
  if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
  if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
  if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
  if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve3) {
  resolvers[type] = resolve3;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (!options[checkedVolatile]) {
    validateVolatileSchema(schema, options.path);
    options = {
      ...options,
      [checkedVolatile]: true
    };
  }
  if (schema.meta?.volatile) {
    const inner = Schema(schema);
    inner.meta = {
      ...schema.meta,
      volatile: false
    };
    const [value, adapted] = Schema.resolve(data, inner, options, strict);
    try {
      return [createVolatile(value), adapted];
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : String(error), options);
    }
  }
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
    validateVolatileSchema(schema.inner, options.path, true);
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name2, keys, format) {
  formatters[name2] = format;
  Object.assign(Schema, { [name2](...args) {
    const schema = new Schema({ type: name2 });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name2 === "object" || name2 === "dict") schema.meta.default = {};
    else if (name2 === "array" || name2 === "tuple") schema.meta.default = [];
    else if (name2 === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// src/host.ts
import { spawn } from "node:child_process";
import { existsSync as existsSync2, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname as dirname3, join as join3, resolve as resolve2 } from "node:path";
import inspector from "node:inspector";

// src/terminal/discover.ts
var WSL_REASON = "WSL \u7684 bash\uFF1A\u5B83\u6309 Linux \u89C4\u5219\u89E3\u91CA\u8DEF\u5F84\uFF08D:\\x \u8981\u5199\u6210 /mnt/d/x\uFF09\uFF0C\u4E0E\u6A21\u578B\u624B\u91CC\u7684 Windows \u5DE5\u4F5C\u76EE\u5F55\u4E0D\u517C\u5BB9\uFF0C\u6545\u4E0D\u91C7\u7528";
function normalizePath(value) {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  const slashed = trimmed.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  return slashed.length > 1 ? slashed.replace(/\/+$/, "") : slashed;
}
function isWslBash(value) {
  const path = normalizePath(value).toLowerCase();
  return /\/windows\/system32\/bash\.exe$/.test(path) || /\/windowsapps\/bash\.exe$/.test(path);
}
function candidateKindOf(value) {
  const path = normalizePath(value).toLowerCase();
  if (path.endsWith("/niu.exe") || path.includes("/niubash/")) return "niubash";
  if (path.includes("/msys64/") || path.includes("/msys32/") || path.includes("/msys2/")) return "msys2";
  if (path.includes("/cygwin")) return "cygwin";
  if (/(^|\/)(portable)?git(\/|$)/.test(path)) return "git";
  return "path";
}
function kindLabel(kind) {
  switch (kind) {
    case "git":
      return "Git for Windows";
    case "msys2":
      return "MSYS2";
    case "cygwin":
      return "Cygwin";
    case "niubash":
      return "Niubash\uFF08\u725B bash\uFF09";
    default:
      return "PATH";
  }
}
var KIND_RANK = { git: 0, msys2: 1, cygwin: 2, niubash: 3, path: 4 };
var DRIVE_LETTERS = "CDEFGHIJKLMNOPQRSTUVWXYZ";
function gitRootOf(entry) {
  const path = normalizePath(entry);
  if (path === "") return void 0;
  const lower = path.toLowerCase();
  for (const suffix of ["/mingw64/bin", "/mingw32/bin", "/usr/bin", "/cmd", "/bin"]) {
    if (lower.endsWith(suffix)) return path.slice(0, path.length - suffix.length);
  }
  return path;
}
function bashPathsUnder(root) {
  return [`${root}/bin/bash.exe`, `${root}/usr/bin/bash.exe`, `${root}/mingw64/bin/bash.exe`];
}
function unpreparedBashRoot(value) {
  const match = /^(.*)\/(usr|mingw32|mingw64)\/bin\/bash\.exe$/i.exec(normalizePath(value));
  return match?.[1];
}
function discoverBashCandidates(input) {
  const seen = /* @__PURE__ */ new Set();
  const excluded = [];
  const ordered = [];
  const dirsOf = (parent) => {
    if (input.listDirs === void 0) return [];
    try {
      return input.listDirs(parent);
    } catch {
      return [];
    }
  };
  const consider = (raw, label, isExplicit = false) => {
    const path = normalizePath(raw);
    if (path === "") return;
    if (isWslBash(path)) {
      if (!input.exists(path)) return;
      if (!excluded.some((item) => item.path.toLowerCase() === path.toLowerCase())) {
        excluded.push({ path, reason: WSL_REASON });
      }
      return;
    }
    if (!isExplicit) {
      const root = unpreparedBashRoot(path);
      if (root !== void 0 && input.exists(`${root}/bin/bash.exe`)) return;
    }
    const key = path.toLowerCase();
    if (seen.has(key)) return;
    if (!input.exists(path)) return;
    seen.add(key);
    const kind = candidateKindOf(path);
    ordered.push({ path, kind, label: label ?? kindLabel(kind), explicit: isExplicit });
  };
  const addGroup = (group) => {
    for (const root of group.roots) {
      if (root === "" || !input.exists(root)) continue;
      for (const path of bashPathsUnder(root)) consider(path, group.label);
    }
  };
  const explicitRaw = normalizePath(input.explicitPath ?? "");
  let explicit;
  if (explicitRaw !== "") {
    if (isWslBash(explicitRaw)) {
      explicit = { path: explicitRaw, state: "wsl" };
      if (input.exists(explicitRaw)) excluded.push({ path: explicitRaw, reason: WSL_REASON });
    } else if (input.exists(explicitRaw)) explicit = { path: explicitRaw, state: "ok" };
    else explicit = { path: explicitRaw, state: "missing" };
  }
  const entries = input.pathEntries.map((entry) => normalizePath(entry)).filter((entry) => entry !== "");
  const env = (name2) => {
    const value = input.env(name2);
    return value === void 0 || value === "" ? void 0 : normalizePath(value);
  };
  const programFiles = env("ProgramFiles") ?? "C:/Program Files";
  const programFilesX86 = env("ProgramFiles(x86)") ?? "C:/Program Files (x86)";
  const programW6432 = env("ProgramW6432");
  const localAppData = env("LOCALAPPDATA");
  const home = env("USERPROFILE") ?? env("HOME");
  const scoop = env("SCOOP") ?? (home === void 0 ? void 0 : `${home}/scoop`);
  const choco = env("ChocolateyInstall") ?? (env("ProgramData") === void 0 ? "C:/ProgramData/chocolatey" : `${env("ProgramData")}/chocolatey`);
  const versioned = [];
  if (localAppData !== void 0) {
    const desktop = `${localAppData}/GitHubDesktop`;
    for (const dir of [...dirsOf(desktop)].sort().reverse()) {
      if (dir.startsWith("app-")) versioned.push(`${desktop}/${dir}/resources/app/git`);
    }
    const github = `${localAppData}/GitHub`;
    for (const dir of [...dirsOf(github)].sort().reverse()) {
      if (dir.startsWith("PortableGit")) versioned.push(`${github}/${dir}`);
    }
  }
  const vsRoot = `${programFiles}/Microsoft Visual Studio`;
  for (const year of dirsOf(vsRoot)) {
    const yearRoot = `${vsRoot}/${year}`;
    for (const edition of dirsOf(yearRoot)) {
      versioned.push(`${yearRoot}/${edition}/Common7/IDE/CommonExtensions/Microsoft/TeamFoundation/Team Explorer/Git`);
    }
  }
  const drives = [];
  for (const letter of DRIVE_LETTERS) {
    const root = `${letter}:`;
    if (input.exists(`${root}/`)) drives.push(root);
  }
  const driveRoots = (names) => drives.flatMap((root) => names.map((name2) => `${root}/${name2}`));
  const groups = [
    // 2) PATH 上认出来的 git 根 —— 那才是用户实际在用的那份。
    ...entries.map((entry) => gitRootOf(entry)).filter((root) => root !== void 0).map((root) => ({ roots: [root] })),
    // 3) 官方安装器的两个默认落点 + 32 位 / 重定向后的 Program Files。
    { roots: [programFiles, programFilesX86, programW6432, localAppData === void 0 ? void 0 : `${localAppData}/Programs`].filter((base) => base !== void 0).map((base) => `${base}/Git`) },
    // 4) Scoop（`scoop install git` 会带一份 bash）。
    ...scoop === void 0 ? [] : [{ roots: [`${scoop}/apps/git/current`, `${scoop}/apps/git`], label: "Scoop \u7684 git" }],
    // 5) Chocolatey 的便携包（`git.install` 装的仍在 Program Files，上面那条已覆盖）。
    { roots: [`${choco}/lib/git.portable/tools`, `${choco}/lib/git.portable/tools/git`], label: "Chocolatey \u4FBF\u643A\u5305" },
    // 6) GitHub Desktop / 旧 GitHub for Windows / Visual Studio 自带（都带版本号，靠 listDirs）。
    { roots: versioned.filter((path) => path.includes("GitHubDesktop")), label: "GitHub Desktop \u5185\u5D4C" },
    { roots: versioned.filter((path) => path.includes("/GitHub/PortableGit")), label: "GitHub PortableGit" },
    { roots: versioned.filter((path) => path.includes("/Microsoft Visual Studio/")), label: "Visual Studio \u5185\u5D4C" },
    // 7) MSYS2 / Cygwin 的常见位置（含各盘符根下的同名目录）。
    { roots: [`${programFiles}/msys64`, "C:/msys64", ...driveRoots(["msys64"])], label: "MSYS2" },
    { roots: [`${programFiles}/cygwin64`, "C:/cygwin64", "C:/cygwin", ...driveRoots(["cygwin64", "cygwin"])], label: "Cygwin" },
    // 8) 各盘符根下的 Git / PortableGit（装在 D:\Git、D:\PortableGit 这类）。
    { roots: driveRoots(["Git", "Program Files/Git", "Program Files (x86)/Git"]), label: "Git for Windows" },
    { roots: driveRoots(["PortableGit"]), label: "PortableGit\uFF08\u81EA\u89E3\u538B\uFF09" }
  ];
  for (const group of groups) addGroup(group);
  if (localAppData !== void 0) consider(`${localAppData}/Programs/Niubash/niu.exe`, "Niubash\uFF08\u725B bash\uFF09");
  for (const entry of entries) consider(`${entry}/bash.exe`);
  if (explicit?.state === "ok") consider(explicit.path, void 0, true);
  const ranked = ordered.map((candidate, index) => ({ candidate, index })).sort((a, b) => {
    if (a.candidate.explicit !== b.candidate.explicit) return a.candidate.explicit ? -1 : 1;
    const rank = KIND_RANK[a.candidate.kind] - KIND_RANK[b.candidate.kind];
    return rank !== 0 ? rank : a.index - b.index;
  }).map((item) => item.candidate);
  return {
    candidates: ranked,
    excluded,
    ...explicit === void 0 ? {} : { explicit }
  };
}
function defaultBashPath(result) {
  return result.candidates[0]?.path ?? "";
}

// src/terminal/contracts.ts
var TERMINAL_MODE_FIELD = "terminalMode";
var TERMINAL_BASH_PATH_FIELD = "terminalBashPath";
var TERMINAL_CANDIDATES_FIELD = "terminalCandidates";
var TERMINAL_STATUS_FIELD = "terminalStatus";
var TERMINAL_EFFECTIVE_FIELD = "terminalEffective";
var DEFAULT_TERMINAL_MODE = "auto";
function terminalModeFrom(value) {
  return value === "auto" || value === "gitbash" || value === "pwsh" ? value : DEFAULT_TERMINAL_MODE;
}
function candidatesToStored(candidates) {
  return candidates.map((candidate) => ({
    path: candidate.path,
    label: candidate.label,
    kind: candidate.kind,
    explicit: candidate.explicit
  }));
}
function activeBashPath(mode, bashPath, candidates, explicitState) {
  if (mode === "pwsh") return "";
  const explicit = normalizePath(bashPath);
  if (explicit !== "" && (explicitState === void 0 || explicitState.state === "ok")) return explicit;
  return defaultBashPath({ candidates, excluded: [] });
}
function probeBash(explicitPath, pathValue, env, exists, listDirs) {
  return discoverBashCandidates({
    exists,
    pathEntries: pathValue.split(";"),
    env,
    explicitPath,
    ...listDirs === void 0 ? {} : { listDirs }
  });
}
function terminalStatusText(input) {
  const text = (() => {
    if (input.platform !== "win32") {
      return `\u672C\u63D2\u4EF6\u53EA\u5728 Windows \u4E0A\u63A5\u7BA1\u7EC8\u7AEF\uFF08\u5F53\u524D\u5E73\u53F0 ${input.platform}\uFF09\uFF0C\u6B64\u5904\u4E0D\u751F\u6548`;
    }
    if (input.mode === "pwsh") {
      return "\u4FDD\u6301 DSH \u9ED8\u8BA4\uFF08PowerShell\uFF09\u2014\u2014\u672C\u63D2\u4EF6\u4E0D\u4ECB\u5165\u7EC8\u7AEF\u5DE5\u5177\u9762";
    }
    if (input.probeFailed !== void 0 && input.probeFailed !== "") {
      return `\u5DF2\u542F\u7528\uFF0C\u4F46\u81EA\u68C0\u672A\u901A\u8FC7\uFF1A${input.probeFailed} \u2014\u2014 \u4E3A\u907F\u514D\u628A\u4F1A\u8BDD\u7684 shell \u6253\u6B7B\uFF0C\u6682\u4E0D\u63A5\u7BA1\uFF08\u4FDD\u6301 PowerShell\uFF09`;
    }
    if (input.effective === "bash") {
      const path = input.effectivePath ?? "";
      const candidate = input.candidates.find((item) => item.path === path);
      const suffix = input.explicit?.state === "missing" ? `\uFF08\u4F60\u586B\u7684\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF1A${input.explicit.path}\uFF09` : input.explicit?.state === "wsl" ? `\uFF08\u4F60\u586B\u7684\u662F WSL \u7684 bash\uFF1A${input.explicit.path}\uFF09` : "";
      return `\u5DF2\u751F\u6548\uFF1A${path}${candidate === void 0 ? "" : `\uFF08${candidate.label}\uFF09`}${suffix}`;
    }
    if (input.candidates.length === 0) {
      const excluded = input.excludedCount > 0 ? `\uFF08\u5DF2\u6392\u9664 ${input.excludedCount} \u4E2A WSL \u7684 bash.exe\uFF09` : "";
      return `\u6CA1\u627E\u5230\u53EF\u7528\u7684 bash${excluded}\uFF0C\u6682\u65F6\u4FDD\u6301 PowerShell`;
    }
    if (input.deliveryFailed === true) {
      return "\u627E\u5230\u4E86 bash \u4F46\u6CA1\u80FD\u6362\u4E0A\uFF08\u5DF2\u56DE\u6EDA\uFF0Cpwsh \u7167\u65E7\u53EF\u7528\uFF09\uFF0C\u6682\u65F6\u4FDD\u6301 PowerShell";
    }
    return `\u5019\u9009\u4E0D\u53EF\u7528\uFF0C\u6682\u65F6\u4FDD\u6301 PowerShell`;
  })();
  const failure = input.failure === void 0 || input.failure === "" ? "" : `\uFF1B\u4E0B\u53D1\u5931\u8D25\uFF1A${input.failure}`;
  return `${text}${failure}`.slice(0, 400);
}

// src/settings-contract.ts
var NAMESPACE = "composer-ux";
var RESTART_API_PATH = "/composer-ux/restart";
var ENABLED_FIELD = "enabled";
var KEYS_ENABLED_FIELD = "keysEnabled";
var MENU_ENABLED_FIELD = "menuEnabled";
var QUICK_ENABLED_FIELD = "quickEnabled";
var PANEL_ENABLED_FIELD = "panelEnabled";
var TERMINAL_ENABLED_FIELD = "terminalEnabled";
var SEND_KEY_FIELD = "sendKey";
var NEWLINE_KEY_FIELD = "newlineKey";
var PANEL_RESIZE_FIELD = "panelResize";
var PANEL_WIDTH_FIELD = "panelWidth";
var PANEL_HEIGHT_FIELD = "panelHeight";
var MENU_FIELDS = [
  "menuUndo",
  "menuRedo",
  "menuCut",
  "menuCopy",
  "menuPaste",
  "menuDelete",
  "menuSelectAll"
];
var MENU_MODE_FIELD = "menuMode";
var MENU_NATIVE_FIELD = "menuNative";
function menuModeFrom(storedMode, legacyNative) {
  if (storedMode === "official" || storedMode === "browser" || storedMode === "custom") return storedMode;
  if (legacyNative === true) return "browser";
  if (legacyNative === false) return "custom";
  return DEFAULT_SETTINGS.menuMode;
}
var QUICK_PROMPTS_FIELD = "quickPrompts";
var OPTIMIZER_TIER_FIELD = "optimizerTier";
var QUICK_PROMPT_MAX = 60;
var QUICK_CATEGORY_MAX = 20;
var QUICK_CATEGORY_NAME_MAX = 40;
var QUICK_LABEL_MAX = 40;
var QUICK_TEXT_MAX = 2e5;
var OPTIMIZE_TEXT_MAX = 8e3;
var QUICK_PROMPTS_API_PATH = "/composer-ux/prompts";
var QUICK_BOOK_VERSION = 2;
var DEFAULT_CATEGORY_NAME = "\u9ED8\u8BA4";
var OPTIMIZE_OUTPUT_MAX = 12e3;
var OPTIMIZER_API_PATH = "/composer-ux/optimize";
var OPTIMIZER_TIERS = [
  { id: "basic", label: "\u666E\u901A", hint: "\u53EA\u505A\u8BED\u8A00\u5C42\u4FEE\u590D\uFF1A\u75C5\u53E5\u3001\u9519\u522B\u5B57\u3001\u6307\u4EE3\u4E0E\u542B\u7CCA\u8BCD\uFF0C\u4E0D\u65B0\u589E\u4EFB\u4F55\u9700\u6C42\uFF0C\u7BC7\u5E45\u7EA6\u4E3A\u539F\u6587 1.4 \u500D\u3002" },
  { id: "advanced", label: "\u9AD8\u7EA7", hint: "\u5728\u4E0D\u52A8\u76EE\u6807\u7684\u524D\u63D0\u4E0B\uFF0C\u628A\u300C\u4F60\u663E\u7136\u60F3\u8981\u3001\u4F46\u6CA1\u8BF4\u51FA\u53E3\u300D\u7684\u5FC5\u8981\u8981\u6C42\u8865\u6210\u5BF9 AI \u7684\u8981\u6C42\uFF0C\u6BCF\u6761\u90FD\u8981\u6307\u56DE\u4F60\u539F\u8BDD\u91CC\u7684\u67D0\u4E00\u53E5\u3002" },
  { id: "extreme", label: "\u6781\u7AEF", hint: "\u6309\u590D\u6742\u4EFB\u52A1\u5904\u7406\uFF1A\u5728\u4E0A\u9762\u57FA\u7840\u4E0A\u518D\u52A0\u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212\u4E0E 2~4 \u79CD\u60C5\u51B5\u7684\u9884\u6848\u3002" }
];
var DEFAULT_OPTIMIZER_TIER = "advanced";
var OPTIMIZER_PROMPT_FIELDS = {
  basic: "optimizerPromptBasic",
  advanced: "optimizerPromptAdvanced",
  extreme: "optimizerPromptExtreme"
};
var OPTIMIZER_PROMPT_FIELD_LIST = OPTIMIZER_TIERS.map((item) => OPTIMIZER_PROMPT_FIELDS[item.id]);
function optimizerPromptFieldOf(tier) {
  return OPTIMIZER_PROMPT_FIELDS[tier] ?? OPTIMIZER_PROMPT_FIELDS[DEFAULT_OPTIMIZER_TIER];
}
var DEFAULT_QUICK_PROMPTS = [
  { id: "builtin-1", label: "\u4E00\u95EE\u4E00\u7B54", prompt: "\u4F60\u4E0D\u61C2\u7684\u5C31\u95EE\u6211\uFF0C\u4E00\u95EE\u4E00\u7B54\uFF1B\u540C\u65F6\u8BF4\u6E05\u695A\u4F60\u4E3A\u4EC0\u4E48\u8981\u95EE\u8BE5\u95EE\u9898\uFF1B\u76F4\u5230\u4F60\u5BF9\u6211\u7684\u76EE\u6807\u6709\u660E\u786E\u8BA4\u77E5\u540E\u518D\u5F00\u59CB\u5E72\u6D3B\u3002", always: false, firstOnly: false },
  { id: "builtin-2", label: "\u4EA4\u63A5\u6587\u6863", prompt: "\u628A\u8FD9\u6B21\u4EFB\u52A1\u3001\u5DF2\u5B8C\u6210\u5185\u5BB9\u3001\u5F53\u524D\u5361\u70B9\u3001\u4E0B\u4E00\u6B65\u8BA1\u5212\u3001\u8E29\u8FC7\u7684\u5751\uFF0C\u6574\u7406\u6210\u4E00\u4EFD\u4EA4\u63A5\u6587\u6863\uFF0C\u5199\u7ED9\u65B0\u4F1A\u8BDD\u770B\u3002", always: false, firstOnly: false },
  { id: "builtin-3", label: "\u4EC5\u8BF4\u660E\u539F\u56E0", prompt: "\u4EC5\u8BF4\u660E\u539F\u56E0\uFF0C\u4E0D\u8981\u505A\u5176\u4ED6\u52A8\u4F5C\u3002", always: false, firstOnly: false },
  { id: "builtin-4", label: "\u5206\u6790\u540E\u76F4\u63A5\u5E72", prompt: "\u5206\u6790\u539F\u56E0\uFF0C\u7136\u540E\u76F4\u63A5\u5F00\u59CB\u5E72\u6D3B\uFF0C\u4E0D\u9700\u8981\u8FC7\u95EE\u6211\u3002", always: false, firstOnly: false },
  { id: "builtin-5", label: "\u63D0\u4EA4\u4EE3\u7801", prompt: "\u8BF7\u5E2E\u6211\u63D0\u4EA4\u4EE3\u7801\uFF1A\u68C0\u67E5\u5F53\u524D git \u53D8\u66F4\uFF0C\u751F\u6210\u89C4\u8303\u7684 commit message \u5E76\u6267\u884C\u63D0\u4EA4\u3002", always: false, firstOnly: false },
  { id: "builtin-6", label: "\u7ED9\u65B9\u6848", prompt: "\u8BF7\u9488\u5BF9\u4E0A\u9762\u7684\u95EE\u9898\u7ED9\u51FA\u4E00\u4E2A\u5B8C\u6574\u65B9\u6848\uFF0C\u5305\u62EC\u601D\u8DEF\u3001\u6B65\u9AA4\u3001\u6CE8\u610F\u4E8B\u9879\u548C\u98CE\u9669\u3002", always: false, firstOnly: false },
  { id: "builtin-7", label: "\u89E3\u91CA\u4EE3\u7801", prompt: "\u8BF7\u89E3\u91CA\u8FD9\u6BB5\u4EE3\u7801\u7684\u4F5C\u7528\u548C\u5B9E\u73B0\u601D\u8DEF\u3002", always: false, firstOnly: false },
  { id: "builtin-8", label: "\u5199\u6D4B\u8BD5", prompt: "\u8BF7\u4E3A\u4E0B\u9762\u7684\u4EE3\u7801\u7F16\u5199\u5355\u5143\u6D4B\u8BD5\u3002", always: false, firstOnly: false },
  { id: "builtin-9", label: "\u4EE3\u7801\u5BA1\u67E5", prompt: "\u8BF7\u5BF9\u4E0B\u9762\u7684\u4EE3\u7801\u8FDB\u884C\u4EE3\u7801\u5BA1\u67E5\uFF0C\u6307\u51FA\u95EE\u9898\u5E76\u7ED9\u51FA\u6539\u8FDB\u5EFA\u8BAE\u3002", always: false, firstOnly: false }
];
function newQuickPromptId() {
  return `qp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function newQuickCategoryId() {
  return `qc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function defaultQuickBook() {
  return {
    version: QUICK_BOOK_VERSION,
    categories: [{ id: "cat-default", name: DEFAULT_CATEGORY_NAME, prompts: DEFAULT_QUICK_PROMPTS }]
  };
}
function asPromptRow(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const row = value;
  const either = (first, second) => {
    const picked = typeof first === "string" && first !== "" ? first : second;
    return typeof picked === "string" ? picked : "";
  };
  const prompt = either(row.prompt, row.text).slice(0, QUICK_TEXT_MAX).trim();
  if (prompt === "") return void 0;
  const label = either(row.label, row.title).slice(0, QUICK_LABEL_MAX).trim();
  const id = typeof row.id === "string" && row.id !== "" ? row.id.slice(0, 64) : newQuickPromptId();
  const order = typeof row.order === "number" && Number.isFinite(row.order) ? Math.max(1, Math.round(row.order)) : void 0;
  return {
    prompt: {
      id,
      label: label === "" ? prompt.slice(0, 12) : label,
      prompt,
      always: row.always === true || row.autoSend === true,
      firstOnly: row.firstOnly === true || row.autoSendFirst === true
    },
    order
  };
}
function toPromptList(values) {
  const rows = [];
  for (const value of values) {
    const row = asPromptRow(value);
    if (row !== void 0) rows.push({ ...row, index: rows.length });
  }
  rows.sort((a, b) => {
    const left = a.order ?? Number.MAX_SAFE_INTEGER;
    const right = b.order ?? Number.MAX_SAFE_INTEGER;
    return left === right ? a.index - b.index : left - right;
  });
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const row of rows) {
    if (out.length >= QUICK_PROMPT_MAX) break;
    if (seen.has(row.prompt.id)) continue;
    seen.add(row.prompt.id);
    out.push(row.prompt);
  }
  return out;
}
function sanitizeBook(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const source = value;
  const flat = Array.isArray(value) ? value : Array.isArray(source.prompts) ? source.prompts : void 0;
  if (flat !== void 0) {
    const prompts = toPromptList(flat);
    return {
      version: QUICK_BOOK_VERSION,
      categories: prompts.length === 0 ? [] : [{ id: "cat-default", name: DEFAULT_CATEGORY_NAME, prompts }]
    };
  }
  if (!Array.isArray(source.categories)) return void 0;
  const seen = /* @__PURE__ */ new Set();
  const categories = [];
  for (const raw of source.categories) {
    if (categories.length >= QUICK_CATEGORY_MAX) break;
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw;
    const prompts = toPromptList(Array.isArray(row.prompts) ? row.prompts : []);
    const wanted = typeof row.id === "string" && row.id !== "" ? row.id.slice(0, 64) : newQuickCategoryId();
    const id = seen.has(wanted) ? newQuickCategoryId() : wanted;
    seen.add(id);
    const name2 = (typeof row.name === "string" ? row.name : "").slice(0, QUICK_CATEGORY_NAME_MAX).trim();
    categories.push({ id, name: name2 === "" ? DEFAULT_CATEGORY_NAME : name2, prompts });
  }
  return { version: QUICK_BOOK_VERSION, categories };
}
function bookToFile(book) {
  return {
    version: QUICK_BOOK_VERSION,
    categories: book.categories.map((category) => ({
      id: category.id,
      name: category.name,
      prompts: category.prompts.map((prompt, index) => ({
        id: prompt.id,
        title: prompt.label,
        text: prompt.prompt,
        autoSend: prompt.always,
        // 「仅首次」是我们加的键，只在为真时写出来：文件形状尽量贴近参考实现。
        ...prompt.firstOnly ? { autoSendFirst: true } : {},
        order: index + 1
      }))
    }))
  };
}
var HEADER_ENABLED_FIELD = "headerEnabled";
var HEADER_NAME_FIELD = "headerName";
var HEADER_VALUE_FIELD = "headerValue";
var HEADER_ROUTES_FIELD = "headerRoutes";
var HEADER_APPLIED_NAME_FIELD = "headerAppliedName";
var HEADER_APPLIED_VALUE_FIELD = "headerAppliedValue";
var HEADER_STATUS_FIELD = "headerStatus";
var LLM_NAMESPACE = "llm-pi-ai";
var OPENCODE_ROUTE_PREFIX = "opencode";
var OPENCODE_HOSTS = ["opencode.ai"];
var DEFAULT_HEADER_NAME = "x-opencode-session";
var HEADER_VALUE_MAX = 200;
var HEADER_NAME_MAX = 64;
var DEFAULT_SETTINGS = {
  // 总开关默认开：它只是总闸，真正"要不要用这一栏"由下面五个开关决定（默认关）。
  enabled: true,
  // 五栏默认关（老文档由 sectionEnabledOf 迁移成"碰过就开"）。
  keysEnabled: false,
  menuEnabled: false,
  quickEnabled: false,
  panelEnabled: false,
  terminalEnabled: false,
  sendKey: "Enter",
  newlineKey: "Shift+Enter",
  menuUndo: true,
  menuRedo: true,
  menuCut: true,
  menuCopy: true,
  menuPaste: true,
  menuDelete: true,
  menuSelectAll: true,
  menuMode: "official",
  panelResize: true,
  headerEnabled: false,
  headerName: DEFAULT_HEADER_NAME,
  headerValue: "",
  headerRoutes: "",
  headerAppliedName: "",
  headerAppliedValue: "",
  headerStatus: "",
  quickPrompts: DEFAULT_QUICK_PROMPTS,
  optimizerTier: DEFAULT_OPTIMIZER_TIER,
  // 空串 = 用内置提示词。默认必须是空串：它同时就是「恢复内置」要写回去的值。
  optimizerPromptBasic: "",
  optimizerPromptAdvanced: "",
  optimizerPromptExtreme: "",
  terminalMode: DEFAULT_TERMINAL_MODE,
  terminalBashPath: "",
  terminalCandidates: [],
  terminalStatus: "",
  terminalEffective: ""
};
function newSessionId() {
  const bag = globalThis;
  if (typeof bag.crypto?.randomUUID === "function") return bag.crypto.randomUUID();
  const hex = (count) => Array.from(
    { length: count },
    () => Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}
function parseRouteList(text) {
  const parts = text.split(/[\s,，、]+/).map((item) => item.trim()).filter((item) => item !== "");
  return [...new Set(parts)];
}
var SECTION_SIGNALS = {
  [KEYS_ENABLED_FIELD]: (source) => touched(source, SEND_KEY_FIELD, DEFAULT_SETTINGS.sendKey) || touched(source, NEWLINE_KEY_FIELD, DEFAULT_SETTINGS.newlineKey),
  // 「官方」＝本插件不介入，等价于关；所以只有选过另外两档才算"碰过"。
  // （`menuModeFrom` 对"两个键都没有"给的就是 'official'，天然满足"缺省 = 默认"。）
  [MENU_ENABLED_FIELD]: (source) => menuModeFrom(source[MENU_MODE_FIELD], source[MENU_NATIVE_FIELD]) !== "official",
  [QUICK_ENABLED_FIELD]: (source) => Array.isArray(source[QUICK_PROMPTS_FIELD]) && source[QUICK_PROMPTS_FIELD].length !== DEFAULT_QUICK_PROMPTS.length || touched(source, OPTIMIZER_TIER_FIELD, DEFAULT_OPTIMIZER_TIER),
  [PANEL_ENABLED_FIELD]: (source) => touched(source, PANEL_RESIZE_FIELD, true) || source[PANEL_WIDTH_FIELD] !== void 0 || source[PANEL_HEIGHT_FIELD] !== void 0,
  [TERMINAL_ENABLED_FIELD]: (source) => touched(source, TERMINAL_MODE_FIELD, DEFAULT_TERMINAL_MODE) || touched(source, TERMINAL_BASH_PATH_FIELD, "")
};
function touched(source, field, untouched) {
  const value = source[field];
  return value !== void 0 && value !== untouched;
}
function sectionEnabledOf(field, source) {
  const explicit = source[field];
  if (typeof explicit === "boolean") return explicit;
  const signal = SECTION_SIGNALS[field];
  return signal === void 0 ? false : signal(source);
}

// src/terminal/host.ts
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, sep } from "node:path";

// src/terminal/sandbox.ts
var WIDER_MODES = {
  "read-only": ["workspace-write", "danger-full-access"],
  "workspace-write": ["danger-full-access"]
};
var ESCALATION_TARGETS = ["workspace-write", "danger-full-access"];
function sandboxDenialMarker(mode) {
  return `[sandbox: file access denied under ${mode} mode]`;
}
function escalationHintMarker(subject) {
  return `[sandbox: escalation available \u2014 retry this exact ${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`;
}
function validateEscalationArgs(sandboxPermissions, justification) {
  if (sandboxPermissions !== void 0 && justification === void 0) {
    throw new Error("invalid escalation: sandbox_permissions requires a justification");
  }
  if (justification !== void 0 && sandboxPermissions === void 0) {
    throw new Error("invalid escalation: justification is only valid together with sandbox_permissions");
  }
  if (justification !== void 0 && justification.trim().length === 0) {
    throw new Error("invalid justification: expected a non-empty sentence");
  }
}
async function approveEscalation(request, approval) {
  const { requestedMode: mode, effectiveMode, justification, subject } = request;
  if (mode === effectiveMode) return effectiveMode;
  if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode)) {
    throw new Error(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`);
  }
  if (approval.approver === void 0) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`);
  }
  if (approval.agent === void 0) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`);
  }
  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `escalate sandbox to ${mode}: ${justification}`,
    ...approval.signal === void 0 ? {} : { signal: approval.signal }
  });
  switch (outcome) {
    case "allowed-once":
      return mode;
    case "rejected":
      throw new Error(`the user rejected escalating this ${subject} to "${mode}"`);
    case "cancelled":
      throw new Error(`approval for escalating to "${mode}" was cancelled`);
    case "unavailable":
      throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`);
    default:
      throw new Error(`unexpected escalation outcome ${JSON.stringify(outcome)}`);
  }
}

// src/terminal/render.ts
function parseExitStatus(text) {
  const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text);
  if (signal?.[1] !== void 0) return { body: text.slice(0, signal.index), signal: signal[1] };
  const exit = /\n\[exit code: (\d+)\]$/.exec(text);
  if (exit?.[1] !== void 0) return { body: text.slice(0, exit.index), exitCode: Number(exit[1]) };
  return { body: text, exitCode: 0 };
}
function streamText(output) {
  if (!output.truncated) return output.text;
  return `${output.text}
[output truncated; full output: ${output.spillPath ?? "(unavailable)"}]`;
}
function renderBashResult(result, escalationModes = []) {
  const out = streamText(result.stdout);
  const err = streamText(result.stderr);
  let body = out;
  if (err.length > 0) {
    if (body.length > 0 && !body.endsWith("\n")) body += "\n";
    body += `[stderr]
${err}`;
  }
  if (body.length === 0) body = "(no output)";
  const markers = [];
  if (result.sandbox?.denied === true) {
    markers.push(sandboxDenialMarker(result.sandbox.mode));
    if (escalationModes.length > 0) markers.push(escalationHintMarker("command"));
  }
  if (result.timedOut) markers.push(`[timed out after ${result.timeoutMs}ms]`);
  if (result.signal !== null) markers.push(`[killed by signal: ${result.signal}]`);
  else if (result.exitCode !== 0) markers.push(`[exit code: ${result.exitCode}]`);
  if (markers.length === 0) return body;
  if (!body.endsWith("\n")) body += "\n";
  return body + markers.join("\n");
}
function renderProcessRead(read, sandbox, escalationModes = []) {
  const notices = [];
  if (read.lossy) {
    const paths = [read.stdoutSpillPath, read.stderrSpillPath].filter((path) => path !== void 0);
    notices.push(`[some output was dropped from memory; full output: ${paths.length > 0 ? paths.join(", ") : "(unavailable)"}]`);
  }
  if (sandbox?.runnerFailed === true) {
    notices.push(`[sandbox: the sandbox runner itself failed under ${sandbox.mode} mode \u2014 the command did not run; this is a sandbox problem, not a command failure]`);
  } else if (sandbox?.denied === true) {
    notices.push(sandboxDenialMarker(sandbox.mode));
    if (escalationModes.length > 0) notices.push(escalationHintMarker("command"));
  }
  if (notices.length === 0) return read.delta;
  const separator = read.delta.length > 0 && !read.delta.endsWith("\n") ? "\n" : "";
  return `${read.delta}${separator}${notices.join("\n")}`;
}

// src/terminal/tool.ts
var BASH_TOOL_NAME = "bash";
var TOOL_BASH_SECTION_ORDER = 1e3;
var BASH_SECTION_TEXT = "Check the [exit code: N] marker on every bash result; investigate failures before moving on.";
var DEFAULT_TIMEOUT_MS = 12e4;
var MAX_TIMEOUT_MS = 6e5;
var MAX_OUTPUT_BYTES = 64e3;
var MAX_SPILL_BYTES = 64 * 1024 * 1024;
var GRACE_MS = 3e3;
var TOOL_ABORTED = "ABORTED";
var ENV_OVERRIDES = {
  NO_COLOR: "1",
  TERM: "dumb",
  PAGER: "cat",
  GIT_PAGER: "cat"
};
function escalationModesOf(deps) {
  return deps.sandbox !== void 0 && deps.sandboxPolicy !== void 0 ? ESCALATION_TARGETS : [];
}
function bashDescription(backgroundEnabled, escalationModes) {
  const background = backgroundEnabled ? "Set `run_in_background: true` for long-running commands: the call returns a job id immediately; read its output with `job_output` and stop it with `job_kill`." : "Background execution is not available; long-running commands must finish within the timeout.";
  const base = "Execute a bash command (`bash -c`) and return its stdout/stderr. Each call runs in a fresh shell: no state (cwd, variables, functions) persists between calls \u2014 pass `workdir` instead of using `cd`. Non-zero exits are reported as `[exit code: N]`. Current harness environment facts are exposed through managed `$DSH_*` variables; inspect them when needed. Commands may run under a file sandbox; a blocked file operation is reported as `[sandbox: file access denied under <mode> mode]` \u2014 a policy denial, not a bug in the command; do not retry another way. Long output is truncated to its tail; the full output is saved to a file whose path is reported when available. " + background;
  if (escalationModes.length === 0) return base;
  return base + " Attempting a command the sandbox may deny is safe and expected: run it and read the marker rather than assuming the denial. When a command is denied and a wider mode would let it succeed, escalate immediately in the same turn \u2014 the one sanctioned exception to a denial: retry the exact same command once with `sandbox_permissions` (the narrowest wider mode that suffices) plus a one-sentence `justification`. Do not detour through chat to ask permission first \u2014 the approval prompt raised by that retry is how the user consents. If the session states approval prompts are disabled, there is no exception: a denial is final \u2014 do not set `sandbox_permissions`. Never escalate speculatively: ground the request in a real denial \u2014 normally the one this command just hit; escalating up front is fine only when this session already denied the same access. A rejected escalation is final for that command \u2014 stop and explain, never work around it \u2014 but it does not forbid attempting or escalating other commands later.";
}
function bashParameters(escalationModes) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      command: { type: "string", description: "The bash command to execute." },
      description: {
        type: "string",
        description: 'Clear, concise description of what this command does in active voice, 5-10 words (shown in the UI). Examples: "ls" \u2192 "List files in current directory"; "git status" \u2192 "Show working tree status"; "npm install" \u2192 "Install package dependencies".'
      },
      timeoutMs: {
        type: "number",
        description: "Timeout in milliseconds. The executor applies its configured default and cap, and kills the command on expiry."
      },
      workdir: {
        type: "string",
        description: "Working directory for this command. Defaults to the session workspace; a relative path is resolved against it."
      },
      ...escalationModes.length === 0 ? {} : {
        sandbox_permissions: {
          type: "string",
          enum: [...escalationModes],
          description: "The wider sandbox mode this command needs. Only valid as a one-shot retry of a command the sandbox just denied; requires justification and user approval."
        },
        justification: {
          type: "string",
          description: "Required with sandbox_permissions: one sentence for the user explaining why this exact command needs the wider access."
        }
      }
    },
    required: ["command", "description"]
  };
}
function bashOutputSchema() {
  const stream = {
    type: "object",
    additionalProperties: false,
    required: ["text", "truncated"],
    properties: {
      text: { type: "string" },
      truncated: { type: "boolean" },
      spillPath: { type: "string" }
    }
  };
  return {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "jobId"],
        properties: {
          kind: { type: "string", const: "background" },
          jobId: { type: "string" }
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "exitCode", "signal", "timedOut", "aborted", "timeoutMs", "stdout", "stderr"],
        properties: {
          kind: { type: "string", const: "foreground" },
          exitCode: { oneOf: [{ type: "integer" }, { type: "null" }] },
          signal: { oneOf: [{ type: "string" }, { type: "null" }] },
          timedOut: { type: "boolean" },
          aborted: { type: "boolean" },
          timeoutMs: { type: "number" },
          stdout: stream,
          stderr: stream,
          sandbox: {
            type: "object",
            additionalProperties: false,
            required: ["mode", "denied"],
            properties: {
              mode: { type: "string" },
              denied: { type: "boolean" },
              enforcement: { type: "string" },
              runnerFailed: { type: "boolean" }
            }
          }
        }
      }
    ]
  };
}
function clampTimeout(requested, min, max) {
  if (requested === void 0 || !Number.isFinite(requested) || requested <= 0) return min;
  return Math.min(Math.max(requested, min), max);
}
function resolveWorkdir(modelWorkdir, exec, policyWorkspaceRoot, sep2, isAbsolute2) {
  const headerCwd = exec.agent?.session.header.cwd;
  const sessionCwd = policyWorkspaceRoot ?? headerCwd;
  if (modelWorkdir === void 0) return sessionCwd;
  if (sessionCwd !== void 0 && !isAbsolute2(modelWorkdir)) return `${sessionCwd}${sep2}${modelWorkdir}`;
  return modelWorkdir;
}
function abortedError() {
  const error = new Error("tool call aborted");
  error.name = "AbortError";
  error.code = TOOL_ABORTED;
  return error;
}
function createBashTool(deps, options) {
  const escalationModes = escalationModesOf(deps);
  const sep2 = options.sep ?? "\\";
  const isAbsolute2 = options.isAbsolute ?? ((path) => /^([a-zA-Z]:[\\/]|[\\/])/.test(path));
  const electron = options.electron ?? process.versions.electron !== void 0;
  const minTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTimeout = options.maxTimeoutMs ?? MAX_TIMEOUT_MS;
  const spawnSpec = (argv, cwd, dshEnv, signal) => ({
    argv,
    cwd,
    stdio: {
      stdin: "ignore",
      stdout: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_SPILL_BYTES } },
      stderr: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_SPILL_BYTES } }
    },
    graceMs: GRACE_MS,
    ...signal === void 0 ? {} : { signal },
    // dshEnv 必须显式带上：subprocess 会先按凭据形状清洗父环境（含清掉所有 DSH_*）。
    env: {
      ...ENV_OVERRIDES,
      ...dshEnv,
      // ⚠️ 打包形态（Electron 桌面版）下必须补这一项。Windows 上受限模式的沙箱 runner
      // 的 argv[0] 是 `process.execPath`（`dsh-sandbox-local/lib/index.js:539`），桌面版里
      // 那就是 `DeepSeek Harness.exe`；而用 Electron 跑 JS 脚本**必须**带
      // `ELECTRON_RUN_AS_NODE=1`，否则它按 App 形态启动、原生初始化就失败
      // （2026-09-25 实测：零输出 / 0xC0000142）。官方 `sandbox-local` 只返回 argv、不带 env，
      // 所以这一项只能由 **spawn 方**补齐。对 `bash.exe` 本身无副作用（它不认这个变量）。
      ...electron ? { ELECTRON_RUN_AS_NODE: "1" } : {}
    }
  });
  const readFrame = (handle, offsets) => {
    const outRead = handle.collected.stdout?.readFrom(offsets.stdout);
    const errRead = handle.collected.stderr?.readFrom(offsets.stderr);
    offsets.stdout = outRead?.nextOffset ?? offsets.stdout;
    offsets.stderr = errRead?.nextOffset ?? offsets.stderr;
    const outText = outRead?.text ?? "";
    const errText = errRead?.text ?? "";
    const separator = outText.length > 0 && !outText.endsWith("\n") ? "\n" : "";
    return {
      delta: outText + (errText.length > 0 ? `${separator}[stderr]
${errText}` : ""),
      lossy: (outRead?.lossy ?? false) || (errRead?.lossy ?? false),
      ...outRead?.spillPath === void 0 ? {} : { stdoutSpillPath: outRead.spillPath },
      ...errRead?.spillPath === void 0 ? {} : { stderrSpillPath: errRead.spillPath }
    };
  };
  const execute = async (rawArgs, exec) => {
    const args = rawArgs;
    if (args.command.trim().length === 0) throw new Error("invalid command: expected a non-empty string");
    if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
    if (args.timeoutMs !== void 0 && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
      throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`);
    }
    validateEscalationArgs(args.sandbox_permissions, args.justification);
    const standingPolicy = deps.sandboxPolicy?.resolve(
      exec.agent === void 0 ? {} : { session: exec.agent.session }
    );
    const approvedMode = args.sandbox_permissions !== void 0 && args.justification !== void 0 ? await approveEscalation(
      {
        requestedMode: args.sandbox_permissions,
        justification: args.justification,
        effectiveMode: standingPolicy.mode,
        subject: "command"
      },
      {
        approver: deps.approval,
        agent: exec.agent,
        callId: exec.callId,
        toolName: BASH_TOOL_NAME,
        signal: exec.signal
      }
    ) : void 0;
    const policy = approvedMode === void 0 ? standingPolicy : { ...standingPolicy, mode: approvedMode };
    const workdir = resolveWorkdir(args.workdir, exec, standingPolicy?.workspaceRoot, sep2, isAbsolute2);
    const dshEnv = deps.shellEnv?.collect(exec) ?? {};
    let argv = [options.bashPath, "-c", args.command];
    let confined;
    if (policy !== void 0 && policy.mode !== "danger-full-access" && deps.sandbox !== void 0) {
      confined = await deps.sandbox.confine(argv, { ...policy, mode: policy.mode });
      argv = confined.argv;
    }
    const timeoutMs = clampTimeout(args.timeoutMs, minTimeout, maxTimeout);
    if (args.run_in_background === true) {
      const jobs = deps.jobs;
      if (jobs === void 0) {
        throw new Error("background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs");
      }
      if (exec.signal.aborted) throw abortedError();
      const id = jobs.start({
        kind: "bash",
        label: args.command,
        ...exec.agent === void 0 ? {} : { owner: exec.agent },
        run: () => {
          const controller2 = new AbortController();
          let handle2;
          const offsets = { stdout: 0, stderr: 0 };
          const done = (async () => {
            try {
              handle2 = deps.subprocess.spawn(spawnSpec(argv, workdir ?? process.cwd(), dshEnv, controller2.signal));
              if (controller2.signal.aborted) handle2.terminate();
              const outcome = await handle2.done;
              if (controller2.signal.aborted) {
                return {
                  status: "killed",
                  detail: outcome.signal !== null ? `signal: ${outcome.signal}` : "killed before exit"
                };
              }
              return { status: "completed", detail: `exit code: ${outcome.exitCode ?? 0}` };
            } catch (error) {
              return {
                status: controller2.signal.aborted && handle2 === void 0 ? "killed" : "failed",
                detail: error instanceof Error ? error.message : String(error)
              };
            }
          })();
          return {
            cancel: () => {
              if (controller2.signal.aborted) return;
              controller2.abort();
              handle2?.terminate();
            },
            done,
            readOutput: () => handle2 === void 0 ? "" : renderProcessRead(readFrame(handle2, offsets), void 0, escalationModes)
          };
        }
      });
      return { kind: "background", jobId: id };
    }
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => {
      controller.abort();
    };
    exec.signal.addEventListener("abort", onAbort);
    let handle;
    try {
      handle = deps.subprocess.spawn(spawnSpec(argv, workdir ?? process.cwd(), dshEnv, controller.signal));
    } catch (error) {
      clearTimeout(timer);
      exec.signal.removeEventListener("abort", onAbort);
      throw error;
    }
    const onControllerAbort = () => {
      try {
        handle?.terminate();
      } catch {
      }
    };
    controller.signal.addEventListener("abort", onControllerAbort);
    try {
      const outcome = await handle.done;
      const read = readFrame(handle, { stdout: 0, stderr: 0 });
      const aborted = exec.signal.aborted && !timedOut;
      const denied = confined !== void 0 && outcome.exitCode !== 0 && confined.denialSignatures.some((signature) => read.delta.toLowerCase().includes(signature.toLowerCase()));
      const result = {
        exitCode: outcome.exitCode,
        signal: outcome.signal,
        timedOut,
        aborted,
        timeoutMs,
        stdout: { text: read.delta, truncated: read.lossy, ...read.stdoutSpillPath === void 0 ? {} : { spillPath: read.stdoutSpillPath } },
        stderr: { text: "", truncated: false },
        ...denied ? { sandbox: { mode: policy?.mode ?? "read-only", denied: true } } : {}
      };
      if (aborted) throw abortedError();
      return { kind: "foreground", ...result };
    } finally {
      clearTimeout(timer);
      exec.signal.removeEventListener("abort", onAbort);
      controller.signal.removeEventListener("abort", onControllerAbort);
    }
  };
  return {
    name: BASH_TOOL_NAME,
    description: bashDescription(true, escalationModes),
    parameters: bashParameters(escalationModes),
    output: {
      schema: bashOutputSchema(),
      render: (_args, value) => {
        const v = value;
        const text = v.kind === "background" ? `started background job ${v.jobId}` : renderBashResult(v, escalationModes);
        return [{ type: "text", text }];
      }
    },
    execute,
    presentCall: (args) => {
      const a = args;
      if (a.run_in_background === true) {
        return {
          card: "generic",
          title: a.command,
          kind: "execute",
          rawInput: a.command,
          content: [{ type: "text", text: a.description }]
        };
      }
      return {
        card: "terminal",
        title: a.command,
        description: a.description,
        ...a.workdir === void 0 ? {} : { cwd: a.workdir }
      };
    },
    presentResult: (args, result) => {
      const block = result.content.length === 1 ? result.content[0] : void 0;
      if (block === void 0 || block.type !== "text") return void 0;
      const raw = block.text;
      const isBackground = typeof args === "object" && args !== null && args.run_in_background === true;
      if (isBackground || result.isError) {
        return { card: "generic", content: [{ type: "text", text: `\`\`\`console
${raw.replace(/\n+$/, "")}
\`\`\`` }] };
      }
      const { body, ...exit } = parseExitStatus(raw);
      return { card: "terminal", output: body, ...exit };
    }
  };
}
var PROBE_COMMAND = "printf %s dsh-composer-ux-probe-ok";
var PROBE_MARKER = "dsh-composer-ux-probe-ok";
var PROBE_TIMEOUT_MS = 8e3;
function formatProbeExit(exitCode) {
  if (exitCode === null) return "null\uFF08\u88AB\u4FE1\u53F7\u7ED3\u675F\uFF09";
  if (exitCode < 0 || exitCode >= 2147483648) {
    const unsigned = exitCode < 0 ? exitCode + 4294967296 : exitCode;
    return `0x${unsigned.toString(16).toUpperCase()}\uFF08${unsigned}\uFF09`;
  }
  return String(exitCode);
}
async function probeBashExecution(deps, options, exec) {
  const probeDeps = deps.shellEnv === void 0 ? deps : {
    ...deps,
    shellEnv: {
      collect: (ctx) => {
        try {
          return deps.shellEnv?.collect(ctx) ?? {};
        } catch {
          return {};
        }
      }
    }
  };
  try {
    const tool = createBashTool(probeDeps, { ...options, timeoutMs: PROBE_TIMEOUT_MS, maxTimeoutMs: PROBE_TIMEOUT_MS });
    const result = await tool.execute(
      { command: PROBE_COMMAND, description: "composer-ux terminal self-check", timeoutMs: PROBE_TIMEOUT_MS },
      exec
    );
    if (result?.kind !== "foreground") return { ok: false, detail: "\u81EA\u68C0\u6CA1\u6709\u8D70\u524D\u53F0\u6267\u884C\u8DEF\u5F84" };
    if (result.timedOut === true) return { ok: false, detail: `\u81EA\u68C0\u8D85\u65F6\uFF08${PROBE_TIMEOUT_MS}ms\uFF09` };
    const text = result.stdout?.text ?? "";
    const exit = result.exitCode ?? 0;
    if (exit !== 0) {
      return {
        ok: false,
        detail: `\u81EA\u68C0\u547D\u4EE4\u9000\u51FA\u7801 ${formatProbeExit(exit)}${text.trim() === "" ? "\uFF08\u96F6\u8F93\u51FA\uFF09" : ""}`
      };
    }
    if (!text.includes(PROBE_MARKER)) return { ok: false, detail: "\u81EA\u68C0\u6CA1\u62FF\u5230\u9884\u671F\u8F93\u51FA\uFF08\u547D\u4EE4\u6CA1\u771F\u6B63\u8DD1\u8D77\u6765\uFF09" };
    return { ok: true, detail: "" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

// src/terminal/host.ts
var TERMINAL_OFF_TEXT = "\u672A\u542F\u7528\uFF1A\u6253\u5F00\u8FD9\u4E00\u680F\u7684\u5F00\u5173\u540E\u624D\u4F1A\u63A5\u7BA1\uFF08\u73B0\u5728\u4FDD\u6301 PowerShell\uFF09";
function objectOf(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function textOf(value) {
  return typeof value === "string" ? value : "";
}
function errorText(error) {
  return error instanceof Error && error.message !== "" ? error.message : String(error);
}
function installTerminalPolicy(ctx, namespace, settings, readToolDeps, options = {}) {
  const platform = options.platform ?? process.platform;
  const isWindows = platform === "win32";
  const existsFn = options.exists ?? existsSync;
  const installed = /* @__PURE__ */ new Map();
  let lastStatus = "";
  let lastEffective = "";
  let lastCandidates = "";
  let failure = "";
  let lastDeliveryFailure = "";
  let busy = false;
  let again = false;
  let probeKey = "";
  let probeOutcome;
  const discover = options.discover ?? ((explicitPath) => probeBash(
    explicitPath,
    process.env.PATH ?? "",
    (name2) => process.env[name2],
    (path) => existsFn(path),
    // 只读子目录名（带版本号的来源：GitHub Desktop 的 app-*、旧 GitHub 的 PortableGit_*、VS 的年份/版本）；
    // 目录不存在或没权限一律当空，探测就退化成纯存在性检查。
    (parent) => {
      try {
        return readdirSync(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      } catch {
        return [];
      }
    }
  ));
  const install = (agent, bashPath) => {
    const scoped = agent.ctx;
    const cleanups = [];
    const notes = [];
    const skips = [];
    try {
      const lift = scoped.tools?.restrict({ deny: ["pwsh"] });
      if (typeof lift === "function") cleanups.push(lift);
    } catch (error) {
      skips.push(`restrict(pwsh) \u8DF3\u8FC7\uFF1A${errorText(error)}`);
    }
    let registered = false;
    try {
      const deps = readToolDeps();
      if (deps === void 0) {
        notes.push("\u5BBF\u4E3B\u6CA1\u6709 subprocess \u670D\u52A1\uFF0C\u65E0\u6CD5\u6CE8\u518C bash");
      } else {
        const definition = createBashTool(deps, { bashPath, sep, isAbsolute });
        const unregister = scoped.tools?.register(definition);
        if (typeof unregister === "function") {
          cleanups.push(unregister);
          registered = true;
        } else {
          notes.push("tools.register \u6CA1\u6709\u8FD4\u56DE disposer\uFF08\u8FD9\u4E00\u7248\u7684\u6CE8\u518C\u9762\u4E0D\u53EF\u7528\uFF09");
        }
      }
    } catch (error) {
      notes.push(`\u6CE8\u518C bash \u5931\u8D25\uFF1A${errorText(error)}`);
    }
    try {
      const bashSection = scoped.systemPrompt?.section({
        name: "tool:bash",
        order: TOOL_BASH_SECTION_ORDER,
        text: BASH_SECTION_TEXT
      });
      if (typeof bashSection === "function") cleanups.push(bashSection);
      const dropPwsh = scoped.on?.("system-prompt/assemble", (async (_assembly, _context, next) => {
        const assembly = await next();
        return { ...assembly, sections: assembly.sections.filter((section) => section.name !== "tool:pwsh") };
      }));
      if (typeof dropPwsh === "function") cleanups.push(dropPwsh);
    } catch (error) {
      notes.push(`\u63D0\u793A\u8BCD\u6BB5\u5931\u8D25\uFF1A${errorText(error)}`);
    }
    if (!registered) {
      for (const cleanup of [...cleanups].reverse()) {
        try {
          cleanup();
        } catch {
        }
      }
      lastDeliveryFailure = notes.length === 0 ? "bash \u5DE5\u5177\u6CA1\u6709\u6CE8\u518C\u4E0A" : notes.join("\uFF1B");
      return void 0;
    }
    return {
      path: bashPath,
      dispose: () => {
        for (const cleanup of [...cleanups].reverse()) {
          try {
            cleanup();
          } catch {
          }
        }
      },
      ...notes.length === 0 ? {} : { failure: notes.join("\uFF1B") },
      ...skips.length === 0 ? {} : { skipped: skips.join("\uFF1B") }
    };
  };
  const confinedModeOf = (deps, agent) => {
    if (deps?.sandbox === void 0 || deps.sandboxPolicy === void 0) return "";
    try {
      const session = agent?.session;
      const mode = deps.sandboxPolicy.resolve(session === void 0 ? {} : { session }).mode;
      return mode === "read-only" || mode === "workspace-write" ? mode : "";
    } catch {
      return "";
    }
  };
  const runProbe = async (deps, bashPath, mode, agent) => {
    const key = `${bashPath}|${mode}`;
    if (probeOutcome !== void 0 && probeKey === key) return probeOutcome;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, PROBE_TIMEOUT_MS * 2);
    try {
      probeOutcome = await (options.probe ?? probeBashExecution)(
        deps,
        { bashPath, sep, isAbsolute },
        {
          callId: "composer-ux-self-check",
          signal: controller.signal,
          ...agent === void 0 ? {} : { agent }
        }
      );
    } catch (error) {
      probeOutcome = { ok: false, detail: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
    probeKey = key;
    return probeOutcome;
  };
  const reconcile = () => {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    void (async () => {
      const row = settings === void 0 ? void 0 : objectOf(settings.get(namespace));
      const mode = terminalModeFrom(row?.[TERMINAL_MODE_FIELD]);
      const explicit = textOf(row?.[TERMINAL_BASH_PATH_FIELD]);
      const agents = ctx.get("agents");
      const ops = [];
      const sectionOn = row?.["enabled"] !== false && sectionEnabledOf(TERMINAL_ENABLED_FIELD, row ?? {});
      if (!isWindows) {
        for (const entry of installed.values()) entry.dispose();
        installed.clear();
        failure = "";
        writeState(ops, {
          status: terminalStatusText({ platform, mode, candidates: [], excludedCount: 0, effective: "unsupported" }),
          effective: "unsupported",
          candidates: []
        });
        await flush(ops);
        return;
      }
      if (!sectionOn) {
        for (const entry of installed.values()) entry.dispose();
        installed.clear();
        failure = "";
        writeState(ops, { status: TERMINAL_OFF_TEXT, effective: "pwsh", candidates: [] });
        await flush(ops);
        return;
      }
      const found = discover(explicit);
      const candidates = candidatesToStored(found.candidates);
      const bashPath = activeBashPath(mode, explicit, candidates, found.explicit);
      const usable = bashPath !== "" && existsFn(bashPath);
      let probeFailure = "";
      if (usable) {
        const probeDeps = readToolDeps();
        lastDeliveryFailure = "";
        for (const agent of agents?.list() ?? []) {
          const confinedMode = probeDeps === void 0 ? "" : confinedModeOf(probeDeps, agent);
          if (confinedMode !== "") {
            const probe = await runProbe(probeDeps, bashPath, confinedMode, agent);
            if (!probe.ok) {
              probeFailure = `${probe.detail}\uFF1B\u53D7\u9650\u6A21\u5F0F ${confinedMode}`;
              const current2 = installed.get(agent);
              if (current2 !== void 0) {
                current2.dispose();
                installed.delete(agent);
              }
              continue;
            }
          }
          const current = installed.get(agent);
          if (current !== void 0 && current.path === bashPath) continue;
          if (current !== void 0) {
            current.dispose();
            installed.delete(agent);
          }
          const record = install(agent, bashPath);
          if (record !== void 0) installed.set(agent, record);
        }
        if (probeFailure !== "") lastDeliveryFailure = probeFailure;
      } else {
        for (const entry of installed.values()) entry.dispose();
        installed.clear();
        failure = "";
      }
      const firstFailure = [...installed.values()].find((entry) => entry.failure !== void 0)?.failure;
      const delivered = usable && firstFailure === void 0 && lastDeliveryFailure === "";
      const failureText = firstFailure ?? (lastDeliveryFailure === "" ? failure : lastDeliveryFailure);
      writeState(ops, {
        status: terminalStatusText({
          platform,
          mode,
          candidates,
          excludedCount: found.excluded.length,
          ...found.explicit === void 0 ? {} : { explicit: found.explicit },
          effective: delivered ? "bash" : "pwsh",
          ...delivered ? { effectivePath: bashPath } : {},
          // 自检没过时优先用那条更准确的说法（"预检就没过、根本没试"），
          // 而不是泛泛的"找到了 bash 但没能换上"。
          ...delivered ? {} : probeFailure === "" ? { deliveryFailed: true } : { probeFailed: probeFailure },
          ...failureText === "" ? {} : { failure: failureText }
        }),
        effective: delivered ? "bash" : "pwsh",
        candidates
      });
      await flush(ops);
    })().catch((error) => {
      console.error("[composer-ux] \u7EC8\u7AEF\u7B56\u7565\u4E0B\u53D1\u5931\u8D25", error);
    }).finally(() => {
      busy = false;
      if (again) {
        again = false;
        reconcile();
      }
    });
  };
  const writeState = (ops, next) => {
    const candidatesJson = JSON.stringify(next.candidates);
    if (next.status !== lastStatus) {
      lastStatus = next.status;
      ops.push({ op: "set", path: [TERMINAL_STATUS_FIELD], value: next.status });
    }
    if (next.effective !== lastEffective) {
      lastEffective = next.effective;
      ops.push({ op: "set", path: [TERMINAL_EFFECTIVE_FIELD], value: next.effective });
    }
    if (candidatesJson !== lastCandidates) {
      lastCandidates = candidatesJson;
      ops.push({ op: "set", path: [TERMINAL_CANDIDATES_FIELD], value: next.candidates });
    }
  };
  const flush = async (ops) => {
    if (ops.length === 0 || settings === void 0) return;
    try {
      await settings.mutate(namespace, ops);
    } catch (error) {
      console.error("[composer-ux] \u7EC8\u7AEF\u72B6\u6001\u5199\u5165\u5931\u8D25", error);
    }
  };
  if (typeof ctx.on !== "function") {
    failure = "\u4E0A\u4E0B\u6587\u4E0D\u652F\u6301\u4E8B\u4EF6\uFF0C\u65E0\u6CD5\u5728\u4F1A\u8BDD\u521B\u5EFA\u65F6\u4E0B\u53D1";
  }
  ctx.on?.("agent/created", (() => {
    reconcile();
  }));
  ctx.on?.("agent/disposed", ((payload) => {
    if (payload?.agent !== void 0) installed.delete(payload.agent);
  }));
  if (settings !== void 0) ctx.on?.("settings/updated", (() => {
    reconcile();
  }));
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/composer-ux/terminal",
    handler: async (req, res) => {
      const send = (code, payload) => {
        res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(payload));
      };
      const connection = ctx.get("connection");
      const rejection = connection?.requestRejection?.(req);
      if (rejection !== void 0) {
        res.statusCode = rejection;
        res.end();
        return;
      }
      const method = (req.method ?? "GET").toUpperCase();
      const row = settings === void 0 ? void 0 : objectOf(settings.get(namespace));
      const mode = terminalModeFrom(row?.[TERMINAL_MODE_FIELD]);
      const explicit = textOf(row?.[TERMINAL_BASH_PATH_FIELD]);
      if (method === "POST") {
        reconcile();
        const found2 = discover(explicit);
        send(200, {
          ok: true,
          candidates: candidatesToStored(found2.candidates),
          excluded: found2.excluded,
          ...found2.explicit === void 0 ? {} : { explicit: found2.explicit }
        });
        return;
      }
      const found = discover(explicit);
      send(200, {
        ok: true,
        platform,
        supported: isWindows,
        mode,
        bashPath: explicit,
        effective: lastEffective === "" ? "pwsh" : lastEffective,
        status: lastStatus,
        candidates: isWindows ? candidatesToStored(found.candidates) : [],
        excluded: found.excluded
      });
    }
  }), "composer-ux: terminal status route");
  reconcile();
  return;
}

// src/restart.ts
var RESTART_POLL_MS = 250;
var RESTART_PORT_WAIT_MS = 3e4;
var RESTART_PORT_SETTLE_MS = 300;
var RESTART_EXIT_DELAY_MS = 500;
var RESTART_REPLACEMENT_WAIT_MS = 2e4;
var RESTART_PROBE_TIMEOUT_MS = 500;
var RESTART_NO_PORT_DELAY_MS = 1500;
var RESTART_HELPER_LINGER_MS = 3e3;
var RESTART_STOP_FALLBACK_MS = 1e4;
var RESTART_LOG_PREFIX = "composer-ux-restart-";
function nodeExecutableOf(input) {
  const { argv0, execPath, exists } = input;
  if (argv0 !== void 0 && argv0 !== "" && isAbsolutePath(argv0) && exists(argv0)) return argv0;
  return execPath;
}
function isAbsolutePath(value) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}
function launchCommand(facts) {
  const { argv1, execArgv, rest, cwd, platform, resolve: resolve3, dirname: dirname4 } = facts;
  if (argv1 !== void 0 && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(argv1)) {
    const absolute = resolve3(argv1);
    return { file: facts.node, args: [...execArgv, absolute, ...rest], cwd: dirname4(absolute), viaShell: false };
  }
  return { file: "dsh", args: [...rest], cwd, viaShell: platform === "win32" };
}
function quotePowerShell(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
function respawnCommand(launch, platform) {
  if (platform !== "win32") {
    return { file: launch.file, args: launch.args, viaShell: launch.viaShell, detached: true };
  }
  const file = launch.viaShell && !/\.(?:cmd|bat)$/iu.test(launch.file) ? `${launch.file}.cmd` : launch.file;
  return {
    file: "powershell.exe",
    args: [
      "-NoProfile",
      "-WindowStyle",
      "Hidden",
      "-Command",
      [`& ${quotePowerShell(file)}`, ...launch.args.map(quotePowerShell)].join(" ")
    ],
    viaShell: false,
    detached: false
  };
}
function servingPort(hostHeader) {
  if (hostHeader === void 0) return null;
  const match = /:(\d{1,5})$/u.exec(hostHeader);
  if (match === null) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}
function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
function trustedRestartRequest(request) {
  if (!isLoopbackAddress(request.remoteAddress)) return false;
  const headers = request.headers;
  if (headers.forwarded !== void 0 || headers["x-forwarded-for"] !== void 0 || headers["x-real-ip"] !== void 0) return false;
  const origin = firstHeader(headers.origin);
  const host = firstHeader(headers.host);
  if (origin === void 0 || host === void 0) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === host;
  } catch {
    return false;
  }
}
function firstHeader(value) {
  if (value === void 0) return void 0;
  return typeof value === "string" ? value : value[0];
}
var INSPECT_ARG_PREFIXES = ["--inspect", "--inspect-brk", "--inspect-port", "--inspect-wait"];
function tokenHasInspectFlag(token) {
  for (const prefix of INSPECT_ARG_PREFIXES) {
    if (token === prefix || token.startsWith(`${prefix}=`)) return true;
  }
  if (token === "--debug-brk" || token.startsWith("--debug-brk=")) return true;
  if (token === "--debug" || token.startsWith("--debug=")) return true;
  return false;
}
function detectedDebugger(input) {
  const { inspectorUrl, execArgv, nodeOptions } = input;
  if (inspectorUrl !== void 0 && inspectorUrl !== "") return "inspector";
  if (execArgv.some(tokenHasInspectFlag)) return "inspector";
  const options = (nodeOptions ?? "").trim();
  if (options !== "" && options.split(/\s+/u).some(tokenHasInspectFlag)) return "inspector";
  return null;
}
function detectedSupervisor(input) {
  const set2 = (name2) => (input.env[name2] ?? "") !== "";
  if (!set2("INVOCATION_ID") && !set2("JOURNAL_STREAM")) return null;
  if (input.ppid === 1 || input.parentComm(input.ppid) === "systemd") return "systemd";
  return null;
}
function restartHelperSource(input) {
  const { spawned, cwd, logs, port } = input;
  return [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    "const net = require('node:net')",
    `const file = ${JSON.stringify(spawned.file)}`,
    `const args = ${JSON.stringify(spawned.args)}`,
    `const cwd = ${JSON.stringify(cwd)}`,
    `const viaShell = ${JSON.stringify(spawned.viaShell)}`,
    `const detached = ${JSON.stringify(spawned.detached)}`,
    `const logOut = ${JSON.stringify(logs.out)}`,
    `const logErr = ${JSON.stringify(logs.err)}`,
    `const port = ${JSON.stringify(port)}`,
    `const pollMs = ${String(RESTART_POLL_MS)}`,
    `const portWaitMs = ${String(RESTART_PORT_WAIT_MS)}`,
    `const settleMs = ${String(RESTART_PORT_SETTLE_MS)}`,
    `const probeMs = ${String(RESTART_PROBE_TIMEOUT_MS)}`,
    `const noPortDelayMs = ${String(RESTART_NO_PORT_DELAY_MS)}`,
    `const lingerMs = ${String(RESTART_HELPER_LINGER_MS)}`,
    `const replacementWaitMs = ${String(RESTART_REPLACEMENT_WAIT_MS)}`,
    "const sleep = (ms) => new Promise(r => setTimeout(r, ms))",
    // 失败必须留证据，而且这些行只能在"宿主已经退出"之后写 —— 所以由助手写。
    "const note = (line) => { try { fs.appendFileSync(logErr, '[dsh-composer-ux] ' + line + '\\n') } catch {} }",
    // "空闲" = 没人接受连接。用 connect 探而不是 bind：bind 一下自己就把端口占住了，
    // 而那正是替换进程马上要用的东西。
    "const listening = () => new Promise((resolve) => {",
    '  const probe = net.connect({ host: "127.0.0.1", port })',
    "  const done = (value) => { probe.destroy(); resolve(value) }",
    '  probe.on("connect", () => done(true))',
    '  probe.on("error", () => done(false))',
    "  setTimeout(() => done(false), probeMs)",
    "})",
    "const main = async () => {",
    "  if (port) {",
    "    const until = Date.now() + portWaitMs",
    "    while (Date.now() < until && await listening()) await sleep(pollMs)",
    '    if (await listening()) note("port " + port + " was still in use after " + portWaitMs + "ms; starting anyway")',
    "    await sleep(settleMs)",
    "  } else {",
    "    await sleep(noPortDelayMs)",
    "  }",
    "  let child",
    "  try {",
    '    const out = fs.openSync(logOut, "a")',
    '    const err = fs.openSync(logErr, "a")',
    // windowsHide：助手自己是 detached 的，Windows 上它没有控制台，而一个没有控制台的
    // 父进程 spawn 控制台程序会**新建一个可见控制台** —— 就是那个关掉就把宿主带走的黑窗口。
    '    child = spawn(file, args, { cwd, detached, stdio: ["ignore", out, err], env: process.env, shell: viaShell, windowsHide: true })',
    // spawn 报"文件不存在/不可执行"是**异步**的，下面的 try/catch 只接同步抛出，
    // 所以少了这个监听，失败会和被修的那个 bug 一样安静。
    '    child.on("error", (error) => note("could not start the replacement: " + (error && error.message ? error.message : String(error))))',
    "    child.unref()",
    "  } catch (error) {",
    '    note("could not start the replacement: " + (error && error.message ? error.message : String(error)))',
    "    return",
    "  }",
    // 多活一会儿在 Windows 上是有意义的：spawn 完立刻退出的助手可能把还没 detach 完的
    // 替换进程一起带走。有端口可探的那条路本来就要多待，这条是给没有端口的情况补上同样的保证。
    "  if (!port) { await sleep(lingerMs); return }",
    "  const upBy = Date.now() + replacementWaitMs",
    "  while (Date.now() < upBy && !(await listening())) await sleep(500)",
    '  if (!(await listening())) note("the replacement did not bind port " + port + " within " + replacementWaitMs + "ms \u2014 see the output log beside this one")',
    "}",
    "main()"
  ].join("\n");
}
function planRestart(io, port) {
  const node = nodeExecutableOf({ argv0: io.argv0, execPath: io.execPath, exists: io.exists });
  const launch = launchCommand({
    node,
    argv1: io.argv1,
    execArgv: io.execArgv,
    rest: io.rest,
    cwd: io.cwd,
    platform: io.platform,
    resolve: io.resolve,
    dirname: io.dirname
  });
  const respawn = respawnCommand(launch, io.platform);
  const logOut = io.join(io.tmpdir, `${RESTART_LOG_PREFIX}${io.stamp}.out.log`);
  const logErr = io.join(io.tmpdir, `${RESTART_LOG_PREFIX}${io.stamp}.err.log`);
  return {
    node,
    launch,
    respawn,
    helper: restartHelperSource({ spawned: respawn, cwd: launch.cwd, logs: { out: logOut, err: logErr }, port }),
    logOut,
    logErr,
    port
  };
}
function scheduleRestart(io, port) {
  const plan = planRestart(io, port);
  const helper = io.spawn(plan.node, ["-e", plan.helper], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: io.env
  });
  helper.unref?.();
  void io.wait(RESTART_EXIT_DELAY_MS).then(() => {
    io.stop();
  });
  return {
    ok: true,
    pid: io.pid,
    helperPid: helper.pid,
    logOut: plan.logOut,
    logErr: plan.logErr,
    port: plan.port,
    command: [plan.respawn.file, ...plan.respawn.args].join(" ")
  };
}
function gracefulStop(io, signal = "SIGTERM") {
  try {
    io.emitSignal(signal);
  } catch {
  }
  io.timer(RESTART_STOP_FALLBACK_MS, () => {
    io.exit(0);
  });
}
function bootId(pid, now) {
  return `${String(pid)}-${String(now)}`;
}

// src/optimizer-prompt.ts
var RELAY_ROLE = [
  '\u3010\u4F60\u662F\u8C01\u3011\u4F60\u662F\u4E00\u4E2A**\u4F20\u8BDD\u5668/\u610F\u56FE\u8865\u5168\u5668**\uFF0C\u7AD9\u5728\u7528\u6237\u4E0E"\u5DE5\u4F5C AI"\u4E4B\u95F4\uFF1A',
  "  \u7528\u6237 \u2192\uFF08\u4F60\uFF1A\u628A\u7528\u6237\u7684\u610F\u601D\u6574\u7406\u6210\u6761\u76EE\u5E76\u7ED9\u51FA\u9010\u5B57\u4F9D\u636E\uFF09\u2192 \u5BBF\u4E3B\uFF08\u88C5\u914D\u6210\u4E00\u6761\u547D\u4EE4\uFF09\u2192 \u5DE5\u4F5C AI\u3002",
  "\u4F60\u7684\u4EA7\u51FA**\u4E0D\u4F1A**\u88AB\u76F4\u63A5\u5C55\u793A\u7ED9\u7528\u6237\uFF0C\u4E5F\u4E0D\u4F1A\u88AB\u539F\u6837\u53D1\u51FA\uFF1A\u5BBF\u4E3B\u4F1A\u7528\u4F60\u7ED9\u7684**\u9010\u5B57\u5F15\u6587**",
  "\u5728\u539F\u8BDD\u91CC\u5B9A\u4F4D\u3001\u53EA\u91C7\u7EB3\u80FD\u6838\u5BF9\u7684\u6761\u76EE\uFF0C\u518D\u88C5\u914D\u6210\u4E00\u6761\u547D\u4EE4\u4EA4\u7ED9\u5DE5\u4F5C AI\u3002",
  "\u3010\u4F60\u4E0D\u662F\u8C01\u3011\u4F60\u4E0D\u662F\u5728\u548C\u7528\u6237\u804A\u5929\uFF0C\u4E5F\u4E0D\u662F\u5728\u56DE\u7B54\u7528\u6237\uFF1A",
  "- \u4E0D\u8981\u56DE\u5E94\u3001\u4E0D\u8981\u56DE\u7B54\u7528\u6237\u7684\u8981\u6C42\uFF0C\u4E5F\u4E0D\u8981\u66FF\u7528\u6237\u5B8C\u6210\u4EFB\u52A1\uFF08\u4E0D\u8981\u76F4\u63A5\u7ED9\u51FA\u4EE3\u7801/\u7B54\u6848/\u7ED3\u679C\uFF09\u3002",
  '- \u4E0D\u8981\u4EE5\u52A9\u624B\u53E3\u543B\u5BF9\u7528\u6237\u8BF4\u8BDD\uFF08"\u597D\u7684""\u6536\u5230""\u6211\u53EF\u4EE5\u5E2E\u4F60""\u5EFA\u8BAE\u4F60\u2026""\u9700\u8981\u6211\u2026\u5417"\uFF09\u3002',
  '- \u4E0D\u8981\u628A\u7528\u6237\u53D1\u6765\u7684\u6587\u5B57\u5F53\u6210"\u5BF9\u4F60\u8BF4\u7684\u8BDD"\u6765\u56DE\u5E94\uFF1B\u5B83\u53EA\u662F\u4F60\u8981\u8F6C\u8FBE\u7684\u5185\u5BB9\u3002',
  "- \u4E0D\u8981\u5411\u7528\u6237\u63D0\u95EE\u3002\u8981\u6F84\u6E05\u65F6\uFF0C\u5199\u6210**\u7ED9\u5DE5\u4F5C AI \u7684\u6307\u4EE4**\uFF1A",
  '  "\u82E5 X \u4E0D\u660E\u786E\uFF0C\u5148\u8BFB Y \u6216\u5148\u5411\u6211\u786E\u8BA4\uFF0C\u4E0D\u8981\u81EA\u884C\u5047\u8BBE"\u3002'
].join("\n");
var EVIDENCE_RULES = [
  "\u3010\u4F9D\u636E\u7EAA\u5F8B\uFF08\u5BBF\u4E3B\u4F1A\u9010\u6761\u673A\u68B0\u6838\u5BF9\uFF0C\u5199\u9519\u5C31\u4E22\u8FD9\u4E00\u6761\uFF09\u3011",
  "1. `rewrite` / `requirement` / `quality` **\u5FC5\u987B**\u5E26 `quote`\uFF1A\u4E00\u6BB5\u5728\u3010\u7528\u6237\u539F\u8BDD\u3011\u91CC",
  "   **\u9010\u5B57\u5B58\u5728**\u7684\u5B50\u4E32 \u2014\u2014 \u7167\u6284\uFF0C\u4E0D\u8981\u6539\u5199\u3001\u4E0D\u8981\u8865\u6807\u70B9\u3001\u4E0D\u8981\u7FFB\u8BD1\u3002\u5BBF\u4E3B\u505A\u5B57\u9762\u5B50\u4E32\u6BD4\u5BF9\uFF0C",
  "   \u5BF9\u4E0D\u4E0A\u5C31\u4E22\u6389\u90A3\u4E00\u6761\uFF08\u4E0D\u4F1A\u62A5\u9519\u7ED9\u4F60\uFF0C\u4E5F\u4E0D\u4F1A\u6709\u4EBA\u63D0\u9192\u4F60\uFF09\u3002",
  '2. **\u4E0D\u8BB8\u51ED\u7A7A\u65B0\u589E**\uFF1A\u4EA7\u54C1\u76EE\u6807\u3001\u529F\u80FD\u3001\u786C\u7EA6\u675F\uFF08"\u5FC5\u987B\u79BB\u7EBF""\u7981\u6B62\u8054\u7F51""\u53EA\u80FD\u7528\u67D0\u4E2A\u5E93"',
  '   "\u5FC5\u987B\u652F\u6301\u79FB\u52A8\u7AEF"\uFF09\u4E00\u5F8B\u4E0D\u8BB8\u7531\u4F60\u51B3\u5B9A\u3002\u4F60\u53EA\u80FD\u8865**\u80FD\u4ECE\u539F\u8BDD\u67D0\u4E00\u53E5\u76F4\u63A5\u63A8\u51FA**\u7684\u6700\u4F4E\u8981\u6C42\uFF0C',
  "   \u5E76\u4E14\u5FC5\u987B\u5F15\u7528\u90A3\u4E00\u53E5\u3002",
  "3. \u4E0D\u786E\u5B9A\u3001\u4F1A\u5F71\u54CD\u7ED3\u679C\u3001\u4E14\u53EA\u6709\u7528\u6237\u80FD\u5B9A\u7684\u53D6\u820D \u2192 \u5199 `unknown`\uFF08`unknownClass` =",
  '   "user_preference"\uFF09\uFF0C**\u4E0D\u8981\u66FF\u7528\u6237\u731C**\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6309\u6700\u4FDD\u5B88\u7406\u89E3\u6267\u884C"\u3002',
  '   \u5728\u8BB8\u53EF\u8303\u56F4\u5185\u8BFB\u4EE3\u7801\u5C31\u80FD\u786E\u5B9A\u7684\u4E8B\u5B9E\u5199 "lookupable_fact"\uFF1B\u53EF\u9006\u7684\u5B9E\u73B0\u7EC6\u8282',
  '   \uFF08\u95F4\u8DDD\u3001\u547D\u540D\u3001\u5E93\u7684\u5185\u90E8\u7528\u6CD5\uFF09\u5199 "implementation_detail"\u3002',
  "4. \u4E0D\u5F97\u865A\u6784\u9879\u76EE\u4E8B\u5B9E\uFF08\u6587\u4EF6\u5185\u5BB9\u3001\u76EE\u5F55\u7ED3\u6784\u3001\u4F9D\u8D56\u7248\u672C\uFF09\u3002\u4F60\u6CA1\u8BFB\u5230\u7684\u4E1C\u897F\u4E0D\u5B58\u5728\u3002"
].join("\n");
var STYLE_RULES = [
  '\u3010\u5199 text \u7684\u7EAA\u5F8B\u3011\u4F60\u7684 text \u4F1A\u88AB\u5BBF\u4E3B\u62FC\u8FDB\u6700\u7EC8\u547D\u4EE4\uFF0C\u8BFB\u8005\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\uFF1A',
  "- \u7948\u4F7F\u53E5\u3001\u76F4\u7ED9\u8981\u6C42\u3001\u53EF\u6267\u884C\uFF1B\u4E2D\u6587\u8FDB\u4E2D\u6587\u51FA\u3002",
  '- \u4E0D\u8981\u5143\u8BDD\u8BED\u4E0E\u5143\u6807\u9898\uFF08"\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD""\u6539\u5199\u540E""\u8BF4\u660E""\u4EE5\u4E0B\u662F\u2026"\uFF09\u3002',
  '- \u4E0D\u8981\u63D0\u5230"\u7528\u6237/\u539F\u6587/\u4E0A\u9762\u7684\u8BDD"\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6211\u6765\u5E2E\u4F60\u2026"\u3002',
  '- \u4E0D\u8981\u5199\u6D41\u7A0B\u4EEA\u5F0F\u3001\u901A\u7528\u6559\u5B66\u3001\u9A8C\u6536\u5957\u8BDD\uFF08"\u8BF7\u786E\u4FDD\u4EE3\u7801\u8D28\u91CF"\u8FD9\u79CD\u6CA1\u6709\u6307\u5411\u7684\u8BDD\uFF09\u3002',
  "- `rewrite` \u7684 text \u662F**\u66FF\u6362\u6389\u90A3\u6BB5\u5F15\u6587**\u7684\u6B63\u6587\uFF0C\u6240\u4EE5\u53EA\u5199\u90A3\u6BB5\u8BDD\u672C\u8EAB\uFF0C\u4E0D\u8981\u5E26\u524D\u7F00\u540E\u7F00\u3002"
].join("\n");
var OPTIMIZER_OUTPUT_CONTRACT = [
  "\u3010\u8F93\u51FA\u5951\u7EA6\uFF08\u56FA\u5B9A\uFF0C\u4E0D\u53EF\u66F4\u6539\uFF09\u3011",
  "\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\u3001\u4E0D\u8981\u5728 JSON \u524D\u540E\u5199\u4EFB\u4F55\u5B57\uFF1A",
  '{"items":[{"kind":"rewrite","quote":"\u539F\u8BDD\u91CC\u9010\u5B57\u5B58\u5728\u7684\u7247\u6BB5","text":"\u66FF\u6362\u6389\u8BE5\u7247\u6BB5\u7684\u6B63\u6587"}]}',
  "\u5B57\u6BB5\u4E0E\u53D6\u503C\uFF08`kind` \u53EA\u80FD\u662F\u8FD9\u516D\u79CD\uFF09\uFF1A",
  "- rewrite\uFF1A\u8BED\u8A00\u5C42\u4FEE\u590D\u3002`quote` \u5FC5\u586B\uFF1B\u540C\u4E00\u6BB5\u539F\u8BDD\u6700\u591A\u4E00\u6761 rewrite\uFF0C\u4E0D\u8981\u91CD\u53E0\u3002",
  "- requirement\uFF1A\u4ECE `quote` \u76F4\u63A5\u63A8\u51FA\u7684\u8865\u5168\u8981\u6C42\uFF08\u9A8C\u6536\u6807\u51C6/\u786C\u7EA6\u675F\uFF09\u3002`quote` \u5FC5\u586B\u3002",
  "- quality\uFF1A\u5BF9\u539F\u8BDD\u91CC\u8D28\u91CF\u8BCD\u7684\u89E3\u91CA\u3002`quote` \u5FC5\u586B\uFF08\u5C31\u586B\u90A3\u51E0\u4E2A\u8D28\u91CF\u5B57\uFF09\u3002",
  "- unknown\uFF1A\u672A\u51B3\u9879\u3002\u5FC5\u987B\u5E26 `unknownClass`\uFF08user_preference / lookupable_fact /",
  "  implementation_detail\uFF09\uFF0C\u53EF\u9009 `blocking`\uFF08true/false\uFF0C\u662F\u5426\u6321\u4F4F\u4E0B\u4E00\u6B65\uFF09\u3002",
  '- plan\uFF1A\u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212\uFF08\u4EC5"\u6781\u7AEF"\u6863\u7528\uFF09\u3002',
  '- risk\uFF1A\u591A\u60C5\u51B5\u9884\u6848\uFF08\u4EC5"\u6781\u7AEF"\u6863\u7528\uFF09\uFF0C\u6BCF\u6761\u6309"\u89E6\u53D1\u4FE1\u53F7 \u2192 \u5E94\u5BF9 \u2192 \u7981\u6B62\u52A8\u4F5C"\u5199\u3002',
  "\u9650\u5236\uFF1A`text` \u6BCF\u6761\u4E0D\u8D85\u8FC7 300 \u5B57\uFF1B`items` \u603B\u5171\u4E0D\u8D85\u8FC7 12 \u6761\uFF1Bid \u4E0D\u9700\u8981\u7ED9\u3002",
  '\u6CA1\u6709\u53EF\u8865\u7684\u5185\u5BB9\u65F6\uFF0C\u8F93\u51FA {"items":[]} \u2014\u2014 \u4F46**\u5148\u60F3\u6E05\u695A**\uFF1A\u7528\u6237\u8FD9\u4E00\u8F6E\u7684\u539F\u8BDD\u91CC',
  "\u771F\u7684\u6CA1\u6709\u4EFB\u4F55\u53EF\u6838\u5BF9\u7684\u8865\u5168\u5417\uFF1F"
].join("\n");
var OPTIMIZE_ITEM_KINDS = ["rewrite", "requirement", "quality", "unknown", "plan", "risk"];
var OPTIMIZE_UNKNOWN_CLASSES = ["user_preference", "lookupable_fact", "implementation_detail"];
var OPTIMIZE_MAX_ITEMS = 12;
var OPTIMIZE_ITEM_MAX_CHARS = 300;
var TIER_TASKS = {
  basic: [
    "\u3010\u672C\u8F6E\u4EFB\u52A1\uFF1A\u53EA\u505A\u8BED\u8A00\u5C42\u4FEE\u590D\u3011",
    "\u7528\u6237\u539F\u8BDD\u53EF\u80FD\u6709\u75C5\u53E5\u3001\u6307\u4EE3\u4E0D\u660E\u3001\u7528\u8BCD\u542B\u7CCA\u3002\u628A\u5B83\u6539\u5199\u6210\u901A\u987A\u3001\u7CBE\u786E\u3001\u65E0\u6B67\u4E49\u7684**\u540C\u4E00\u6BB5\u8BDD**\u3002",
    "\u53EA\u4EA7\u51FA `rewrite`\uFF08\u53EF\u4EE5\u6309\u53E5\u5B50\u62C6\u6210\u591A\u6761\uFF0C\u6BCF\u6761\u5F15\u7528\u539F\u8BDD\u91CC\u5BF9\u5E94\u90A3\u4E00\u53E5\uFF09\u3002",
    "\u4E25\u7981\u4EA7\u51FA requirement / plan / risk\uFF1A\u8FD9\u4E00\u6863**\u4E0D\u65B0\u589E\u4EFB\u4F55\u8981\u6C42**\uFF0C\u53EA\u628A\u8BDD\u8BF4\u660E\u767D\u3002",
    "\u539F\u8BDD\u786E\u6709\u6B67\u4E49\u3001\u4E14\u6B67\u4E49\u4F1A\u5BFC\u81F4\u505A\u9519\u65F6\uFF0C\u624D\u8865\u4E00\u6761 `unknown`\uFF08unknownClass \u53D6",
    "user_preference \u6216 lookupable_fact\uFF09\uFF1B\u786E\u5B9E\u6CA1\u6709\u53EF\u8865\u7684\u5C31\u8F93\u51FA\u7A7A\u6570\u7EC4\u3002",
    "\u957F\u5EA6\u7EAA\u5F8B\uFF1A\u6210\u54C1\u4E0D\u8D85\u8FC7\u539F\u8BDD\u7684 1.4 \u500D\uFF1B\u539F\u8BDD 30 \u5B57\u4EE5\u5185\u65F6\u4E0D\u8D85\u8FC7 60 \u5B57\u3002"
  ],
  advanced: [
    "\u3010\u672C\u8F6E\u4EFB\u52A1\uFF1A\u5728\u4E0D\u52A8\u76EE\u6807\u7684\u524D\u63D0\u4E0B\u628A\u547D\u4EE4\u8BF4\u6E05\u695A\u3011",
    '\u7528\u6237\u539F\u8BDD\u542B\u7CCA\u3001\u7F3A\u5173\u952E\u7EA6\u675F\u3002\u4F60\u8981\u8865\u7684\u662F"\u7528\u6237\u663E\u7136\u60F3\u8981\u3001\u4F46\u6CA1\u8BF4\u51FA\u53E3"\u7684\u5FC5\u8981\u4FE1\u606F\uFF0C',
    "\u8BA9\u5B83\u4E00\u6B21\u505A\u5BF9 \u2014\u2014 \u4F46\u6BCF\u4E00\u6761\u90FD\u5FC5\u987B\u662F**\u4ECE\u539F\u8BDD\u67D0\u4E00\u53E5\u76F4\u63A5\u63A8\u51FA**\u7684\uFF0C\u5E76\u5F15\u7528\u90A3\u4E00\u53E5\u3002",
    "\u5141\u8BB8\u4EA7\u51FA\uFF1A",
    "- `rewrite`\uFF1A\u628A\u542B\u7CCA\u3001\u6709\u75C5\u53E5\u7684\u5730\u65B9\u8BF4\u6E05\u695A\uFF08\u540C\u4E00\u6BB5\u539F\u8BDD\u6700\u591A\u4E00\u6761\uFF09\u3002",
    '- `requirement`\uFF1A\u4ECE\u539F\u8BDD\u76F4\u63A5\u63A8\u51FA\u7684\u6700\u4F4E\u4EA4\u4ED8\u8981\u6C42\u4E0E\u9A8C\u6536\u6807\u51C6\uFF08"\u6539\u5B8C\u80FD\u8DD1\u8D77\u6765""\u9875\u9762\u80FD\u6253\u5F00"',
    "  \u8FD9\u7C7B\u53EF\u89C2\u6D4B\u7684\u8BDD\uFF09\uFF0C\u5199\u6210\u5BF9\u5DE5\u4F5C AI \u7684\u8981\u6C42\u800C\u4E0D\u662F\u8BC4\u8BBA\u3002\u6BCF\u6761\u90FD\u8981\u80FD\u6307\u56DE\u539F\u8BDD\u91CC\u7684\u67D0\u4E00\u53E5\u3002",
    '- `quality`\uFF1A\u7528\u6237\u8BF4\u7684\u8D28\u91CF\u8BCD\uFF08"\u597D\u770B\u70B9""\u9AD8\u7EA7\u611F""\u6D41\u7545"\uFF09\u2192 \u89E3\u91CA\u6210\u53EF\u89C2\u5BDF\u7684\u8981\u6C42\u3002',
    "  \u5B83\u662F**\u89E3\u91CA**\uFF0C\u4E0D\u662F\u65B0\u589E\u76EE\u6807\uFF1A\u4E00\u6761\u8D28\u91CF\u8BCD\u6700\u591A\u4E00\u6761 quality\u3002",
    "- `unknown`\uFF1A\u53EA\u6709\u7528\u6237\u80FD\u5B9A\u7684\u53D6\u820D\uFF08user_preference\uFF09/ \u8BE5\u53BB\u67E5\u8BC1\u7684\u4E8B\u5B9E\uFF08lookupable_fact\uFF09\u3002",
    "\u7981\u6B62\uFF1A\u65B0\u589E\u529F\u80FD\u3001\u65B0\u76EE\u6807\u3001\u65B0\u4F9D\u8D56\uFF1B\u865A\u6784\u9879\u76EE\u4E8B\u5B9E\uFF1B\u5199\u7528\u6237\u6CA1\u6388\u6743\u7684\u6280\u672F\u9009\u578B\u3002",
    "\u6570\u91CF\u7EAA\u5F8B\uFF1Arequirement \u6700\u591A 3 \u6761\uFF0Cquality \u6700\u591A 2 \u6761\uFF0Cunknown \u6700\u591A 2 \u6761\u3002"
  ],
  extreme: [
    "\u3010\u672C\u8F6E\u4EFB\u52A1\uFF1A\u628A\u8BC9\u6C42\u56FA\u5316\u6210\u4E00\u6761\u53EF\u76F4\u63A5\u6267\u884C\u7684\u547D\u4EE4\u3011",
    "\u8FD9\u6B21\u662F\u591A\u6B65\u6267\u884C\u7684\u590D\u6742\u4EFB\u52A1\uFF0C\u5DE5\u4F5C AI \u4F1A\u7167\u8FD9\u6761\u547D\u4EE4\u5E72\uFF0C\u7528\u6237\u4E0D\u4F1A\u518D\u8865\u5145\u3002",
    '\u5728"\u9AD8\u7EA7"\u6863\u5141\u8BB8\u7684\u5168\u90E8\u6761\u76EE\u7684\u57FA\u7840\u4E0A\uFF0C\u518D\u52A0\u4E24\u7C7B\uFF08\u90FD\u8981\u4EE5\u7528\u6237\u5728\u7ED9\u5DE5\u4F5C AI \u4E0B\u547D\u4EE4\u7684\u53E3\u543B\u5199\uFF09\uFF1A',
    "- `plan`\uFF1A\u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212\u3002\u6BCF\u9636\u6BB5\u5199\u6E05\u52A8\u4F5C\u4E0E\u4EA7\u51FA\uFF0C\u5E76\u5199\u660E\u7EAA\u5F8B\uFF08\u5148\u9A8C\u8BC1\u518D\u6539\u3001\u5931\u8D25\u5373\u56DE\u9000\u3001",
    "  \u4E0D\u64C5\u81EA\u6269\u5927\u8303\u56F4\u3001\u6539\u5B8C\u7ED9\u51FA\u8BC1\u636E\uFF09\u3002",
    '- `risk`\uFF1A\u591A\u60C5\u51B5\u9884\u6848 2~4 \u6761\uFF0C\u6BCF\u6761\u5199\u6210"\u5982\u679C\u51FA\u73B0 <\u89E6\u53D1\u4FE1\u53F7>\uFF0C\u5C31\u5148 <\u5E94\u5BF9\u52A8\u4F5C>\uFF0C',
    '  \u4E0D\u8981 <\u7981\u6B62\u52A8\u4F5C>"\u3002',
    "\u8FD8\u8981\u5224\u65AD\u8FD9\u6B21\u4EFB\u52A1\u662F\u5426\u503C\u5F97\u8BA9\u5DE5\u4F5C AI \u7528 goal / todo / \u8BA1\u5212\u6A21\u5F0F\u8DDF\u8E2A\uFF0C\u5E76\u628A\u7ED3\u8BBA\u5199\u6210",
    '`requirement` \u7684\u4E00\u90E8\u5206\uFF08\u4F8B\u5982"\u8BF7\u5148\u5EFA\u7ACB goal\uFF1A\u2026\uFF0C\u518D\u6309\u4E0B\u5217\u9636\u6BB5\u63A8\u8FDB"\uFF09\uFF1B\u4E0D\u9700\u8981\u5C31\u5B8C\u5168\u4E0D\u63D0\u3002',
    '\u94C1\u5F8B\uFF1A\u4E0D\u5F97\u865A\u6784\u9879\u76EE\u4E8B\u5B9E\u3002\u9700\u8981\u9879\u76EE\u4E8B\u5B9E\u65F6\u5199\u6210"\u5148\u8BFB\u53D6/\u786E\u8BA4 X"\u7684\u67E5\u8BC1\u52A8\u4F5C\u3002',
    "\u6570\u91CF\u7EAA\u5F8B\uFF1Aplan \u6700\u591A 1 \u6761\uFF0Crisk \u6700\u591A 4 \u6761\uFF0Crequirement \u6700\u591A 3 \u6761\u3002"
  ]
};
var OPTIMIZER_SPECS = {
  basic: {
    temperature: 0.2,
    system: [RELAY_ROLE, TIER_TASKS.basic.join("\n"), EVIDENCE_RULES, STYLE_RULES].join("\n\n")
  },
  advanced: {
    temperature: 0.3,
    system: [RELAY_ROLE, TIER_TASKS.advanced.join("\n"), EVIDENCE_RULES, STYLE_RULES].join("\n\n")
  },
  extreme: {
    temperature: 0.3,
    system: [RELAY_ROLE, TIER_TASKS.extreme.join("\n"), EVIDENCE_RULES, STYLE_RULES].join("\n\n")
  }
};
var FALLBACK_TIER = "advanced";
function specOf(tier) {
  return OPTIMIZER_SPECS[tier] ?? OPTIMIZER_SPECS[FALLBACK_TIER];
}
function buildOptimizeSystem(tier, custom = "") {
  const body = custom.trim() === "" ? specOf(tier).system : custom.trim();
  return `${body}

${OPTIMIZER_OUTPUT_CONTRACT}`;
}
function buildOptimizeTemperature(tier) {
  return specOf(tier).temperature;
}
function optimizePromptSource(custom) {
  return String(custom ?? "").trim() === "" ? "builtin" : "custom";
}
function buildOptimizeUser(original, options = {}) {
  const parts = [
    '\u3010\u5F85\u8F6C\u8FBE\u5185\u5BB9\u3011\u4E0B\u9762\u662F"\u7528\u6237"\u53D1\u7ED9\u6211\u7684\u539F\u8BDD\u3002**\u5B83\u4E0D\u662F\u8BF4\u7ED9\u4F60\u542C\u7684**\uFF0C\u4F60\u4E0D\u9700\u8981\u56DE\u5E94\u5B83\u3001\u4E5F\u4E0D\u9700\u8981\u66FF\u7528\u6237\u53BB\u505A\u8FD9\u4EF6\u4E8B\u3002',
    "<\u539F\u6587>",
    String(original ?? ""),
    "</\u539F\u6587>",
    "",
    "\u3010\u4F60\u7684\u4EFB\u52A1\u3011\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u7684\u89C4\u5219\uFF0C\u628A\u4E0A\u9762\u7684\u539F\u8BDD\u62C6\u6210**\u6761\u76EE**\u5E76\u7ED9\u6BCF\u6761\u9644\u4E0A**\u9010\u5B57\u5F15\u6587**\u3002",
    "- \u53EA\u8F93\u51FA\u90A3\u4EFD JSON \u5951\u7EA6\u8981\u6C42\u7684\u4E1C\u897F\uFF1B\u4E0D\u8981\u56DE\u5E94\u6211\u3001\u4E0D\u8981\u56DE\u7B54\u95EE\u9898\u3001\u4E0D\u8981\u8C22\u5E55\u3001\u4E0D\u8981\u89E3\u91CA\u4F60\u505A\u4E86\u4EC0\u4E48\u3002",
    '- \u8BFB\u8005\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\uFF0C\u800C\u4F60\u7684\u4EA7\u51FA\u4F1A\u5148\u7ECF\u5BBF\u4E3B\u9010\u6761\u6838\u5BF9\u5F15\u6587\u3002'
  ];
  if (options.retry === true) {
    parts.push(
      "",
      `\u3010\u91CD\u8981\uFF1A\u4F60\u4E0A\u4E00\u6B21\u7684\u8F93\u51FA\u662F\u7A7A\u7684${options.reason ? `\uFF08${options.reason}\uFF09` : ""}\u3011`,
      "\u4E0A\u4E00\u6B21\u4F60\u6CA1\u6709\u7ED9\u51FA\u4EFB\u4F55\u6761\u76EE\uFF0C\u8FD9\u4E00\u8F6E\u56E0\u6B64**\u6CA1\u6709\u4EFB\u4F55\u8865\u5168**\u53EF\u4EE5\u4EA4\u7ED9\u5DE5\u4F5C AI\u3002",
      "\u8BF7\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u7684\u786C\u89C4\u5219\u91CD\u505A\uFF1A**\u54EA\u6015\u7528\u6237\u53EA\u5199\u4E86\u4E00\u4E24\u4E2A\u5B57\uFF0C\u4E5F\u8981\u5C3D\u91CF\u628A\u5B83\u62C6\u6210\u53EF\u5F15\u7528\u7684\u6761\u76EE**",
      '\uFF08\u81F3\u5C11\u4E00\u6761 `rewrite`\uFF0C\u6216\u4E00\u6761 `quality` / `unknown`\uFF09\uFF1B\u786E\u5B9E\u6CA1\u6709\u53EF\u8865\u7684\u5185\u5BB9\u65F6\u624D\u8F93\u51FA {"items":[]}\u3002',
      "\u53EA\u8F93\u51FA JSON\u3002"
    );
  }
  return parts.join("\n");
}

// src/optimizer-assemble.ts
var TIER_BUDGET = {
  basic: { factor: 1.4, floor: 400 },
  advanced: { factor: 2.6, floor: 700 },
  extreme: { factor: 4, floor: 1400 }
};
var TIER_KINDS = {
  basic: ["rewrite", "unknown"],
  advanced: ["rewrite", "requirement", "quality", "unknown"],
  extreme: ["rewrite", "requirement", "quality", "unknown", "plan", "risk"]
};
function allowedKindsFor(tier) {
  return TIER_KINDS[tier] ?? TIER_KINDS.advanced;
}
function optimizeBudgetFor(tier, originalChars) {
  const spec = TIER_BUDGET[tier] ?? TIER_BUDGET.advanced;
  const scaled = Math.ceil(Math.max(0, originalChars) * spec.factor);
  return Math.min(OPTIMIZE_OUTPUT_MAX, Math.max(spec.floor, scaled));
}
function looksLikeEnvelope(raw) {
  const text = String(raw ?? "").trim();
  if (text.startsWith("{") || text.startsWith("```")) return true;
  return /"(items|ops)"\s*:/.test(text);
}
function extractJson(raw) {
  const text = String(raw ?? "");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const envelope = looksLikeEnvelope(text);
  if (start < 0 || end <= start) {
    return envelope ? { ok: false, code: "BAD_JSON", reason: "\u8F93\u51FA\u770B\u8D77\u6765\u662F\u672C\u63D2\u4EF6\u7684\u6761\u76EE JSON\uFF0C\u4F46\u62EC\u53F7\u4E0D\u5B8C\u6574\uFF08\u53EF\u80FD\u88AB\u622A\u65AD\uFF09" } : { ok: false, code: "NO_JSON", reason: "\u8F93\u51FA\u91CC\u6CA1\u6709 JSON \u5BF9\u8C61" };
  }
  try {
    return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) };
  } catch (error) {
    return {
      ok: false,
      code: envelope ? "BAD_JSON" : "NO_JSON",
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
function findQuoteSpan(original, quote) {
  const q = String(quote ?? "").trim();
  if (q === "") return void 0;
  const exact = original.indexOf(q);
  if (exact >= 0) return { start: exact, end: exact + q.length };
  const target = q.replace(/\s+/g, " ");
  let acc = "";
  const map = [];
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i];
    if (/\s/.test(ch)) {
      if (acc === "" || acc.endsWith(" ")) continue;
      acc += " ";
      map.push(i);
      continue;
    }
    acc += ch;
    map.push(i);
  }
  const at = acc.indexOf(target);
  if (at < 0) return void 0;
  const start = map[at];
  const last = map[at + target.length - 1] ?? start;
  return { start, end: last + 1 };
}
function itemsOf(value, warnings) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const row = value;
  if (Array.isArray(row.items)) return row.items;
  if (Array.isArray(row.ops)) {
    const out = [];
    for (const op of row.ops) {
      if (typeof op !== "object" || op === null) continue;
      const entry = op;
      if (entry.op === "add_item" && typeof entry.item === "object" && entry.item !== null) {
        out.push(entry.item);
        continue;
      }
      warnings.push(`\u5FFD\u7565\u4E86\u4E0D\u652F\u6301\u7684 op\u300C${String(entry.op ?? "(\u7A7A)")}\u300D\uFF1A\u672C\u63D2\u4EF6\u4E0D\u505A\u8DE8\u8F6E\u72B6\u6001\uFF0C\u53EA\u8BA4 add_item`);
    }
    return out;
  }
  return void 0;
}
function hasEnvelopeKey(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value;
  return "items" in row || "ops" in row;
}
function unknownClassOf(value) {
  return OPTIMIZE_UNKNOWN_CLASSES.includes(value) ? value : "user_preference";
}
function parseOptimizeOutput(raw, original) {
  const extracted = extractJson(raw);
  if (!extracted.ok) return { ok: false, code: extracted.code, reason: extracted.reason };
  const warnings = [];
  const raw_items = itemsOf(extracted.value, warnings);
  if (raw_items === void 0) {
    return hasEnvelopeKey(extracted.value) ? { ok: false, code: "BAD_SHAPE", reason: '\u671F\u671B {"items":[...]} \u6216 {"ops":[{"op":"add_item","item":{...}}]}' } : { ok: false, code: "NOT_ENVELOPE", reason: "\u8FD9\u662F\u4E00\u6BB5 JSON\uFF0C\u4F46\u4E0D\u662F\u672C\u63D2\u4EF6\u7684\u6761\u76EE\u4FE1\u5C01" };
  }
  const items = [];
  const dropped = [];
  const seenRewrite = /* @__PURE__ */ new Set();
  for (let index = 0; index < raw_items.length; index += 1) {
    const id = `item#${index + 1}`;
    const entry = raw_items[index];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      dropped.push({ id, kind: "(\u975E\u5BF9\u8C61)", reason: "\u6761\u76EE\u4E0D\u662F\u5BF9\u8C61" });
      continue;
    }
    const row = entry;
    const kind = String(row.kind ?? "");
    if (!OPTIMIZE_ITEM_KINDS.includes(kind)) {
      dropped.push({ id, kind: kind === "" ? "(\u7A7A)" : kind, reason: `kind \u4E0D\u5728\u5141\u8BB8\u5217\u8868\u91CC\uFF08${OPTIMIZE_ITEM_KINDS.join(" / ")}\uFF09` });
      continue;
    }
    let text = typeof row.text === "string" ? row.text.trim() : "";
    if (text === "") {
      dropped.push({ id, kind, reason: "text \u662F\u7A7A\u7684" });
      continue;
    }
    if (text.length > OPTIMIZE_ITEM_MAX_CHARS) {
      warnings.push(`${id}\uFF1Atext \u8D85 ${OPTIMIZE_ITEM_MAX_CHARS} \u5B57\uFF0C\u5DF2\u622A\u65AD`);
      text = text.slice(0, OPTIMIZE_ITEM_MAX_CHARS);
    }
    if (items.length >= OPTIMIZE_MAX_ITEMS) {
      dropped.push({ id, kind, reason: `\u8D85\u8FC7\u5355\u8F6E\u4E0A\u9650 ${OPTIMIZE_MAX_ITEMS} \u6761 \u21D2 \u622A\u65AD\u4E22\u5F03\uFF08\u6574\u8F6E\u7167\u5E38\u51FA\u6210\u54C1\uFF09` });
      continue;
    }
    const needsQuote = kind === "rewrite" || kind === "requirement" || kind === "quality";
    const quote = typeof row.quote === "string" ? row.quote.trim() : "";
    if (needsQuote) {
      if (quote === "") {
        dropped.push({ id, kind, reason: "\u7F3A\u5C11 quote\uFF08\u8FD9\u4E00\u7C7B\u6761\u76EE\u5FC5\u987B\u6709\u9010\u5B57\u5F15\u6587\uFF09" });
        continue;
      }
      const span2 = findQuoteSpan(original, quote);
      if (span2 === void 0) {
        dropped.push({ id, kind, reason: `\u5F15\u6587\u4E0D\u662F\u539F\u8BDD\u91CC\u7684\u9010\u5B57\u7247\u6BB5\uFF1A\u300C${quote.slice(0, 40)}\u300D` });
        continue;
      }
      if (kind === "rewrite") {
        const key = `${String(span2.start)}-${String(span2.end)}`;
        if (seenRewrite.has(key)) {
          dropped.push({ id, kind, reason: "\u4E0E\u53E6\u4E00\u6761 rewrite \u5F15\u7528\u4E86\u540C\u4E00\u6BB5\u539F\u8BDD\uFF08\u91CD\u590D\uFF09" });
          continue;
        }
        seenRewrite.add(key);
      }
      items.push({ id, kind, text, quote, span: span2, quoteSource: "user" });
      continue;
    }
    const span = quote === "" ? void 0 : findQuoteSpan(original, quote);
    if (quote !== "" && span === void 0) {
      warnings.push(`${id}\uFF1A\u5F15\u6587\u5BF9\u4E0D\u4E0A\u539F\u8BDD\uFF0C\u5DF2\u6309"\u6A21\u578B\u81EA\u5DF1\u8865\u7684"\u8BB0\u8D26\uFF08\u4E0D\u5192\u5145\u4F60\u8BF4\u8FC7\u7684\u8BDD\uFF09`);
    }
    items.push({
      id,
      kind,
      text,
      quoteSource: span === void 0 ? "none" : "user",
      ...span === void 0 ? {} : { span, quote },
      ...kind === "unknown" ? { unknownClass: unknownClassOf(row.unknownClass), blocking: row.blocking === true } : {}
    });
  }
  if (items.length === 0 && dropped.length === 0 && raw_items.length === 0) warnings.push("\u6A21\u578B\u4EA4\u56DE\u7A7A\u6570\u7EC4\uFF1A\u8FD9\u4E00\u8F6E\u6CA1\u6709\u53EF\u6838\u5B9E\u7684\u8865\u5168");
  return { ok: true, items, dropped, warnings };
}
var SECTIONS = [
  { key: "requirement", label: "\u8865\u5168\u8981\u6C42\uFF08\u6BCF\u6761\u90FD\u6307\u56DE\u4F60\u539F\u8BDD\u91CC\u7684\u67D0\u53E5\uFF09", required: true },
  { key: "quality", label: "\u5BF9\u8D28\u91CF\u8BCD\u7684\u7406\u89E3", required: false },
  { key: "plan", label: "\u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212", required: false },
  { key: "risk", label: "\u591A\u60C5\u51B5\u9884\u6848", required: false },
  { key: "unknown", label: "\u4E0D\u660E\u786E\u5904", required: false }
];
var DROP_ORDER = ["risk", "plan", "quality", "unknown"];
var UNKNOWN_SUFFIX = {
  user_preference: "\uFF08\u53EA\u6709\u6211\u80FD\u5B9A\uFF1A\u5148\u95EE\u6211\uFF0C\u4E0D\u8981\u81EA\u884C\u5047\u8BBE\uFF09",
  lookupable_fact: "\uFF08\u53EF\u67E5\u8BC1\u7684\u4E8B\u5B9E\uFF1A\u5148\u8BFB\u4EE3\u7801/\u6587\u6863\u786E\u8BA4\uFF0C\u4E0D\u8981\u731C\uFF09",
  implementation_detail: "\uFF08\u5B9E\u73B0\u7EC6\u8282\uFF1A\u4F60\u81EA\u5DF1\u5B9A\uFF09"
};
function lineFor(item) {
  if (item.kind === "unknown") {
    const cls = item.unknownClass ?? "user_preference";
    const blocking = item.blocking === true ? "[\u6321\u4F4F\u4E0B\u4E00\u6B65] " : "";
    return `- ${blocking}${item.text}${UNKNOWN_SUFFIX[cls]}`;
  }
  const evidence = item.quote === void 0 ? "" : `\uFF08\u4F9D\u636E\uFF1A"${item.quote}"\uFF09`;
  return `- ${item.text}${evidence}`;
}
function assembleCommand(original, items, options) {
  const body0 = String(original ?? "");
  const warnings = [];
  const dropped = [];
  const allowed = allowedKindsFor(options.tier);
  const usable = [];
  for (const item of items) {
    if (allowed.includes(item.kind)) {
      usable.push(item);
      continue;
    }
    dropped.push({ id: item.id, kind: item.kind, reason: `\u5F53\u524D\u6863\u4F4D\uFF08${options.tier}\uFF09\u4E0D\u4EA7\u51FA\u300C${item.kind}\u300D\u8FD9\u4E00\u7C7B\u6761\u76EE` });
  }
  const rewrites = usable.filter((item) => item.kind === "rewrite" && item.span !== void 0).slice().sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
  const keptRewrites = [];
  let cursor = -1;
  for (const item of rewrites) {
    if (item.span.start < cursor) {
      dropped.push({ id: item.id, kind: item.kind, reason: "\u6539\u5199\u533A\u95F4\u4E0E\u53E6\u4E00\u6761 rewrite \u91CD\u53E0\uFF0C\u53EA\u4FDD\u7559\u9760\u524D\u7684\u90A3\u6761" });
      continue;
    }
    cursor = item.span.end;
    keptRewrites.push(item);
  }
  let body = body0;
  let rewrittenChars = 0;
  for (let i = keptRewrites.length - 1; i >= 0; i -= 1) {
    const span = keptRewrites[i].span;
    body = body.slice(0, span.start) + keptRewrites[i].text + body.slice(span.end);
    rewrittenChars += span.end - span.start;
  }
  const included = {};
  for (const section of SECTIONS) included[section.key] = [];
  for (const item of usable) {
    if (item.kind === "rewrite") continue;
    if (included[item.kind] === void 0) continue;
    included[item.kind].push(item);
  }
  const renderBlocks = () => {
    const blocks2 = [];
    for (const section of SECTIONS) {
      const bucket = included[section.key] ?? [];
      if (bucket.length === 0) continue;
      blocks2.push(`\u3010${section.label}\u3011
${bucket.map(lineFor).join("\n")}`);
    }
    return blocks2;
  };
  const compose = (blocks2, removed2, overBy2) => {
    const tail = [];
    if (removed2.length > 0) {
      tail.push(`\u3010\u8BF4\u660E\u3011\u56E0\u7BC7\u5E45\u9884\u7B97\u7701\u7565 ${removed2.length} \u6761\u8865\u5168\uFF08${removed2.map((d) => d.kind).join("\u3001")}\uFF09\uFF1B\u5982\u679C\u5176\u4E2D\u6709\u7528\u4FE1\u606F\u5F71\u54CD\u5224\u65AD\uFF0C\u8BF7\u5148\u5411\u6211\u786E\u8BA4\u3002`);
    }
    if (overBy2 > 0) {
      tail.push(`\u3010\u9884\u7B97\u4E0D\u8DB3\u3011\u5DF2\u7701\u7565\u5168\u90E8\u53EF\u7701\u7565\u9879\uFF0C\u4ECD\u8D85\u51FA\u7EA6 ${overBy2} \u5B57\u7B26\uFF1B\u672C\u8F6E\u5148\u6309\u4E0B\u8FBE\u7684\u8FD9\u4E9B\u505A\uFF0C\u9700\u8981\u4FDD\u7559\u88AB\u7701\u7565\u7684\u5185\u5BB9\u8BF7\u7F29\u5C0F\u8303\u56F4\u3002`);
    }
    const head = blocks2.length === 0 ? "" : `${body}

${blocks2.join("\n\n")}`;
    if (tail.length === 0) return blocks2.length === 0 ? body : head;
    return head === "" ? tail.join("\n\n") : `${head}

${tail.join("\n\n")}`;
  };
  const budget = optimizeBudgetFor(options.tier, body0.length);
  const removed = [];
  let blocks = renderBlocks();
  let overBy = 0;
  let text = compose(blocks, removed, 0);
  for (let guard = 0; guard < 200; guard += 1) {
    const bare = compose(blocks, [], 0);
    overBy = bare.length > budget ? bare.length - budget : 0;
    text = compose(blocks, removed, overBy);
    if (bare.length <= budget) break;
    const victim = DROP_ORDER.find((key) => (included[key] ?? []).length > 0);
    if (victim === void 0) break;
    const taken = included[victim].pop();
    removed.push({ id: taken.id, kind: taken.kind, reason: "budget\uFF08\u7BC7\u5E45\u9884\u7B97\uFF09" });
    blocks = renderBlocks();
  }
  if (removed.length > 0) {
    warnings.push(`\u7BC7\u5E45\u9884\u7B97 ${budget} \u5B57\u7B26\uFF1A\u7701\u7565\u4E86 ${removed.length} \u6761\uFF08${removed.map((d) => d.id).join("\u3001")}\uFF09`);
  }
  if (overBy > 0) warnings.push(`\u88C5\u4E86\u5FC5\u4FDD\u8282\u540E\u4ECD\u8D85\u51FA\u9884\u7B97\u7EA6 ${overBy} \u5B57\u7B26\uFF0C\u5DF2\u5728\u6210\u54C1\u91CC\u5982\u5B9E\u8BF4\u660E`);
  const itemCount = keptRewrites.length + SECTIONS.reduce((sum, section) => sum + (included[section.key] ?? []).length, 0);
  return {
    text,
    sections: SECTIONS.filter((section) => (included[section.key] ?? []).length > 0).map((section) => section.label),
    dropped: [...dropped, ...removed],
    warnings,
    chars: text.length,
    budget,
    overBudget: overBy > 0,
    overBy,
    rewrittenChars,
    itemCount
  };
}
function runOptimizePipeline(raw, original, options) {
  const parsed = parseOptimizeOutput(raw, original);
  if (!parsed.ok) {
    if (parsed.code === "NO_JSON" || parsed.code === "NOT_ENVELOPE") {
      return {
        ok: true,
        text: raw.trim(),
        fallback: true,
        itemCount: 0,
        dropped: [],
        warnings: ["\u6A21\u578B\u6CA1\u6709\u6309 JSON \u5951\u7EA6\u8F93\u51FA\uFF1A\u5DF2\u6309\u539F\u6837\u5199\u56DE\uFF08\u8FD9\u4E00\u8F6E\u6CA1\u6709\u505A\u4F9D\u636E\u6821\u9A8C\uFF09"],
        sections: [],
        chars: raw.trim().length,
        budget: optimizeBudgetFor(options.tier, original.length),
        overBudget: false,
        rewrittenChars: 0
      };
    }
    return { ok: false, code: parsed.code, reason: parsed.reason };
  }
  const assembled = assembleCommand(original, parsed.items, options);
  const warnings = [...parsed.warnings, ...assembled.warnings];
  if (parsed.items.length === 0 && parsed.dropped.length === 0) warnings.push("\u8FD9\u4E00\u8F6E\u6CA1\u6709\u53EF\u6838\u5B9E\u7684\u8865\u5168\uFF0C\u539F\u8BDD\u539F\u6837\u5199\u56DE");
  return {
    ok: true,
    text: assembled.text,
    fallback: false,
    itemCount: assembled.itemCount,
    dropped: [...parsed.dropped, ...assembled.dropped],
    warnings,
    sections: assembled.sections,
    chars: assembled.chars,
    budget: assembled.budget,
    overBudget: assembled.overBudget,
    rewrittenChars: assembled.rewrittenChars
  };
}

// src/quick-store.ts
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
var QUICK_STORE_FILE = "quick-prompts.json";
var LOCK_RETRY_MS = 50;
var LOCK_RETRY_MAX = 40;
var LOCK_STALE_MS = 3e4;
function dshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  return fromEnv !== void 0 && fromEnv !== "" ? fromEnv : join(homedir(), ".dsh");
}
function quickStorePath() {
  return join(dshHome(), QUICK_STORE_FILE);
}
function errorText2(error) {
  return error instanceof Error ? error.message : String(error);
}
function hasCode(error, code) {
  return typeof error === "object" && error !== null && error.code === code;
}
function delay(ms) {
  return new Promise((resolve3) => {
    setTimeout(resolve3, ms);
  });
}
async function quarantine(file) {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const target = `${file}.bad-${stamp}`;
  try {
    await rename(file, target);
    return target;
  } catch {
    return void 0;
  }
}
async function readQuickBook(file = quickStorePath()) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if (hasCode(error, "ENOENT")) return { kind: "missing" };
    return { kind: "broken", error: `\u8BFB\u53D6\u5931\u8D25\uFF1A${errorText2(error)}` };
  }
  if (raw.trim() === "") return { kind: "broken", error: "\u6587\u4EF6\u662F\u7A7A\u7684", quarantined: await quarantine(file) };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { kind: "broken", error: `\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText2(error)}`, quarantined: await quarantine(file) };
  }
  const book = sanitizeBook(parsed);
  if (book === void 0) {
    return {
      kind: "broken",
      error: "\u7ED3\u6784\u8BA4\u4E0D\u51FA\uFF08\u65E2\u4E0D\u662F categories \u4E5F\u4E0D\u662F\u5E73\u94FA prompts\uFF09",
      quarantined: await quarantine(file)
    };
  }
  return { kind: "ok", book };
}
async function acquireLock(file) {
  const lock = `${file}.lock`;
  for (let attempt = 0; attempt < LOCK_RETRY_MAX; attempt += 1) {
    try {
      const handle = await open(lock, "wx", 384);
      await handle.close();
      return async () => {
        try {
          await unlink(lock);
        } catch {
        }
      };
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
      let ageMs;
      try {
        const info = await open(lock, "r");
        try {
          const stat = await info.stat();
          ageMs = Date.now() - stat.mtimeMs;
        } finally {
          await info.close();
        }
      } catch {
      }
      if (ageMs !== void 0 && ageMs > LOCK_STALE_MS) {
        throw new Error(
          `\u5199\u5165\u9501 ${lock} \u5DF2\u5B58\u5728 ${Math.round(ageMs / 1e3)} \u79D2\uFF0C\u50CF\u662F\u4E0A\u6B21\u5199\u5165\u5D29\u6E83\u7559\u4E0B\u7684\uFF1B\u786E\u8BA4\u6CA1\u6709\u6B63\u5728\u8FD0\u884C\u7684 DSH \u540E\u5220\u9664\u5B83\u518D\u91CD\u8BD5`
        );
      }
      await delay(LOCK_RETRY_MS);
    }
  }
  throw new Error(`\u53E6\u4E00\u4E2A\u8FDB\u7A0B\u6B63\u5728\u5199\u5165 ${file}\uFF08\u7B49\u5F85 ${String(LOCK_RETRY_MS * LOCK_RETRY_MAX / 1e3)} \u79D2\u4ECD\u672A\u62FF\u5230\u9501\uFF09`);
}
async function writeQuickBook(book, file = quickStorePath()) {
  await mkdir(dirname(file), { recursive: true });
  const release = await acquireLock(file);
  try {
    await writeLocked(book, file);
  } finally {
    await release();
  }
}
async function writeLocked(book, file) {
  const safe = sanitizeBook(book) ?? { version: QUICK_BOOK_VERSION, categories: [] };
  const tmp = `${file}.${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  const handle = await open(tmp, "w", 384);
  try {
    await handle.writeFile(`${JSON.stringify(bookToFile(safe), null, 2)}
`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmp, file);
}
async function ensureQuickBook(seed, file = quickStorePath()) {
  const current = await readQuickBook(file);
  if (current.kind !== "missing") return current;
  await mkdir(dirname(file), { recursive: true });
  const release = await acquireLock(file);
  try {
    const again = await readQuickBook(file);
    if (again.kind !== "missing") return again;
    const migrated = seed === void 0 ? void 0 : sanitizeBook({ prompts: seed });
    const book = migrated !== void 0 && migrated.categories.length > 0 ? migrated : defaultQuickBook();
    await writeLocked(book, file);
    return { kind: "ok", book };
  } finally {
    await release();
  }
}

// src/settings-lock.ts
import { readFile as readFile2, rm } from "node:fs/promises";
import { dirname as dirname2, join as join2 } from "node:path";
var SETTINGS_LOCK_FILENAME = "package.json.lock";
function staleLockDecision(content, alive) {
  const text = content.trim();
  if (!/^[1-9][0-9]{0,9}$/.test(text)) return { action: "ignore", reason: "unreadable-holder" };
  const pid = Number(text);
  return alive(pid) ? { action: "keep", pid } : { action: "remove", pid };
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
function profileDirOfPatchPath(patchPath) {
  return dirname2(patchPath);
}
async function recoverStaleSettingsLock(profileDir, log) {
  const path = join2(profileDir, SETTINGS_LOCK_FILENAME);
  let content;
  try {
    content = await readFile2(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "absent";
    log(`\u8BFB\u53D6\u5199\u5165\u9501\u5931\u8D25\uFF08${path}\uFF09\uFF1A${String(error)}`);
    return "ignored";
  }
  const decision = staleLockDecision(content, isProcessAlive);
  if (decision.action === "keep") {
    log(`\u5199\u5165\u9501\u7531 PID ${decision.pid} \u6301\u6709\u4E14\u8BE5\u8FDB\u7A0B\u4ECD\u5728\uFF0C\u4FDD\u6301\u4E0D\u52A8\uFF08${path}\uFF09\u3002`);
    return "kept";
  }
  if (decision.action === "ignore") {
    log(`\u5199\u5165\u9501\u5185\u5BB9\u4E0D\u662F PID\uFF0C\u4FDD\u6301\u4E0D\u52A8\uFF08${path}\uFF09\u3002`);
    return "ignored";
  }
  try {
    await rm(path, { force: true });
  } catch (error) {
    log(`\u56DE\u6536\u5B64\u513F\u5199\u5165\u9501\u5931\u8D25\uFF08${path}\uFF09\uFF1A${String(error)}`);
    return "ignored";
  }
  log(
    `\u5DF2\u56DE\u6536\u5B64\u513F\u5199\u5165\u9501\uFF08\u6301\u6709\u8005 PID ${decision.pid} \u4E0D\u5B58\u5728\uFF09\uFF1A${path}\u3002\u5728\u6B64\u4E4B\u524D\u8BE5 profile \u7684\u6BCF\u4E00\u6B21\u8BBE\u7F6E\u5199\u5165\u90FD\u4F1A\u8D85\u65F6\u5931\u8D25\uFF08\u754C\u9762\u8868\u73B0\u4E3A"\u70B9\u4E86\u6CA1\u53CD\u5E94"\uFF09\u3002`
  );
  return "removed";
}

// src/host.ts
var name = "composer-ux";
var PANEL_MIN = 560;
var PANEL_MAX = 4e3;
function plainConfig(value) {
  if (typeof value === "object" && value !== null && typeof value.get === "function") {
    return plainConfig(value.get());
  }
  if (Array.isArray(value)) return value.map(plainConfig);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfig(child)]));
  }
  return value;
}
function makeReader(settings, config) {
  return (ns) => {
    try {
      if (typeof settings?.get === "function") return objectOf2(settings.get(ns));
      if (ns === NAMESPACE) {
        const own = objectOf2(plainConfig(config));
        if (own !== void 0) return own;
      }
      const row = (settings?.describe?.() ?? []).find((candidate) => candidate?.ns === ns);
      return objectOf2(row?.value);
    } catch {
      return void 0;
    }
  };
}
function objectOf2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function textOf2(value) {
  return typeof value === "string" ? value : "";
}
function readOwnSetting(scope, config, field) {
  try {
    const get = scope?.get;
    if (typeof get !== "function") return "";
    const service = get.call(scope, "settings");
    return textOf2(makeReader(service, config)(NAMESPACE)?.[field]);
  } catch {
    return "";
  }
}
function firstHeaderValue(value) {
  if (value === void 0) return void 0;
  return typeof value === "string" ? value : value[0];
}
function bookLooksCustom(book) {
  return JSON.stringify(sanitizeBook(book)) !== JSON.stringify(defaultQuickBook());
}
function nameIsValid(name2) {
  if (name2 === "" || name2.length > HEADER_NAME_MAX) return false;
  try {
    new Headers([[name2, "probe"]]);
    return true;
  } catch {
    return false;
  }
}
function valueIsValid(value) {
  if (value === "" || value.length > HEADER_VALUE_MAX) return false;
  try {
    new Headers([["x-dsh-probe", value]]);
    return true;
  } catch {
    return false;
  }
}
function isOpencodeBaseUrl(value) {
  const raw = textOf2(value).trim();
  if (raw === "") return false;
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase().includes("opencode.ai");
  }
  return OPENCODE_HOSTS.some((name2) => host === name2 || host.endsWith(`.${name2}`));
}
function pickRoutes(providers, listed) {
  const keys = Object.keys(providers);
  if (listed.length === 0) {
    return keys.filter((key) => key.startsWith(OPENCODE_ROUTE_PREFIX) || isOpencodeBaseUrl(objectOf2(providers[key])?.baseURL));
  }
  return listed.filter((key) => Object.prototype.hasOwnProperty.call(providers, key));
}
function errorText3(error) {
  if (error instanceof Error && error.message !== "") return error.message;
  return String(error);
}
async function mirrorHeader(settings, read) {
  const own = read(NAMESPACE);
  if (own === void 0) return;
  const enabled = own[ENABLED_FIELD] === true && own[HEADER_ENABLED_FIELD] === true;
  const name2 = textOf2(own[HEADER_NAME_FIELD]);
  const nameOk = nameIsValid(name2);
  const routesText = parseRouteList(textOf2(own[HEADER_ROUTES_FIELD]));
  let value = textOf2(own[HEADER_VALUE_FIELD]);
  if (enabled && nameOk && value === "") {
    value = newSessionId();
    await settings.mutate(NAMESPACE, [{ op: "set", path: [HEADER_VALUE_FIELD], value }]);
  }
  const llm = read(LLM_NAMESPACE);
  const providers = llm === void 0 ? void 0 : objectOf2(llm.providers);
  const writes = [];
  const applied = [];
  let status = "";
  if (!enabled) {
    status = "";
  } else if (providers === void 0) {
    status = "\u672A\u6302\u8F7D llm-pi-ai\uFF08\u6A21\u578B\u8DEF\u7531\uFF09\u8BBE\u7F6E\uFF0C\u6682\u672A\u5199\u5165";
  } else if (!nameOk) {
    status = "\u5934\u540D\u4E0D\u5408\u6CD5\uFF0C\u672A\u5199\u5165";
  } else if (!valueIsValid(value)) {
    status = `\u5934\u503C\u4E0D\u5408\u6CD5\uFF08\u9700 1\u2013${HEADER_VALUE_MAX} \u5B57\u7B26\u4E14\u5355\u884C\uFF09\uFF0C\u672A\u5199\u5165`;
  } else {
    for (const route of pickRoutes(providers, routesText)) {
      const headers = objectOf2(objectOf2(providers[route])?.headers);
      if (headers?.[name2] !== value) {
        writes.push({ op: "set", path: ["providers", route, "headers", name2], value });
      }
      applied.push(route);
    }
    status = applied.length === 0 ? `\u5DF2\u542F\u7528\uFF0C\u4F46\u6CA1\u6709\u53EF\u5199\u5165\u7684\u8DEF\u7531\uFF08\u76EE\u6807\uFF1A${routesText.length === 0 ? `\u81EA\u52A8\uFF08\u540D\u5B57\u4EE5 ${OPENCODE_ROUTE_PREFIX} \u5F00\u5934\uFF0C\u6216 baseURL \u6307\u5411 opencode.ai\uFF09` : routesText.join("\u3001")}\uFF09` : `\u5DF2\u5199\u5165 ${applied.join("\u3001")}`;
  }
  const stale = [];
  if (providers !== void 0) {
    const previousName = textOf2(own[HEADER_APPLIED_NAME_FIELD]);
    const previousValue = textOf2(own[HEADER_APPLIED_VALUE_FIELD]);
    const ours = /* @__PURE__ */ new Set([textOf2(own[HEADER_VALUE_FIELD]), previousValue]);
    ours.delete("");
    const targets = new Set(applied.map((route) => `${route}\0${name2}`));
    const candidates = /* @__PURE__ */ new Set([previousName, nameOk ? name2 : ""]);
    candidates.delete("");
    for (const candidate of candidates) {
      for (const [route, profile] of Object.entries(providers)) {
        if (targets.has(`${route}\0${candidate}`)) continue;
        const headers = objectOf2(objectOf2(profile)?.headers);
        const current = headers?.[candidate];
        if (typeof current !== "string" || !ours.has(current)) continue;
        stale.push({ op: "unset", path: ["providers", route, "headers", candidate] });
      }
    }
  }
  const providerOps = [...writes, ...stale];
  let failed = false;
  if (providerOps.length > 0) {
    try {
      await settings.mutate(LLM_NAMESPACE, providerOps);
    } catch (error) {
      failed = true;
      status = `\u5199\u5165\u5931\u8D25\uFF1A${errorText3(error)}`;
    }
  }
  const nextAppliedName = !failed && applied.length > 0 ? name2 : "";
  const nextAppliedValue = !failed && applied.length > 0 ? value : "";
  const ownOps = [];
  if (textOf2(own[HEADER_APPLIED_NAME_FIELD]) !== nextAppliedName) {
    ownOps.push({ op: "set", path: [HEADER_APPLIED_NAME_FIELD], value: nextAppliedName });
  }
  if (textOf2(own[HEADER_APPLIED_VALUE_FIELD]) !== nextAppliedValue) {
    ownOps.push({ op: "set", path: [HEADER_APPLIED_VALUE_FIELD], value: nextAppliedValue });
  }
  if (textOf2(own[HEADER_STATUS_FIELD]) !== status) {
    ownOps.push({ op: "set", path: [HEADER_STATUS_FIELD], value: status });
  }
  if (ownOps.length > 0) await settings.mutate(NAMESPACE, ownOps);
}
function ownSchema() {
  return Schema.object({
    [ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.enabled),
    // 五栏开关。**故意不给默认值、声明成可选**：迁移要用的信息就是"文档里有没有这个键"
    // —— 没有 ⇒ 从没碰过这一栏 ⇒ 关闭；有 ⇒ 用户碰过 ⇒ 保持他写下的值。
    // 给了静态默认值就再也分不出这两种情况了（净化的 sectionEnabledOf 靠它）。
    [KEYS_ENABLED_FIELD]: Schema.boolean().required(false),
    [MENU_ENABLED_FIELD]: Schema.boolean().required(false),
    [QUICK_ENABLED_FIELD]: Schema.boolean().required(false),
    [PANEL_ENABLED_FIELD]: Schema.boolean().required(false),
    [TERMINAL_ENABLED_FIELD]: Schema.boolean().required(false),
    [SEND_KEY_FIELD]: Schema.string().default(DEFAULT_SETTINGS.sendKey),
    [NEWLINE_KEY_FIELD]: Schema.string().default(DEFAULT_SETTINGS.newlineKey),
    ...Object.fromEntries(MENU_FIELDS.map((field) => [
      field,
      Schema.boolean().default(DEFAULT_SETTINGS[field])
    ])),
    // 右键菜单模式（0.5.0 起三档）。**故意不给默认值、且声明成可选**：
    // 「文档里没有这个键」本身就是迁移要用的信息——净化据此按旧布尔 menuNative
    // 推断（见 menuModeFrom）。给了默认值就再也分不出「从没设置过」与「明确设成了它」。
    [MENU_MODE_FIELD]: Schema.string().required(false),
    // 旧的布尔字段：只作迁移线索，故同样不给默认值——旧文档里的 true / false
    // 都要保住原意（true = 浏览器菜单、false = 明确选过自定义菜单）。
    [MENU_NATIVE_FIELD]: Schema.boolean().required(false),
    // 「导航滚动」在 0.6.0 随功能一起删掉了（DSH 0.1.7 的官方设置页自带导航列滚动）。
    // 旧文档里可能仍留着 panelScroll：schemastery 对未声明键是**原样放行**（已实测），
    // 所以不需要为它保留一个宽容字段，升级时也不会因此判非法。
    [PANEL_RESIZE_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.panelResize),
    // schemastery 无 .optional()：可选键用 .required(false)。
    [PANEL_WIDTH_FIELD]: Schema.number().min(PANEL_MIN).max(PANEL_MAX).required(false),
    [PANEL_HEIGHT_FIELD]: Schema.number().min(320).max(PANEL_MAX).required(false),
    // OpenCode 请求头栏目（值由宿主半按 llm-pi-ai 的 Fetch 规则自校验后再写入）。
    [HEADER_ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.headerEnabled),
    [HEADER_NAME_FIELD]: Schema.string().default(DEFAULT_HEADER_NAME),
    [HEADER_VALUE_FIELD]: Schema.string().default(DEFAULT_SETTINGS.headerValue),
    [HEADER_ROUTES_FIELD]: Schema.string().default(DEFAULT_SETTINGS.headerRoutes),
    [HEADER_APPLIED_NAME_FIELD]: Schema.string().default(DEFAULT_SETTINGS.headerAppliedName),
    [HEADER_APPLIED_VALUE_FIELD]: Schema.string().default(DEFAULT_SETTINGS.headerAppliedValue),
    [HEADER_STATUS_FIELD]: Schema.string().default(DEFAULT_SETTINGS.headerStatus),
    // 快捷指令列表：结构固定为 {id,label,prompt,always}，逐条自带默认值，
    // 让旧设置文档（没有这个键）在读取时直接得到内置 9 条。
    [QUICK_PROMPTS_FIELD]: Schema.array(Schema.object({
      id: Schema.string().default(""),
      label: Schema.string().default(""),
      prompt: Schema.string().default(""),
      always: Schema.boolean().default(false)
    })).default(DEFAULT_QUICK_PROMPTS.map((item) => ({ ...item }))),
    [OPTIMIZER_TIER_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerTier),
    // 三档的自定义系统提示词：默认空串 = 用内置那份（空串同时就是「恢复内置」写回的值）。
    [OPTIMIZER_PROMPT_FIELDS.basic]: Schema.string().default(DEFAULT_SETTINGS.optimizerPromptBasic),
    [OPTIMIZER_PROMPT_FIELDS.advanced]: Schema.string().default(DEFAULT_SETTINGS.optimizerPromptAdvanced),
    [OPTIMIZER_PROMPT_FIELDS.extreme]: Schema.string().default(DEFAULT_SETTINGS.optimizerPromptExtreme),
    // 「默认终端」（0.5.0 起）：用户档位与可选路径。
    [TERMINAL_MODE_FIELD]: Schema.string().default(DEFAULT_SETTINGS.terminalMode),
    [TERMINAL_BASH_PATH_FIELD]: Schema.string().default(DEFAULT_SETTINGS.terminalBashPath),
    // 宿主半自持的三项：探测候选、状态行、当前生效 shell（见 HOST_OWNED_FIELDS）。
    [TERMINAL_CANDIDATES_FIELD]: Schema.array(Schema.object({
      path: Schema.string().default(""),
      label: Schema.string().default(""),
      kind: Schema.string().default("path"),
      explicit: Schema.boolean().default(false)
    })).default([]),
    [TERMINAL_STATUS_FIELD]: Schema.string().default(DEFAULT_SETTINGS.terminalStatus),
    [TERMINAL_EFFECTIVE_FIELD]: Schema.string().default(DEFAULT_SETTINGS.terminalEffective)
  });
}
function markVolatileField(node) {
  const withMethod = node;
  if (typeof withMethod.volatile === "function") return withMethod.volatile();
  const target = node;
  if (target.meta !== void 0) target.meta.volatile = true;
  return node;
}
function markVolatile(schema) {
  const dict = schema.dict;
  if (dict === void 0) return schema;
  for (const key of Object.keys(dict)) dict[key] = markVolatileField(dict[key]);
  return schema;
}
var Config = markVolatile(ownSchema());
function apply(ctx, config) {
  const readView = (service) => {
    if (service === null || service === void 0) return void 0;
    const real = service;
    return { get: makeReader(real, config), mutate: (ns, ops) => real.mutate(ns, ops) };
  };
  ctx.inject(["configEditor"], (lockCtx) => {
    try {
      const documentPath = lockCtx.configEditor.documentPath;
      if (typeof documentPath !== "string" || documentPath === "") return;
      void recoverStaleSettingsLock(profileDirOfPatchPath(documentPath), (message) => {
        console.warn(`[composer-ux] ${message}`);
      }).catch((error) => {
        console.error("[composer-ux] \u5B64\u513F\u5199\u5165\u9501\u68C0\u67E5\u5931\u8D25", error);
      });
    } catch (error) {
      console.error("[composer-ux] \u5B64\u513F\u5199\u5165\u9501\u68C0\u67E5\u5931\u8D25", error);
    }
  });
  ctx.inject(["settings"], (settingsCtx) => {
    const settings = settingsCtx.settings;
    if (typeof settings.register === "function") settings.register(NAMESPACE, Config);
    const read = makeReader(settings, config);
    let busy = false;
    let again = false;
    const sync = () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      void mirrorHeader(settings, read).catch((error) => {
        console.error("[composer-ux] \u8BF7\u6C42\u5934\u955C\u50CF\u5931\u8D25", error);
      }).finally(() => {
        busy = false;
        if (again) {
          again = false;
          sync();
        }
      });
    };
    const onSettingsUpdated = (ns) => {
      if (ns === NAMESPACE || ns === LLM_NAMESPACE) sync();
    };
    for (const event of ["settings/updated", "settings/document-updated"]) {
      ctx.on(event, onSettingsUpdated);
    }
    sync();
  });
  ctx.inject(["webServer", "llm"], (optCtx) => {
    const LLM_TIMEOUT_MS = 18e4;
    const BODY_MAX_BYTES = 1e6;
    const TEXT_MAX = OPTIMIZE_TEXT_MAX;
    const sendJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };
    const readBody = async (req) => {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        total += buf.length;
        if (total > BODY_MAX_BYTES) throw new Error("\u8BF7\u6C42\u4F53\u8FC7\u5927");
        chunks.push(buf);
      }
      return Buffer.concat(chunks).toString("utf8");
    };
    const resolveRoute = (payload) => {
      const provider = textOf2(payload.provider);
      const model = textOf2(payload.model);
      if (provider !== "" && model !== "") return { provider, model };
      try {
        const selector = optCtx.get("agentDefaultModel");
        const current = selector?.currentSelection?.();
        return { provider: textOf2(current?.provider), model: textOf2(current?.model) };
      } catch {
        return { provider: "", model: "" };
      }
    };
    const handle = async (req, res) => {
      if ((req.method ?? "GET").toUpperCase() !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 POST" });
        return;
      }
      let payload;
      try {
        payload = objectOf2(JSON.parse(await readBody(req))) ?? {};
      } catch (error) {
        sendJson(res, 400, { ok: false, error: `\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText3(error)}` });
        return;
      }
      const text = textOf2(payload.text).trim();
      if (text === "") {
        sendJson(res, 400, { ok: false, error: "\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF0C\u6CA1\u6709\u53EF\u4F18\u5316\u7684\u5185\u5BB9" });
        return;
      }
      if (text.length > TEXT_MAX) {
        sendJson(res, 400, { ok: false, error: `\u539F\u6587\u8FC7\u957F\uFF08\u4E0A\u9650 ${TEXT_MAX} \u5B57\u7B26\uFF09` });
        return;
      }
      const tier = textOf2(payload.tier) === "" ? DEFAULT_OPTIMIZER_TIER : textOf2(payload.tier);
      const route = resolveRoute(payload);
      if (route.provider === "" || route.model === "") {
        sendJson(res, 200, { ok: false, error: "\u62FF\u4E0D\u5230\u5F53\u524D\u7684\u6A21\u578B\u8DEF\u7531\uFF0C\u65E0\u6CD5\u4F18\u5316\uFF08\u8BF7\u5148\u5728\u8F93\u5165\u6846\u65C1\u7684\u6A21\u578B\u9009\u62E9\u5668\u91CC\u9009\u4E00\u4E2A\u6A21\u578B\uFF09" });
        return;
      }
      const customPrompt = readOwnSetting(optCtx, config, optimizerPromptFieldOf(tier));
      const system = buildOptimizeSystem(tier, customPrompt);
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, LLM_TIMEOUT_MS);
      const runOnce = async (userText) => {
        let out = "";
        let failure = "";
        try {
          const stream = optCtx.llm.stream({
            provider: route.provider,
            model: route.model,
            system,
            temperature: buildOptimizeTemperature(tier),
            signal: controller.signal,
            messages: [{
              id: `optimize-${Date.now().toString(36)}`,
              role: "user",
              content: [{ type: "text", text: userText }],
              source: { kind: "user" }
            }]
          });
          for await (const chunk of stream) {
            if (chunk.type === "text-delta") {
              out += String(chunk.text ?? "");
              if (out.length > OPTIMIZE_OUTPUT_MAX * 4) break;
            } else if (chunk.type === "finish") {
              const reason = objectOf2(chunk.reason);
              if (reason?.kind === "error" || reason?.kind === "aborted") {
                const detail = objectOf2(reason.failure);
                failure = textOf2(detail?.message) || (reason.kind === "aborted" ? "\u4F18\u5316\u88AB\u4E2D\u65AD" : "\u6A21\u578B\u8FD4\u56DE\u9519\u8BEF");
              }
            }
          }
        } catch (error) {
          failure = errorText3(error);
        }
        return { out, failure };
      };
      let retried = false;
      let result;
      try {
        result = await runOnce(buildOptimizeUser(text));
        if (result.out.trim() === "" && result.failure === "") {
          retried = true;
          const second = await runOnce(buildOptimizeUser(text, { retry: true, reason: "\u5BBF\u4E3B\u6CA1\u6709\u6536\u5230\u4EFB\u4F55\u6761\u76EE" }));
          if (second.out.trim() !== "") result = second;
          else if (result.failure === "") result = second;
        }
      } finally {
        clearTimeout(timer);
      }
      if (result.out.trim() === "") {
        sendJson(res, 200, {
          ok: false,
          error: result.failure === "" ? "\u6A21\u578B\u6CA1\u6709\u4EA7\u51FA\u4EFB\u4F55\u5185\u5BB9" : `\u4F18\u5316\u5931\u8D25\uFF1A${result.failure}`,
          retried
        });
        return;
      }
      const assembled = runOptimizePipeline(result.out, text, { tier });
      if (!assembled.ok) {
        sendJson(res, 200, {
          ok: false,
          error: `\u6A21\u578B\u8F93\u51FA\u4E0D\u662F\u53EF\u7528\u7684\u6761\u76EE JSON\uFF08${assembled.code}\uFF09\uFF1A${assembled.reason}`,
          retried
        });
        return;
      }
      const optimized = assembled.text.trim();
      if (optimized === "") {
        sendJson(res, 200, { ok: false, error: "\u88C5\u914D\u540E\u662F\u7A7A\u7684\uFF08\u6A21\u578B\u6CA1\u6709\u7ED9\u51FA\u53EF\u6838\u5B9E\u7684\u6761\u76EE\uFF09", retried });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        text: optimized,
        // 语义收窄：`truncated` 现在专指"篇幅闸门真的动过手"（装了必保节仍超预算）。
        truncated: assembled.overBudget,
        provider: route.provider,
        model: route.model,
        // ── 以下为 0.6.0 新增的**附加**字段：老客户端不读它们也不会坏。
        promptSource: optimizePromptSource(customPrompt),
        retried,
        fallback: assembled.fallback,
        itemCount: assembled.itemCount,
        rewrittenChars: assembled.rewrittenChars,
        dropped: assembled.dropped,
        warnings: assembled.warnings,
        budget: assembled.budget,
        chars: assembled.chars
      });
    };
    optCtx.effect(() => optCtx.webServer.register({
      kind: "exact",
      path: OPTIMIZER_API_PATH,
      handler: handle
    }), "composer-ux: prompt optimizer route");
  });
  ctx.inject(["webServer"], (storeCtx) => {
    const BODY_MAX_BYTES = 8e6;
    const sendJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };
    const readBody = async (req) => {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        total += buf.length;
        if (total > BODY_MAX_BYTES) throw new Error("\u8BF7\u6C42\u4F53\u8FC7\u5927");
        chunks.push(buf);
      }
      return Buffer.concat(chunks).toString("utf8");
    };
    const legacyPrompts = () => {
      try {
        const settings = storeCtx.get("settings");
        const row = makeReader(settings, config)(NAMESPACE);
        const list = row?.[QUICK_PROMPTS_FIELD];
        return Array.isArray(list) ? list : void 0;
      } catch {
        return void 0;
      }
    };
    const handle = async (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
        return;
      }
      const file = quickStorePath();
      const outcome = await ensureQuickBook(legacyPrompts(), file);
      if (outcome.kind === "broken") {
        sendJson(res, 200, {
          ok: false,
          file,
          error: `\u5FEB\u6377\u6307\u4EE4\u6587\u4EF6\u8BFB\u4E0D\u4E86\uFF1A${outcome.error}`,
          quarantined: outcome.quarantined ?? ""
        });
        return;
      }
      if (method === "GET") {
        sendJson(res, 200, { ok: true, file, book: outcome.book });
        return;
      }
      let payload;
      try {
        payload = objectOf2(JSON.parse(await readBody(req))) ?? {};
      } catch (error) {
        sendJson(res, 400, { ok: false, error: `\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText3(error)}` });
        return;
      }
      const candidate = payload.book !== void 0 ? payload.book : payload;
      const next = sanitizeBook(candidate);
      if (next === void 0) {
        sendJson(res, 400, {
          ok: false,
          error: "\u63D0\u4EA4\u7684\u7ED3\u6784\u8BA4\u4E0D\u51FA\uFF08\u671F\u671B { book: { categories: [...] } } \u6216 { categories: [...] }\uFF09"
        });
        return;
      }
      try {
        await writeQuickBook(next, file);
      } catch (error) {
        sendJson(res, 500, { ok: false, error: `\u5199\u5165\u5931\u8D25\uFF1A${errorText3(error)}` });
        return;
      }
      const verified = await readQuickBook(file);
      sendJson(res, 200, { ok: true, file, book: verified.kind === "ok" ? verified.book : next });
    };
    storeCtx.effect(() => storeCtx.webServer.register({
      kind: "exact",
      path: QUICK_PROMPTS_API_PATH,
      handler: handle
    }), "composer-ux: quick prompt store route");
  });
  ctx.inject(["settings", "webServer"], (termCtx) => {
    const readToolDeps = () => {
      const subprocess = termCtx.get("subprocess");
      if (subprocess === void 0) return void 0;
      const sandbox = termCtx.get("sandbox");
      const sandboxPolicy = termCtx.get("sandboxPolicy");
      const approval = termCtx.get("approval");
      const jobs = termCtx.get("jobs");
      const shellEnv = termCtx.get("shellEnv");
      return {
        subprocess,
        ...sandbox === void 0 ? {} : { sandbox },
        ...sandboxPolicy === void 0 ? {} : { sandboxPolicy },
        ...approval === void 0 ? {} : { approval },
        ...jobs === void 0 ? {} : { jobs },
        ...shellEnv === void 0 ? {} : { shellEnv }
      };
    };
    installTerminalPolicy(
      termCtx,
      NAMESPACE,
      readView(termCtx.get("settings")),
      readToolDeps
    );
  });
  ctx.inject(["settings"], (migrateCtx) => {
    void (async () => {
      const service = migrateCtx.get("settings");
      if (service === void 0) return;
      const row = makeReader(service, config)(NAMESPACE);
      if (row === void 0 || row[QUICK_ENABLED_FIELD] !== void 0) return;
      try {
        const outcome = await readQuickBook(quickStorePath());
        if (outcome.kind !== "ok" || !bookLooksCustom(outcome.book)) return;
        await service.mutate(NAMESPACE, [
          { op: "set", path: [QUICK_ENABLED_FIELD], value: true }
        ]);
      } catch (error) {
        console.error("[composer-ux] quick section migration skipped", error);
      }
    })();
  });
  ctx.inject(["webServer"], (restartCtx) => {
    const BOOT_ID = bootId(process.pid, Date.now());
    const blockedBy = () => {
      const supervisor = detectedSupervisor({
        env: process.env,
        ppid: process.ppid,
        parentComm: (pid) => {
          try {
            return readFileSync(`/proc/${String(pid)}/comm`, "utf8").trim();
          } catch {
            return null;
          }
        }
      });
      if (supervisor !== null) return `supervised:${supervisor}`;
      if (detectedDebugger({
        inspectorUrl: inspector.url(),
        execArgv: process.execArgv,
        nodeOptions: process.env.NODE_OPTIONS
      }) !== null) return "debugger";
      return null;
    };
    const buildIo = () => ({
      platform: process.platform,
      pid: process.pid,
      argv0: process.argv0,
      execPath: process.execPath,
      argv1: process.argv[1],
      execArgv: process.execArgv,
      // argv[0] 是 node 自己、argv[1] 是入口；重放的是"入口 + 之后的参数"。
      rest: process.argv.slice(2),
      cwd: process.cwd(),
      env: process.env,
      tmpdir: tmpdir(),
      stamp: (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19),
      exists: (path) => existsSync2(path),
      resolve: (path) => resolve2(path),
      dirname: (path) => dirname3(path),
      join: (...parts) => join3(...parts),
      spawn: (command, args, options) => spawn(command, [...args], {
        detached: options.detached,
        stdio: options.stdio,
        windowsHide: options.windowsHide,
        env: options.env
      }),
      stop: () => {
        gracefulStop({
          emitSignal: (signal) => {
            process.emit(signal);
          },
          exit: (code) => {
            process.exit(code);
          },
          timer: (ms, run) => {
            setTimeout(run, ms);
          }
        });
      },
      wait: (ms) => new Promise((done) => {
        setTimeout(done, ms);
      })
    });
    let restarting = false;
    const planForDisplay = () => {
      const io = buildIo();
      const plan = planRestart(io, null);
      return {
        command: [plan.respawn.file, ...plan.respawn.args].join(" "),
        execPath: plan.node,
        logHint: join3(io.tmpdir, `${RESTART_LOG_PREFIX}*.err.log`)
      };
    };
    restartCtx.effect(() => restartCtx.webServer.register({
      kind: "exact",
      path: RESTART_API_PATH,
      handler: (req, res) => {
        const send = (code, payload) => {
          res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          res.end(JSON.stringify(payload));
        };
        const connection = restartCtx.get("connection");
        const rejection = connection?.requestRejection?.(req);
        if (rejection !== void 0) {
          res.statusCode = rejection;
          res.end();
          return;
        }
        const agents = restartCtx.get("agents");
        const running = agents?.list?.().length ?? 0;
        const blocked = blockedBy();
        const method = (req.method ?? "GET").toUpperCase();
        if (method !== "GET" && method !== "POST") {
          res.writeHead(405, { allow: "GET, POST" });
          res.end();
          return;
        }
        if (method === "GET") {
          const plan = planForDisplay();
          send(200, { ok: true, ...plan, running, blocked, boot: BOOT_ID });
          return;
        }
        if (!trustedRestartRequest({
          remoteAddress: req.socket?.remoteAddress,
          headers: req.headers ?? {}
        })) {
          send(403, { ok: false, error: "restart is limited to same-origin loopback requests" });
          return;
        }
        if (blocked !== null) {
          send(403, { ok: false, error: blocked === "debugger" ? "self-restart is disabled while the host is under a debugger" : `restart belongs to the ${blocked.slice("supervised:".length)} supervisor on this host` });
          return;
        }
        if (restarting) {
          send(409, { ok: false, error: "restart already scheduled" });
          return;
        }
        restarting = true;
        try {
          const scheduled = scheduleRestart(buildIo(), servingPort(firstHeaderValue(req.headers?.host)));
          send(202, { ok: true, boot: BOOT_ID, running, ...scheduled });
        } catch (error) {
          restarting = false;
          send(500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }), "composer-ux: restart route");
  });
}
export {
  Config,
  apply,
  name
};
//# sourceMappingURL=index.js.map
