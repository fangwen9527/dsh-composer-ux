// <bundled dependency>
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
  const cached2 = refs.get(source);
  if (cached2) return cached2;
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

// <bundled dependency>
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
Schema.extend = function extend(type, resolve5) {
  resolvers[type] = resolve5;
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
import { execFileSync, spawn as spawn2 } from "node:child_process";
import { existsSync as existsSync6, mkdirSync as mkdirSync3, readFileSync as readFileSync5, rmSync as rmSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { tmpdir } from "node:os";
import { dirname as dirname8, join as join8, resolve as resolve4 } from "node:path";
import inspector from "node:inspector";

// src/provider-prices.ts
var BUILTIN_PROVIDER_PRICES = {
  "openai": {
    "gpt-3.5-turbo": { miss: 0.5, hit: 0, out: 1.5 },
    "gpt-4": { miss: 30, hit: 30, out: 60 },
    "gpt-4-turbo": { miss: 10, hit: 10, out: 30 },
    "gpt-4.1": { miss: 2, hit: 0.5, out: 8 },
    "gpt-4.1-mini": { miss: 0.4, hit: 0.1, out: 1.6 },
    "gpt-4.1-nano": { miss: 0.1, hit: 0.025, out: 0.4 },
    "gpt-4o": { miss: 2.5, hit: 1.25, out: 10 },
    "gpt-4o-2024-05-13": { miss: 5, hit: 5, out: 15 },
    "gpt-4o-2024-08-06": { miss: 2.5, hit: 1.25, out: 10 },
    "gpt-4o-2024-11-20": { miss: 2.5, hit: 1.25, out: 10 },
    "gpt-4o-mini": { miss: 0.15, hit: 0.075, out: 0.6 },
    "gpt-5": { miss: 1.25, hit: 0.125, out: 10 },
    "gpt-5-mini": { miss: 0.25, hit: 0.025, out: 2 },
    "gpt-5-nano": { miss: 0.05, hit: 5e-3, out: 0.4 },
    "gpt-5-pro": { miss: 15, hit: 15, out: 120 },
    "gpt-5.1": { miss: 1.25, hit: 0.125, out: 10 },
    "gpt-5.2": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.2-chat-latest": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.2-pro": { miss: 21, hit: 21, out: 168 },
    "gpt-5.3-chat-latest": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.3-codex": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.3-codex-spark": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.4": { miss: 2.5, hit: 0.25, out: 15 },
    "gpt-5.4-mini": { miss: 0.75, hit: 0.075, out: 4.5 },
    "gpt-5.4-nano": { miss: 0.2, hit: 0.02, out: 1.25 },
    "gpt-5.4-pro": { miss: 30, hit: 30, out: 180 },
    "gpt-5.5": { miss: 5, hit: 0.5, out: 30 },
    "gpt-5.5-pro": { miss: 30, hit: 30, out: 180 },
    "gpt-5.6": { miss: 4, hit: 0.4, out: 20 },
    "gpt-5.6-luna": { miss: 0.2, hit: 0.02, out: 1.2 },
    "gpt-5.6-sol": { miss: 4, hit: 0.4, out: 20 },
    "gpt-5.6-terra": { miss: 2, hit: 0.2, out: 12 },
    "gpt-6-astra": { miss: 10, hit: 1, out: 50 },
    "gpt-6-luna": { miss: 0.1, hit: 0.01, out: 0.5 },
    "gpt-6-sol": { miss: 2, hit: 0.2, out: 10 },
    "gpt-daybreak-blue-latest": { miss: 4, hit: 0.4, out: 20 },
    "gpt-daybreak-red-latest": { miss: 12.5, hit: 1.25, out: 75 },
    "gpt-image-2": { miss: 5, hit: 1.25, out: 30 },
    "gpt-realtime-2.1": { miss: 4, hit: 0.4, out: 24 },
    "o1": { miss: 15, hit: 7.5, out: 60 },
    "o1-pro": { miss: 150, hit: 150, out: 600 },
    "o3": { miss: 2, hit: 0.5, out: 8 },
    "o3-mini": { miss: 1.1, hit: 0.55, out: 4.4 },
    "o3-pro": { miss: 20, hit: 20, out: 80 },
    "o4-mini": { miss: 1.1, hit: 0.275, out: 4.4 },
    "text-embedding-3-large": { miss: 0.13, hit: 0.13, out: 0 },
    "text-embedding-3-small": { miss: 0.02, hit: 0.02, out: 0 },
    "text-embedding-ada-002": { miss: 0.1, hit: 0.1, out: 0 }
  },
  "anthropic": {
    "claude-fable-5": { miss: 10, hit: 1, out: 50 },
    "claude-fable-5-1": { miss: 10, hit: 0.25, out: 50 },
    "claude-haiku-4-5": { miss: 1, hit: 0.1, out: 5 },
    "claude-haiku-4-5-20251001": { miss: 1, hit: 0.1, out: 5 },
    "claude-opus-4-5": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-5-20251101": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-6": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-7": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-8": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-5": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-5-5": { miss: 4, hit: 0.2, out: 20 },
    "claude-sonnet-4-5": { miss: 3, hit: 0.3, out: 15 },
    "claude-sonnet-4-5-20250929": { miss: 3, hit: 0.3, out: 15 },
    "claude-sonnet-4-6": { miss: 3, hit: 0.3, out: 15 },
    "claude-sonnet-5": { miss: 2, hit: 0.2, out: 10 }
  },
  "google": {
    "deep-research-max-preview-04-2026": { miss: 2, hit: 0.2, out: 12 },
    "deep-research-preview-04-2026": { miss: 2, hit: 0.2, out: 12 },
    "gemini-2.5-computer-use-preview-10-2025": { miss: 1.25, hit: 1.25, out: 10 },
    "gemini-2.5-flash": { miss: 0.3, hit: 0.03, out: 2.5 },
    "gemini-2.5-flash-image": { miss: 0.3, hit: 0.075, out: 30 },
    "gemini-2.5-flash-lite": { miss: 0.1, hit: 0.01, out: 0.4 },
    "gemini-2.5-flash-preview-tts": { miss: 0.5, hit: 0.5, out: 10 },
    "gemini-2.5-pro": { miss: 1.25, hit: 0.125, out: 10 },
    "gemini-2.5-pro-preview-tts": { miss: 1, hit: 1, out: 20 },
    "gemini-3-flash-preview": { miss: 0.5, hit: 0.05, out: 3 },
    "gemini-3-pro-image": { miss: 2, hit: 2, out: 120 },
    "gemini-3-pro-image-preview": { miss: 2, hit: 2, out: 120 },
    "gemini-3.1-flash-image": { miss: 0.5, hit: 0.5, out: 60 },
    "gemini-3.1-flash-image-preview": { miss: 0.5, hit: 0.5, out: 60 },
    "gemini-3.1-flash-lite": { miss: 0.25, hit: 0.025, out: 1.5 },
    "gemini-3.1-flash-lite-image": { miss: 0.25, hit: 0.25, out: 30 },
    "gemini-3.1-flash-lite-preview": { miss: 0.25, hit: 0.025, out: 1.5 },
    "gemini-3.1-flash-live-preview": { miss: 0.75, hit: 0.75, out: 4.5 },
    "gemini-3.1-flash-tts-preview": { miss: 1, hit: 1, out: 20 },
    "gemini-3.1-pro-preview": { miss: 2, hit: 0.2, out: 12 },
    "gemini-3.1-pro-preview-customtools": { miss: 2, hit: 0.2, out: 12 },
    "gemini-3.5-flash": { miss: 1.5, hit: 0.15, out: 9 },
    "gemini-3.5-flash-lite": { miss: 0.3, hit: 0.03, out: 2.5 },
    "gemini-3.5-live-translate-preview": { miss: 3.5, hit: 3.5, out: 21 },
    "gemini-3.6-flash": { miss: 0.75, hit: 0.075, out: 3.75 },
    "gemini-3.7-flash": { miss: 0.75, hit: 0.075, out: 3.75 },
    "gemini-3.8-flash": { miss: 0.75, hit: 0.075, out: 3.75 },
    "gemini-embedding-001": { miss: 0.15, hit: 0.15, out: 0 },
    "gemini-embedding-2": { miss: 0.2, hit: 0.2, out: 0 },
    "gemini-flash-latest": { miss: 0.75, hit: 0.075, out: 3.75 },
    "gemini-flash-lite-latest": { miss: 0.3, hit: 0.03, out: 2.5 },
    "gemini-omni-flash-preview": { miss: 1.5, hit: 1.5, out: 17.5 },
    "lyria-3-clip-preview": { miss: 0, hit: 0, out: 0 },
    "lyria-3-pro-preview": { miss: 0, hit: 0, out: 0 }
  },
  "moonshotai": {
    "kimi-k2.6": { miss: 0.95, hit: 0.16, out: 4 },
    "kimi-k2.7-code": { miss: 0.95, hit: 0.19, out: 4 },
    "kimi-k2.7-code-highspeed": { miss: 1.9, hit: 0.38, out: 8 },
    "kimi-k3": { miss: 3, hit: 0.3, out: 15 }
  },
  "zhipuai": {
    "glm-4.5": { miss: 0.6, hit: 0.11, out: 2.2 },
    "glm-4.5-air": { miss: 0.2, hit: 0.03, out: 1.1 },
    "glm-4.5-flash": { miss: 0, hit: 0, out: 0 },
    "glm-4.5v": { miss: 0.6, hit: 0.6, out: 1.8 },
    "glm-4.6": { miss: 0.6, hit: 0.11, out: 2.2 },
    "glm-4.6v": { miss: 0.3, hit: 0.3, out: 0.9 },
    "glm-4.6v-flash": { miss: 0, hit: 0, out: 0 },
    "glm-4.7": { miss: 0.6, hit: 0.11, out: 2.2 },
    "glm-4.7-flash": { miss: 0, hit: 0, out: 0 },
    "glm-4.7-flashx": { miss: 0.07, hit: 0.01, out: 0.4 },
    "glm-5": { miss: 1, hit: 0.2, out: 3.2 },
    "glm-5.1": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.2": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.3": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.3-flash": { miss: 0.15, hit: 0.03, out: 0.5 },
    "glm-5.3-flashx": { miss: 0.37, hit: 0.075, out: 1.25 },
    "glm-5v-turbo": { miss: 5, hit: 1.2, out: 22 }
  },
  "minimax": {
    "minimax-m2": { miss: 0.3, hit: 0.3, out: 1.2 },
    "minimax-m2.1": { miss: 0.3, hit: 0.03, out: 1.2 },
    "minimax-m2.5": { miss: 0.3, hit: 0.03, out: 1.2 },
    "minimax-m2.5-highspeed": { miss: 0.6, hit: 0.06, out: 2.4 },
    "minimax-m2.7": { miss: 0.3, hit: 0.06, out: 1.2 },
    "minimax-m2.7-highspeed": { miss: 0.6, hit: 0.06, out: 2.4 },
    "minimax-m3": { miss: 0.3, hit: 0.06, out: 1.2 }
  },
  "alibaba": {
    "deepseek-v4-flash-0731": { miss: 0.2, hit: 0.04, out: 0.4 },
    "glm-5.2": { miss: 1.4, hit: 0.28, out: 4.4 },
    "kimi-k3": { miss: 3, hit: 0.3, out: 15 },
    "qvq-max": { miss: 1.2, hit: 1.2, out: 4.8 },
    "qwen-flash": { miss: 0.05, hit: 0.05, out: 0.4 },
    "qwen-max": { miss: 1.6, hit: 1.6, out: 6.4 },
    "qwen-mt-plus": { miss: 2.46, hit: 2.46, out: 7.37 },
    "qwen-mt-turbo": { miss: 0.16, hit: 0.16, out: 0.49 },
    "qwen-omni-turbo": { miss: 0.07, hit: 0.07, out: 0.27 },
    "qwen-omni-turbo-realtime": { miss: 0.27, hit: 0.27, out: 1.07 },
    "qwen-plus": { miss: 0.4, hit: 0.4, out: 1.2 },
    "qwen-plus-character-ja": { miss: 0.5, hit: 0.5, out: 1.4 },
    "qwen-turbo": { miss: 0.05, hit: 0.05, out: 0.2 },
    "qwen-vl-max": { miss: 0.8, hit: 0.8, out: 3.2 },
    "qwen-vl-ocr": { miss: 0.72, hit: 0.72, out: 0.72 },
    "qwen-vl-plus": { miss: 0.21, hit: 0.21, out: 0.63 },
    "qwen2-5-14b-instruct": { miss: 0.35, hit: 0.35, out: 1.4 },
    "qwen2-5-32b-instruct": { miss: 0.7, hit: 0.7, out: 2.8 },
    "qwen2-5-72b-instruct": { miss: 1.4, hit: 1.4, out: 5.6 },
    "qwen2-5-7b-instruct": { miss: 0.175, hit: 0.175, out: 0.7 },
    "qwen2-5-omni-7b": { miss: 0.1, hit: 0.1, out: 0.4 },
    "qwen2-5-vl-72b-instruct": { miss: 2.8, hit: 2.8, out: 8.4 },
    "qwen2-5-vl-7b-instruct": { miss: 0.35, hit: 0.35, out: 1.05 },
    "qwen3-14b": { miss: 0.35, hit: 0.35, out: 1.4 },
    "qwen3-235b-a22b": { miss: 0.7, hit: 0.7, out: 2.8 },
    "qwen3-32b": { miss: 0.7, hit: 0.7, out: 2.8 },
    "qwen3-8b": { miss: 0.18, hit: 0.18, out: 0.7 },
    "qwen3-asr-flash": { miss: 0.035, hit: 0.035, out: 0.035 },
    "qwen3-coder-30b-a3b-instruct": { miss: 0.45, hit: 0.45, out: 2.25 },
    "qwen3-coder-480b-a35b-instruct": { miss: 1.5, hit: 1.5, out: 7.5 },
    "qwen3-coder-flash": { miss: 0.3, hit: 0.3, out: 1.5 },
    "qwen3-coder-plus": { miss: 1, hit: 1, out: 5 },
    "qwen3-livetranslate-flash-realtime": { miss: 10, hit: 10, out: 10 },
    "qwen3-max": { miss: 1.2, hit: 1.2, out: 6 },
    "qwen3-next-80b-a3b-instruct": { miss: 0.5, hit: 0.5, out: 2 },
    "qwen3-next-80b-a3b-thinking": { miss: 0.5, hit: 0.5, out: 6 },
    "qwen3-omni-flash": { miss: 0.43, hit: 0.43, out: 1.66 },
    "qwen3-omni-flash-realtime": { miss: 0.52, hit: 0.52, out: 1.99 },
    "qwen3-vl-235b-a22b": { miss: 0.7, hit: 0.7, out: 2.8 },
    "qwen3-vl-30b-a3b": { miss: 0.2, hit: 0.2, out: 0.8 },
    "qwen3-vl-plus": { miss: 0.2, hit: 0.2, out: 1.6 },
    "qwen3.5-122b-a10b": { miss: 0.4, hit: 0.4, out: 3.2 },
    "qwen3.5-27b": { miss: 0.3, hit: 0.3, out: 2.4 },
    "qwen3.5-35b-a3b": { miss: 0.25, hit: 0.25, out: 2 },
    "qwen3.5-397b-a17b": { miss: 0.6, hit: 0.6, out: 3.6 },
    "qwen3.5-flash": { miss: 0.1, hit: 0.01, out: 0.4 },
    "qwen3.5-plus": { miss: 0.4, hit: 0.4, out: 2.4 },
    "qwen3.6-27b": { miss: 0.6, hit: 0.6, out: 3.6 },
    "qwen3.6-35b-a3b": { miss: 0.248, hit: 0.248, out: 1.485 },
    "qwen3.6-flash": { miss: 0.1875, hit: 0.1875, out: 1.125 },
    "qwen3.6-max-preview": { miss: 1.3, hit: 0.13, out: 7.8 },
    "qwen3.6-plus": { miss: 0.5, hit: 0.05, out: 3 },
    "qwen3.7-flash": { miss: 0.03, hit: 3e-3, out: 0.13 },
    "qwen3.7-max": { miss: 2.5, hit: 0.5, out: 7.5 },
    "qwen3.7-plus": { miss: 0.4, hit: 0.04, out: 1.6 },
    "qwen3.8-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
    "qwen3.8-max": { miss: 2, hit: 0.25, out: 6 },
    "qwen3.8-omni-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
    "qwq-plus": { miss: 0.8, hit: 0.8, out: 2.4 }
  },
  "xai": {
    "grok-4.20-0309-non-reasoning": { miss: 1.25, hit: 0.2, out: 2.5 },
    "grok-4.20-0309-reasoning": { miss: 1.25, hit: 0.2, out: 2.5 },
    "grok-4.20-multi-agent-0309": { miss: 1.25, hit: 0.2, out: 2.5 },
    "grok-4.3": { miss: 1.25, hit: 0.2, out: 2.5 },
    "grok-4.5": { miss: 2, hit: 0.3, out: 6 },
    "grok-4.6": { miss: 2, hit: 0.5, out: 6 },
    "grok-4.7": { miss: 2, hit: 0.5, out: 6 },
    "grok-build-0.1": { miss: 1, hit: 0.2, out: 2 }
  },
  "xiaomi": {
    "mimo-v2-flash": { miss: 0.14, hit: 28e-4, out: 0.28 },
    "mimo-v2-omni": { miss: 0.14, hit: 28e-4, out: 0.28 },
    "mimo-v2-pro": { miss: 0.435, hit: 36e-4, out: 0.87 },
    "mimo-v2.5": { miss: 0.14, hit: 28e-4, out: 0.28 },
    "mimo-v2.5-pro": { miss: 0.435, hit: 36e-4, out: 0.87 },
    "mimo-v2.5-pro-ultraspeed": { miss: 1.305, hit: 0.0108, out: 2.61 },
    "mimo-v2.6-flash": { miss: 0.14, hit: 28e-4, out: 0.28 },
    "mimo-v2.6-pro": { miss: 0.435, hit: 36e-4, out: 0.87 },
    "mimo-v2.6-pro-ultraspeed": { miss: 4.35, hit: 0.036, out: 8.7 }
  },
  "opencode": {
    "big-pickle": { miss: 0, hit: 0, out: 0 },
    "claude-3-5-haiku": { miss: 0.8, hit: 0.08, out: 4 },
    "claude-fable-5": { miss: 10, hit: 1, out: 50 },
    "claude-fable-5-1": { miss: 10, hit: 0.25, out: 50 },
    "claude-haiku-4-5": { miss: 1, hit: 0.1, out: 5 },
    "claude-opus-4-1": { miss: 15, hit: 1.5, out: 75 },
    "claude-opus-4-5": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-6": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-7": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-4-8": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-5": { miss: 5, hit: 0.5, out: 25 },
    "claude-opus-5-5": { miss: 4, hit: 0.2, out: 20 },
    "claude-sonnet-4": { miss: 3, hit: 0.3, out: 15 },
    "claude-sonnet-4-5": { miss: 3, hit: 0.3, out: 15 },
    "claude-sonnet-4-6": { miss: 3, hit: 0.3, out: 15 },
    "claude-sonnet-5": { miss: 2, hit: 0.2, out: 10 },
    "deepseek-v4-flash": { miss: 0.14, hit: 0.028, out: 0.28 },
    "deepseek-v4-flash-free": { miss: 0, hit: 0, out: 0 },
    "deepseek-v4-flash-vision-exp": { miss: 0.14, hit: 0.028, out: 0.28 },
    "deepseek-v4-pro": { miss: 1.74, hit: 0.145, out: 3.84 },
    "deepseek-v4.1-flash": { miss: 0.3, hit: 6e-3, out: 1.2 },
    "gemini-3-flash": { miss: 0.5, hit: 0.05, out: 3 },
    "gemini-3-pro": { miss: 2, hit: 0.2, out: 12 },
    "gemini-3.1-pro": { miss: 2, hit: 0.2, out: 12 },
    "gemini-3.5-flash": { miss: 1.5, hit: 0.15, out: 9 },
    "gemini-3.5-flash-lite": { miss: 0.3, hit: 0.03, out: 2.5 },
    "gemini-3.6-flash": { miss: 1.5, hit: 0.15, out: 7.5 },
    "gemini-3.7-flash": { miss: 1.5, hit: 0.15, out: 7.5 },
    "gemini-3.8-flash": { miss: 1.5, hit: 0.15, out: 7.5 },
    "glm-4.6": { miss: 0.6, hit: 0.1, out: 2.2 },
    "glm-4.7": { miss: 0.6, hit: 0.1, out: 2.2 },
    "glm-4.7-free": { miss: 0, hit: 0, out: 0 },
    "glm-5": { miss: 1, hit: 0.2, out: 3.2 },
    "glm-5-free": { miss: 0, hit: 0, out: 0 },
    "glm-5.1": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.2": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.3": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.3-flash": { miss: 0.15, hit: 0.03, out: 0.5 },
    "gpt-5": { miss: 1.07, hit: 0.107, out: 8.5 },
    "gpt-5-codex": { miss: 1.07, hit: 0.107, out: 8.5 },
    "gpt-5-nano": { miss: 0.05, hit: 5e-3, out: 0.4 },
    "gpt-5.1": { miss: 1.07, hit: 0.107, out: 8.5 },
    "gpt-5.1-codex": { miss: 1.07, hit: 0.107, out: 8.5 },
    "gpt-5.1-codex-max": { miss: 1.25, hit: 0.125, out: 10 },
    "gpt-5.1-codex-mini": { miss: 0.25, hit: 0.025, out: 2 },
    "gpt-5.2": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.2-codex": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.3-codex": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.3-codex-spark": { miss: 1.75, hit: 0.175, out: 14 },
    "gpt-5.4": { miss: 2.5, hit: 0.25, out: 15 },
    "gpt-5.4-mini": { miss: 0.75, hit: 0.075, out: 4.5 },
    "gpt-5.4-nano": { miss: 0.2, hit: 0.02, out: 1.25 },
    "gpt-5.4-pro": { miss: 30, hit: 30, out: 180 },
    "gpt-5.5": { miss: 5, hit: 0.5, out: 30 },
    "gpt-5.5-pro": { miss: 30, hit: 30, out: 180 },
    "gpt-5.6-luna": { miss: 0.2, hit: 0.02, out: 1.2 },
    "gpt-5.6-sol": { miss: 4, hit: 0.4, out: 20 },
    "gpt-5.6-terra": { miss: 2.5, hit: 0.25, out: 15 },
    "gpt-6-astra": { miss: 10, hit: 1, out: 50 },
    "gpt-6-luna": { miss: 0.1, hit: 0.01, out: 0.5 },
    "gpt-6-sol": { miss: 2, hit: 0.2, out: 10 },
    "grok-4.5": { miss: 2, hit: 0.3, out: 6 },
    "grok-4.6": { miss: 2, hit: 0.5, out: 6 },
    "grok-4.7": { miss: 1.4, hit: 0.35, out: 4.2 },
    "grok-build-0.1": { miss: 1, hit: 0.2, out: 2 },
    "grok-code": { miss: 0, hit: 0, out: 0 },
    "hy3-free": { miss: 0, hit: 0, out: 0 },
    "hy3-preview-free": { miss: 0, hit: 0, out: 0 },
    "kimi-k2": { miss: 0.4, hit: 0.4, out: 2.5 },
    "kimi-k2-thinking": { miss: 0.4, hit: 0.4, out: 2.5 },
    "kimi-k2.5": { miss: 0.6, hit: 0.08, out: 3 },
    "kimi-k2.5-free": { miss: 0, hit: 0, out: 0 },
    "kimi-k2.6": { miss: 0.95, hit: 0.16, out: 4 },
    "kimi-k2.7-code": { miss: 0.95, hit: 0.19, out: 4 },
    "kimi-k3": { miss: 3, hit: 0.3, out: 15 },
    "laguna-s-2.1-free": { miss: 0, hit: 0, out: 0 },
    "ling-2.6-flash-free": { miss: 0, hit: 0, out: 0 },
    "ling-3.0-flash-fin-free": { miss: 0, hit: 0, out: 0 },
    "ling-3.0-flash-free": { miss: 0, hit: 0, out: 0 },
    "ling-3.0-tiny-free": { miss: 0, hit: 0, out: 0 },
    "longcat-2.0-free": { miss: 0, hit: 0, out: 0 },
    "longcat-2.5-preview-free": { miss: 0, hit: 0, out: 0 },
    "mimo-v2-flash-free": { miss: 0, hit: 0, out: 0 },
    "mimo-v2-omni-free": { miss: 0, hit: 0, out: 0 },
    "mimo-v2-pro-free": { miss: 0, hit: 0, out: 0 },
    "mimo-v2.5-free": { miss: 0, hit: 0, out: 0 },
    "mimo-v2.6-flash-free": { miss: 0, hit: 0, out: 0 },
    "minimax-m2.1": { miss: 0.3, hit: 0.1, out: 1.2 },
    "minimax-m2.1-free": { miss: 0, hit: 0, out: 0 },
    "minimax-m2.5": { miss: 0.3, hit: 0.06, out: 1.2 },
    "minimax-m2.5-free": { miss: 0, hit: 0, out: 0 },
    "minimax-m2.7": { miss: 0.3, hit: 0.06, out: 1.2 },
    "minimax-m3": { miss: 0.3, hit: 0.06, out: 1.2 },
    "minimax-m3-free": { miss: 0, hit: 0, out: 0 },
    "muse-spark-1.2": { miss: 1.25, hit: 0.15, out: 4.25 },
    "muse-spark-1.2-contributor-free": { miss: 0, hit: 0, out: 0 },
    "muse-spark-1.3": { miss: 1.25, hit: 0.15, out: 4.25 },
    "muse-spark-1.3-contributor-free": { miss: 0, hit: 0, out: 0 },
    "nemotron-3-super-free": { miss: 0, hit: 0, out: 0 },
    "nemotron-3-ultra-free": { miss: 0, hit: 0, out: 0 },
    "nemotron-3.5-lightning-free": { miss: 0, hit: 0, out: 0 },
    "north-mini-code-free": { miss: 0, hit: 0, out: 0 },
    "qwen3-coder": { miss: 0.45, hit: 0.45, out: 1.8 },
    "qwen3.5-plus": { miss: 0.2, hit: 0.02, out: 1.2 },
    "qwen3.6-plus": { miss: 0.5, hit: 0.05, out: 3 },
    "qwen3.6-plus-free": { miss: 0, hit: 0, out: 0 },
    "qwen3.8-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
    "qwen3.8-max": { miss: 2, hit: 0.25, out: 6 },
    "ring-2.6-1t-free": { miss: 0, hit: 0, out: 0 },
    "space-bunny-free": { miss: 0, hit: 0, out: 0 },
    "trinity-large-preview-free": { miss: 0, hit: 0, out: 0 },
    "x-preview-f-free": { miss: 0, hit: 0, out: 0 }
  },
  "opencode-go": {
    "deepseek-v4-flash": { miss: 0.15, hit: 3e-3, out: 0.6 },
    "deepseek-v4-flash-vision-exp": { miss: 0.15, hit: 3e-3, out: 0.6 },
    "deepseek-v4-pro": { miss: 0.66, hit: 0.022, out: 1.98 },
    "deepseek-v4.1-flash": { miss: 0.15, hit: 3e-3, out: 0.6 },
    "glm-5.2": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.3": { miss: 1.4, hit: 0.26, out: 4.4 },
    "glm-5.3-flash": { miss: 0.15, hit: 0.03, out: 0.5 },
    "gpt-5.6-luna": { miss: 0.2, hit: 0.02, out: 1.2 },
    "gpt-6-luna": { miss: 0.1, hit: 0.01, out: 0.5 },
    "grok-4.5": { miss: 2, hit: 0.3, out: 6 },
    "grok-4.6": { miss: 2, hit: 0.5, out: 6 },
    "grok-4.7": { miss: 2, hit: 0.5, out: 6 },
    "hy3": { miss: 0.14, hit: 0.035, out: 0.58 },
    "hy4-preview": { miss: 0.834, hit: 0.042, out: 2.501 },
    "kimi-k2.6": { miss: 0.95, hit: 0.16, out: 4 },
    "kimi-k2.7-code": { miss: 0.95, hit: 0.19, out: 4 },
    "kimi-k3": { miss: 3, hit: 0.3, out: 15 },
    "longcat-2.0": { miss: 0.3, hit: 6e-3, out: 1.2 },
    "longcat-2.5-preview-free": { miss: 0, hit: 0, out: 0 },
    "mimo-v2.5": { miss: 0.14, hit: 28e-4, out: 0.28 },
    "mimo-v2.5-pro": { miss: 0.435, hit: 3625e-6, out: 0.87 },
    "mimo-v2.6-flash": { miss: 0.14, hit: 28e-4, out: 0.28 },
    "mimo-v2.6-pro": { miss: 0.435, hit: 3625e-6, out: 0.87 },
    "minimax-m2.7": { miss: 0.3, hit: 0.06, out: 1.2 },
    "minimax-m3": { miss: 0.3, hit: 0.06, out: 1.2 },
    "muse-spark-1.2-contributor": { miss: 0.1, hit: 2e-3, out: 0.2 },
    "muse-spark-1.3-contributor": { miss: 0.1, hit: 2e-3, out: 0.2 },
    "qwen3.6-plus": { miss: 0.5, hit: 0.05, out: 3 },
    "qwen3.7-max": { miss: 2.5, hit: 0.5, out: 7.5 },
    "qwen3.7-plus": { miss: 0.4, hit: 0.04, out: 1.6 },
    "qwen3.8-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
    "qwen3.8-max": { miss: 2, hit: 0.25, out: 6 },
    "space-bunny-free": { miss: 0, hit: 0, out: 0 }
  }
};

// src/pricing.ts
var ZERO_TRIPLE = { miss: 0, hit: 0, out: 0 };
var CNY_PER_USD = 6.82;
var PEAK_UTC_RANGES = [[1, 4], [6, 10]];
var PEAK_RULE_AT_MS = Date.parse("2026-08-16T16:00:00Z");
var WEEKEND_OFFPEAK_AT_MS = Date.parse("2026-08-22T16:00:00Z");
var DEFAULT_PEAK_HOLIDAYS = [
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07"
];
function beijingDayKey(ms) {
  const shifted = Number.isFinite(ms) ? ms + 8 * 36e5 : 0;
  return new Date(shifted).toISOString().slice(0, 10);
}
function beijingWeekday(ms) {
  const shifted = Number.isFinite(ms) ? ms + 8 * 36e5 : 0;
  return new Date(shifted).getUTCDay();
}
function isDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}
function parseHolidays(raw) {
  if (!Array.isArray(raw)) return void 0;
  const dates = [...new Set(raw.filter(isDayKey))].sort();
  if (dates.length === 0) return void 0;
  return dates.slice(0, 400);
}
function effectiveHolidays(manual, auto) {
  const manualDays = parseHolidays(manual) ?? [];
  const autoDays = parseHolidays(auto) ?? [];
  const manualCount = manualDays.length;
  const autoCount = autoDays.length;
  if (manualCount > 0) {
    return { days: manualDays, source: "manual", autoCount, manualCount };
  }
  if (autoCount === 0) {
    return { days: DEFAULT_PEAK_HOLIDAYS, source: "builtin", autoCount, manualCount };
  }
  const merged = [.../* @__PURE__ */ new Set([...DEFAULT_PEAK_HOLIDAYS, ...autoDays])].sort().slice(-400);
  return { days: merged, source: "auto", autoCount, manualCount };
}
function isPeakAt(at, options = {}) {
  const ms = typeof at === "number" ? at : at.getTime();
  if (!Number.isFinite(ms)) return false;
  if (ms < PEAK_RULE_AT_MS) return false;
  const holidays = options.holidays ?? DEFAULT_PEAK_HOLIDAYS;
  if (ms >= WEEKEND_OFFPEAK_AT_MS && holidays.includes(beijingDayKey(ms))) return false;
  const weekday = beijingWeekday(ms);
  if (ms >= WEEKEND_OFFPEAK_AT_MS && (weekday === 0 || weekday === 6)) return false;
  const date2 = new Date(ms);
  const hour = date2.getUTCHours() + date2.getUTCMinutes() / 60;
  return PEAK_UTC_RANGES.some(([start, end]) => hour >= start && hour < end);
}
var ERA_LEGACY = {
  id: "legacy",
  fromMs: 0,
  label: "\u5CF0\u8C37\u5236\u4E4B\u524D\uFF08\u5355\u4E00\u6863\u4EF7\uFF09",
  source: 'https://api-docs.deepseek.com/zh-cn/updates\uFF082026-07-31 V4-Flash-0731 \u4E0A\u7EBF\u65F6\u7684\u4EF7\u76EE\uFF1B2026-08-13 \u6DA8\u4EF7\u516C\u544A\u7684"\u6DA8\u524D\u4EF7"\u9010\u9879\u5BF9\u4E0A\uFF1AFlash \u547D\u4E2D 0.02 / \u672A\u547D\u4E2D 1 / \u8F93\u51FA 2\uFF0CPro \u547D\u4E2D 0.025 / \u672A\u547D\u4E2D 3 / \u8F93\u51FA 6\uFF09',
  table: {
    "deepseek-flash": {
      peak: { cny: { miss: 1, hit: 0.02, out: 2 }, usd: { miss: 0.14, hit: 28e-4, out: 0.28 } },
      offPeak: { cny: { miss: 1, hit: 0.02, out: 2 }, usd: { miss: 0.14, hit: 28e-4, out: 0.28 } }
    },
    "deepseek-v4-pro": {
      peak: { cny: { miss: 3, hit: 0.025, out: 6 }, usd: { miss: 0.435, hit: 3625e-6, out: 0.87 } },
      offPeak: { cny: { miss: 3, hit: 0.025, out: 6 }, usd: { miss: 0.435, hit: 3625e-6, out: 0.87 } }
    }
  }
};
var ERA_2026_08 = {
  id: "peak-2026-08",
  fromMs: PEAK_RULE_AT_MS,
  label: "\u5CF0\u8C37\u4E24\u6863\uFF082026-08 \u4EF7\uFF09",
  source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing\uFF082026-08 \u7248\uFF09",
  table: {
    "deepseek-flash": {
      offPeak: { cny: { miss: 1.5, hit: 0.05, out: 4.5 }, usd: { miss: 0.22, hit: 7e-3, out: 0.66 } },
      peak: { cny: { miss: 3, hit: 0.1, out: 9 }, usd: { miss: 0.44, hit: 0.014, out: 1.32 } }
    },
    "deepseek-v4-pro": {
      offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
      peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } }
    }
  }
};
var ERA_2026_09 = {
  id: "flash-2026-09-10",
  fromMs: Date.parse("2026-09-10T04:00:00Z"),
  label: "Flash \u964D\u4EF7\u540E\uFF082026-09-10 \u8D77\uFF09",
  source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing + https://intl.cloud.tencent.com/ind/announce/detail/101513",
  table: {
    "deepseek-flash": {
      offPeak: { cny: { miss: 1, hit: 0.02, out: 4 }, usd: { miss: 0.15, hit: 3e-3, out: 0.6 } },
      peak: { cny: { miss: 2, hit: 0.04, out: 8 }, usd: { miss: 0.3, hit: 6e-3, out: 1.2 } }
    },
    "deepseek-v4-pro": {
      offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
      peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } }
    }
  }
};
var PRICE_ERAS = [ERA_LEGACY, ERA_2026_08, ERA_2026_09];
var CURRENT_ERA_ID = ERA_2026_09.id;
var PRICE_TABLE = ERA_2026_09.table;
var MODEL_ALIASES = {
  // 官方脚注：`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 仍可调用，
  // 但对应模型已下线、请求由 V4.1-Flash 服务，**并按 Flash 价计费**。
  "deepseek-v4-flash": "deepseek-flash",
  "deepseek-v4-flash-vision-exp": "deepseek-flash",
  "deepseek-v4.1-flash": "deepseek-flash",
  // 更早的两代名（V4 首发时的兼容名），只作历史日志的兜底映射。
  // ⚠️ 官方更新日志（2026-04-24，中英两版都写了）：`deepseek-chat` 与 `deepseek-reasoner`
  // **都指向 `deepseek-v4-flash`** —— 前者是非思考模式、后者是思考模式，
  // 与 `deepseek-v4-pro` **没有**对应关系，且这两个名字已于 2026-07-24 停用。
  // （0.10.0 一度把 reasoner 映到 Pro，那会把 flash 的用量按 Pro 价算，约 3 倍；已修。）
  "deepseek-chat": "deepseek-flash",
  "deepseek-reasoner": "deepseek-flash"
};
var DEFAULT_PRICING_MODEL = "deepseek-flash";
var BUILTIN_PRICING_MODELS = Object.keys(PRICE_TABLE);
function allEras(extra2) {
  if (extra2 === void 0 || extra2.length === 0) return PRICE_ERAS;
  return [...PRICE_ERAS, ...extra2].sort((left, right) => left.fromMs - right.fromMs);
}
function eraAt(timeMs, extra2) {
  const eras = allEras(extra2);
  const ms = Number.isFinite(timeMs) ? timeMs : Date.now();
  let found = eras[0];
  for (const era of eras) {
    if (era.fromMs <= ms) found = era;
  }
  return found;
}
function eraIdAt(timeMs, extra2) {
  return eraAt(timeMs, extra2).id;
}
function eraById(id, extra2) {
  const eras = allEras(extra2);
  const key = typeof id === "string" ? id : "";
  return eras.find((era) => era.id === key) ?? eraAt(Date.now(), extra2);
}
function parsePriceEras(raw) {
  if (!Array.isArray(raw)) return void 0;
  const out = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const row = item;
    const id = typeof row.id === "string" && row.id.length > 0 ? row.id : "";
    const fromMs = finite(row.fromMs);
    const table = parsePriceTable(row.table);
    if (id === "" || fromMs === void 0 || table === void 0) continue;
    if (PRICE_ERAS.some((era) => era.id === id)) continue;
    out.push({
      id,
      fromMs,
      label: typeof row.label === "string" ? row.label : id,
      source: typeof row.source === "string" ? row.source : "",
      table
    });
  }
  return out.length > 0 ? out : void 0;
}
function parsePriceTable(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const out = {};
  for (const [model, value] of Object.entries(raw)) {
    const entry = parseModelPrice(value);
    if (entry !== void 0) out[model.trim().toLowerCase()] = entry;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function parseModelPrice(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row = raw;
  const peak = parseTierSet(row.peak);
  const offPeak = parseTierSet(row.offPeak);
  return peak === void 0 || offPeak === void 0 ? void 0 : { peak, offPeak };
}
function parseTierSet(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row = raw;
  const cny = parseTriple(row.cny);
  const usd = parseTriple(row.usd);
  return cny === void 0 || usd === void 0 ? void 0 : { cny, usd };
}
function parseTriple(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row = raw;
  const miss = finite(row.miss);
  const hit = finite(row.hit);
  const out = finite(row.out);
  if (miss === void 0 || hit === void 0 || out === void 0) return void 0;
  if (miss < 0 || hit < 0 || out < 0) return void 0;
  return { miss, hit, out };
}
var PROVIDER_ALIASES = {
  "deepseek-official": "deepseek",
  "llm-deepseek": "deepseek",
  "kimi-coding": "moonshotai",
  "minimax-cn": "minimax",
  "zai-coding-cn": "zhipuai"
};
function isDeepSeekRoute(provider, model) {
  const providerText = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  if (providerText.includes("deepseek")) return true;
  const modelText = typeof model === "string" ? model.trim().toLowerCase() : "";
  return modelText.startsWith("deepseek");
}
function providerRateOf(table, provider, model) {
  if (table === void 0) return void 0;
  const rawProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const rawModel = typeof model === "string" ? model.trim().toLowerCase() : "";
  if (rawModel === "") return void 0;
  const candidates = [rawProvider, PROVIDER_ALIASES[rawProvider] ?? ""].filter((key) => key.length > 0);
  for (const key of candidates) {
    const rate2 = table[key]?.[rawModel];
    if (rate2 !== void 0) return { provider: key, model: rawModel, rate: rate2 };
  }
  const matches = [];
  for (const [key, models] of Object.entries(table)) {
    const rate2 = models[rawModel];
    if (rate2 !== void 0 && !matches.some((hit) => hit.provider === key)) matches.push({ provider: key, rate: rate2 });
  }
  return matches.length === 1 ? { provider: matches[0].provider, model: rawModel, rate: matches[0].rate } : void 0;
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function overrideEntryOf(table, provider, model) {
  if (table === void 0) return void 0;
  const providerKey = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const modelKey = String(model ?? "").trim().toLowerCase();
  if (modelKey === "") return void 0;
  const normalized = normalizeModel(modelKey);
  const modelKeys = normalized === modelKey ? [modelKey] : [normalized, modelKey];
  const keys = [];
  for (const key of modelKeys) {
    if (providerKey !== "") keys.push(`${providerKey}:${key}`, `${providerKey}/${key}`);
    keys.push(key);
  }
  for (const key of keys) {
    const entry = table[key];
    if (entry !== void 0) return entry;
  }
  return void 0;
}
function normalizeModel(model) {
  if (typeof model !== "string" || model.length === 0) return DEFAULT_PRICING_MODEL;
  const key = model.trim().toLowerCase();
  if (key.length === 0) return DEFAULT_PRICING_MODEL;
  return MODEL_ALIASES[key] ?? key;
}
function applyTier(base, tier) {
  if (tier === void 0) return { prices: base, touched: false };
  const miss = finite(tier.cacheMissInput) ?? finite(tier.miss);
  const hit = finite(tier.cacheHitInput) ?? finite(tier.hit);
  const out = finite(tier.output) ?? finite(tier.out);
  const next = {
    miss: miss ?? base.miss,
    hit: hit ?? base.hit,
    out: out ?? base.out
  };
  const touched2 = miss !== void 0 && miss !== base.miss || hit !== void 0 && hit !== base.hit || out !== void 0 && out !== base.out;
  return { prices: next, touched: touched2 };
}
function msOf(at) {
  if (at instanceof Date) return at.getTime();
  if (typeof at === "number" && Number.isFinite(at)) return at;
  return Date.now();
}
function resolvePrice(model, options = {}) {
  const currency = options.currency === "USD" ? "USD" : "CNY";
  const provider = typeof options.provider === "string" ? options.provider : "";
  const atMs = msOf(options.at);
  const deepseek = isDeepSeekRoute(provider, model);
  if (!deepseek) {
    const raw = typeof model === "string" ? model.trim() : "";
    const synced = providerRateOf(options.providers, provider, raw);
    const snapshot2 = synced === void 0 ? providerRateOf(BUILTIN_PROVIDER_PRICES, provider, raw) : void 0;
    const found = synced ?? snapshot2;
    if (found === void 0) {
      return {
        model: raw,
        provider,
        peak: false,
        era: "",
        currency,
        prices: ZERO_TRIPLE,
        overridden: false,
        unpriced: true,
        builtin: false,
        source: "none"
      };
    }
    const fromSnapshot = synced === void 0;
    const usd = { miss: found.rate.miss, hit: found.rate.hit, out: found.rate.out };
    const cny2 = {
      miss: usd.miss * CNY_PER_USD,
      hit: usd.hit * CNY_PER_USD,
      out: usd.out * CNY_PER_USD
    };
    const override2 = overrideEntryOf(options.overrides, provider, raw);
    const overrideTier2 = override2?.offPeak ?? override2?.peak;
    if (overrideTier2 === void 0) {
      return {
        model: raw,
        provider,
        peak: false,
        era: "",
        currency,
        prices: currency === "USD" ? usd : cny2,
        overridden: false,
        unpriced: false,
        builtin: fromSnapshot,
        source: "provider"
      };
    }
    const applied2 = applyTier(cny2, overrideTier2);
    const prices2 = currency === "USD" ? { miss: applied2.prices.miss / CNY_PER_USD, hit: applied2.prices.hit / CNY_PER_USD, out: applied2.prices.out / CNY_PER_USD } : applied2.prices;
    return {
      model: raw,
      provider,
      peak: false,
      era: "",
      currency,
      prices: prices2,
      overridden: applied2.touched,
      unpriced: false,
      builtin: fromSnapshot,
      source: "override"
    };
  }
  const era = options.era !== void 0 ? eraById(options.era, options.eras) : eraAt(atMs, options.eras);
  const normalized = normalizeModel(model);
  const base = era.table[normalized] ?? era.table[DEFAULT_PRICING_MODEL];
  const peak = options.peak ?? isPeakAt(atMs, { holidays: options.holidays });
  const tier = peak ? base.peak : base.offPeak;
  const override = overrideEntryOf(options.overrides, provider, model);
  const overrideTier = peak ? override?.peak : override?.offPeak;
  if (overrideTier === void 0) {
    return {
      model: normalized,
      provider,
      peak,
      era: era.id,
      currency,
      prices: currency === "USD" ? tier.usd : tier.cny,
      overridden: false,
      unpriced: false,
      builtin: false,
      source: "official"
    };
  }
  const applied = applyTier(tier.cny, overrideTier);
  const cny = applied.prices;
  const prices = currency === "USD" ? { miss: cny.miss / CNY_PER_USD, hit: cny.hit / CNY_PER_USD, out: cny.out / CNY_PER_USD } : cny;
  return {
    model: normalized,
    provider,
    peak,
    era: era.id,
    currency,
    prices,
    overridden: applied.touched,
    unpriced: false,
    builtin: false,
    source: "override"
  };
}
function costBucketsOf(usage) {
  return {
    miss: finite(usage?.inputTokens) ?? finite(usage?.uncachedInputTokens) ?? 0,
    hit: finite(usage?.cacheReadTokens) ?? 0,
    out: finite(usage?.outputTokens) ?? 0
  };
}
function costPartsOf(buckets, prices) {
  const miss = buckets.miss / 1e6 * prices.miss;
  const hit = buckets.hit / 1e6 * prices.hit;
  const out = buckets.out / 1e6 * prices.out;
  return { miss, hit, out, total: miss + hit + out };
}
function parsePriceOverrides(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const out = {};
  for (const [model, value] of Object.entries(raw)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const tiers = {};
    for (const tierName of ["peak", "offPeak"]) {
      const tierRaw = value[tierName];
      if (typeof tierRaw !== "object" || tierRaw === null || Array.isArray(tierRaw)) continue;
      const source = tierRaw;
      const tier = {};
      for (const key of ["cacheMissInput", "miss", "cacheHitInput", "hit", "output", "out"]) {
        const n = finite(source[key]);
        if (n !== void 0 && n >= 0) tier[key] = n;
      }
      if (Object.keys(tier).length > 0) tiers[tierName] = tier;
    }
    if (Object.keys(tiers).length > 0) out[String(model).trim().toLowerCase()] = tiers;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}

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
function sanitizeTerminalCandidates(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    if (out.length >= 20) break;
    if (typeof item !== "object" || item === null) continue;
    const row = item;
    const path = typeof row.path === "string" ? normalizePath(row.path).slice(0, 400) : "";
    if (path === "") continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = typeof row.label === "string" ? row.label.slice(0, 40) : "";
    const kind = row.kind === "git" || row.kind === "msys2" || row.kind === "cygwin" || row.kind === "niubash" || row.kind === "path" ? row.kind : "path";
    out.push({ path, label: label === "" ? "PATH" : label, kind, explicit: row.explicit === true });
  }
  return out;
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
var USAGE_API_PATH = "/composer-ux/usage";
var QUOTA_API_PATH = "/composer-ux/quota";
var NAV_FOLD_API_PATH = "/composer-ux/nav-fold";
var MODELS_API_PATH = "/composer-ux/models";
var RESTART_CSRF_HEADER = "x-composer-ux-restart";
var RESTART_CSRF_VALUE = "1";
var SYNC_API_PATH = "/composer-ux/sync-prices";
var ENABLED_FIELD = "enabled";
var NOTIFY_ENABLED_FIELD = "notifyEnabled";
var NOTIFY_CHANNEL_FIELD = "notifyChannel";
var NOTIFY_PUSHPLUS_FIELD = "notifyPushplusToken";
var NOTIFY_WECOM_FIELD = "notifyWecomWebhook";
var NOTIFY_KINDS_FIELD = "notifyKinds";
var NOTIFY_TEST_API_PATH = "/composer-ux/notify/test";
var DIRECTORY_PICK_ENABLED_FIELD = "directoryPickEnabled";
var KEYS_ENABLED_FIELD = "keysEnabled";
var MENU_ENABLED_FIELD = "menuEnabled";
var QUICK_ENABLED_FIELD = "quickEnabled";
var PANEL_ENABLED_FIELD = "panelEnabled";
var TERMINAL_ENABLED_FIELD = "terminalEnabled";
var STATS_ENABLED_FIELD = "statsEnabled";
var PRICE_OVERRIDES_FIELD = "priceOverrides";
var PEAK_HOLIDAYS_FIELD = "peakHolidays";
var HOLIDAY_SOURCE_LABEL = "holiday-cn\uFF08\u6570\u636E\u53D6\u81EA\u56FD\u52A1\u9662\u529E\u516C\u5385\u901A\u77E5\uFF09";
var PEAK_ALERT_FIELD = "peakAlert";
var PRICE_AUTO_SYNC_FIELD = "priceAutoSync";
var BALANCE_ENABLED_FIELD = "balanceEnabled";
var SYNCED_PRICES_FIELD = "syncedPrices";
var DEFAULT_PEAK_ALERT = {
  enabled: true,
  aheadMinutes: 5,
  onPeak: true,
  onOffPeak: true,
  webNotify: false
};
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
var OPTIMIZER_CONTEXT_FIELD = "optimizerContext";
var OPTIMIZER_LEDGER_FIELD = "optimizerLedger";
var OPTIMIZE_KEEP_DOCK_FIELD = "optimizeKeepDock";
var OPTIMIZE_READ_TOOLS_FIELD = "optimizeReadTools";
var OPTIMIZER_FRAMING_FIELD = "optimizerFraming";
var DEFAULT_OPTIMIZER_FRAMING = "neutral";
var OPTIMIZER_PERMISSION_FIELD = "optimizerPermission";
var DEFAULT_OPTIMIZER_PERMISSION = "review";
var OPTIMIZER_MODEL_FIELD = "optimizerModel";
var OPTIMIZER_MODEL_MAX = 120;
var OPTIMIZER_HISTORY_FIELD = "optimizerHistory";
var OPTIMIZER_TURNS_FIELD = "optimizerTurns";
var OPTIMIZER_TURNS_MIN = 0;
var OPTIMIZER_TURNS_MAX = 10;
var DEFAULT_OPTIMIZER_TURNS = 6;
var OPTIMIZE_BASH_FIELD = "optimizeBash";
function normalizeOptimizerTurns(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_OPTIMIZER_TURNS;
  return Math.min(OPTIMIZER_TURNS_MAX, Math.max(OPTIMIZER_TURNS_MIN, Math.round(value)));
}
var OPTIMIZER_CONTEXT_TURNS = 4;
var OPTIMIZER_CONTEXT_MAX_CHARS = 1600;
var OPTIMIZER_CONTEXT_TURN_MAX_CHARS = 600;
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
var OPTIMIZE_STATE_API_PATH = "/composer-ux/optimize-state";
var OPTIMIZER_API_PATH = "/composer-ux/optimize";
var SLASH_COMMAND_RE = /^(\/[A-Za-z][\w-]*)(?:\s+([\s\S]+))?$/;
function splitSlashCommand(text) {
  const matched = SLASH_COMMAND_RE.exec(text);
  if (matched === null) return { prefix: "", body: text };
  return { prefix: matched[1] ?? "", body: (matched[2] ?? "").trim() };
}
var OPTIMIZER_TIERS = [
  { id: "off", label: "\u5173\u95ED", hint: "\u5B8C\u5168\u4E0D\u4F18\u5316\uFF1A\u4E0D\u8C03\u7528\u6A21\u578B\u3001\u4E0D\u78B0\u4F60\u7684\u8F93\u5165\u6846\uFF08\u7B49\u4E8E\u6CA1\u88C5\u8FD9\u4E2A\u529F\u80FD\uFF09\u3002" },
  { id: "light", label: "\u8F7B\u5EA6", hint: "\u5355\u4E00\u89E3\u8BFB\uFF1A\u53EA\u628A\u300C\u4F60\u8FD9\u4E00\u8F6E\u5230\u5E95\u8981\u4EC0\u4E48\u300D\u7406\u6E05\u695A\uFF0C\u6700\u591A 4 \u6761\uFF0C\u4E0D\u4EA7\u51FA\u5E76\u5217\u5019\u9009\u3002" },
  { id: "standard", label: "\u6807\u51C6", hint: "\u6761\u76EE\u5185\u5E76\u5217\uFF1A\u8D28\u91CF\u8BCD\u843D\u5230\u53EF\u68C0\u7EF4\u5EA6\uFF08\u81F3\u5C11 1 \u6761\uFF09\uFF0C\u6700\u591A 8 \u6761\u3002" },
  { id: "heavy", label: "\u91CD\u5EA6", hint: "\u591A\u5047\u8BBE\u5206\u652F\uFF1A\u540C\u4E00\u53E5\u8BDD\u6709\u51E0\u79CD\u8BFB\u6CD5\u5C31\u5217\u5019\u9009\uFF08\u6700\u591A 3 \u4E2A\uFF09\uFF0C\u8D28\u91CF\u7EF4\u5EA6\u81F3\u5C11 2 \u6761\uFF0C\u6700\u591A 12 \u6761\uFF0C\u601D\u8003\u66F4\u6DF1\u3002" }
];
var DEFAULT_OPTIMIZER_TIER = "standard";
var LEGACY_OPTIMIZER_TIERS = Object.freeze({
  basic: "light",
  advanced: "standard",
  extreme: "heavy"
});
function normalizeOptimizerTier(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "off" || raw === "light" || raw === "standard" || raw === "heavy") return raw;
  return LEGACY_OPTIMIZER_TIERS[raw] ?? DEFAULT_OPTIMIZER_TIER;
}
var OPTIMIZER_PROMPT_FIELDS = {
  light: "optimizerPromptLight",
  standard: "optimizerPromptStandard",
  heavy: "optimizerPromptHeavy"
};
var LEGACY_OPTIMIZER_PROMPT_FIELDS = {
  light: "optimizerPromptBasic",
  standard: "optimizerPromptAdvanced",
  heavy: "optimizerPromptExtreme"
};
var OPTIMIZER_PROMPT_FIELD_LIST = OPTIMIZER_TIERS.filter((item) => item.id !== "off").map((item) => OPTIMIZER_PROMPT_FIELDS[item.id]);
var OPTIMIZER_PROMPT_MAX = 2e4;
function optimizerPromptFieldOf(tier) {
  if (tier === "off") return "";
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
var NATIVE_STATUS_PREFIX = "\u5BBF\u4E3B\u5DF2\u539F\u751F\u652F\u6301";
var HEADER_CLEANUP_FIELD = "headerCleanupVersion";
var LLM_NAMESPACE = "llm-pi-ai";
var OPENCODE_ROUTE_PREFIX = "opencode";
var OPENCODE_HOSTS = ["opencode.ai"];
var DEFAULT_HEADER_NAME = "x-opencode-session";
var HEADER_VALUE_MAX = 200;
var HEADER_NAME_MAX = 64;
var DEFAULT_SETTINGS = {
  // 微信通知：默认全关全空（0.17.0）。
  notifyEnabled: false,
  notifyChannel: "pushplus",
  notifyPushplusToken: "",
  notifyWecomWebhook: "",
  notifyKinds: { "needs-input": true, done: true, error: true },
  // 工作区目录选择自适应：默认**关**（0.19.0）。接管官方槽位这件事必须由用户自己点。
  directoryPickEnabled: false,
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
  optimizerContext: true,
  // 台账默认开：只写数字与原因，不写一个字原文，所以默认开不冒隐私风险。
  optimizerLedger: true,
  // 默认开：重启/刷新后上一轮结果还在框里（关掉就每次都要重跑一遍模型）。
  optimizeKeepDock: true,
  // 只读工具默认**关**：它会真的多花时间与 token（开了才走工具轮次）。
  optimizeReadTools: false,
  optimizerFraming: DEFAULT_OPTIMIZER_FRAMING,
  optimizerPermission: DEFAULT_OPTIMIZER_PERMISSION,
  optimizerModel: "",
  optimizerHistory: "turns",
  optimizerTurns: DEFAULT_OPTIMIZER_TURNS,
  optimizeBash: false,
  // 空串 = 用内置提示词。默认必须是空串：它同时就是「恢复内置」要写回去的值。
  optimizerPromptLight: "",
  optimizerPromptStandard: "",
  optimizerPromptHeavy: "",
  terminalMode: DEFAULT_TERMINAL_MODE,
  terminalBashPath: "",
  terminalCandidates: [],
  terminalStatus: "",
  terminalEffective: "",
  // 「统计行」（0.7.0）：默认开 —— 用户 2026-09-28 要的是"装完立刻看得到效果"，
  // 所以这一栏不参与下面那套"碰过才开"的迁移（见 STATS_ENABLED_FIELD 上方的说明）。
  statsEnabled: true,
  // 「金额」（0.9.1）：默认没有覆盖价 = 全部按内置刊例价估算（与 0.8.0 的行为一致）。
  priceOverrides: void 0,
  // 「金额」（0.10.0）：节假日表留空 = 用内置（国务院 2026 年安排那份）。
  peakHolidays: void 0,
  peakAlert: DEFAULT_PEAK_ALERT,
  // 余额默认开：它是"看一眼就知道还能不能跑"的东西；关掉是给不想出网的人留的开关。
  balanceEnabled: true,
  syncedPrices: void 0,
  // 自动同步默认**关**：用户没点过就不该有定时出网。
  priceAutoSync: false
};
function newSessionId() {
  const bag = globalThis;
  if (typeof bag.crypto?.randomUUID === "function") return bag.crypto.randomUUID();
  const hex = (count2) => Array.from(
    { length: count2 },
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
function sanitizePeakAlert(raw) {
  const row = typeof raw === "object" && raw !== null ? raw : {};
  const bool = (key, fallback) => typeof row[key] === "boolean" ? row[key] : fallback;
  const ahead = typeof row.aheadMinutes === "number" && Number.isFinite(row.aheadMinutes) ? Math.min(60, Math.max(1, Math.round(row.aheadMinutes))) : DEFAULT_PEAK_ALERT.aheadMinutes;
  return {
    enabled: bool("enabled", DEFAULT_PEAK_ALERT.enabled),
    aheadMinutes: ahead,
    onPeak: bool("onPeak", DEFAULT_PEAK_ALERT.onPeak),
    onOffPeak: bool("onOffPeak", DEFAULT_PEAK_ALERT.onOffPeak),
    webNotify: bool("webNotify", DEFAULT_PEAK_ALERT.webNotify)
  };
}
function parseSyncedPrices(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row = raw;
  const stamp = (key) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : void 0;
  };
  const count2 = (key) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : void 0;
  };
  const fetchedAt = stamp("fetchedAt");
  const modelsDevAt = stamp("modelsDevAt");
  const modelsDevCount = count2("modelsDevCount");
  const eras = parsePriceEras(row.eras);
  const holidays = parseHolidays(row.holidays);
  const holidaysAt = stamp("holidaysAt");
  const holidayYears = parseHolidayYears(row.holidayYears);
  const out = {
    ...fetchedAt === void 0 ? {} : { fetchedAt },
    ...eras === void 0 ? {} : { eras },
    ...modelsDevAt === void 0 ? {} : { modelsDevAt },
    ...modelsDevCount === void 0 ? {} : { modelsDevCount },
    ...holidays === void 0 ? {} : { holidays },
    ...holidaysAt === void 0 ? {} : { holidaysAt },
    ...holidayYears === void 0 ? {} : { holidayYears }
  };
  return Object.keys(out).length > 0 ? out : void 0;
}
function parseHolidayYears(raw) {
  if (!Array.isArray(raw)) return void 0;
  const years = [...new Set(raw.filter(
    (item) => typeof item === "number" && Number.isInteger(item) && item >= 2e3 && item <= 2100
  ))].sort((left, right) => left - right);
  return years.length === 0 ? void 0 : years.slice(0, 12);
}
function sanitizeSettings(value) {
  const source = typeof value === "object" && value !== null ? value : {};
  const asString = (field) => {
    const v = source[field];
    return typeof v === "string" && v.length > 0 && v.length <= 64 ? v : "";
  };
  const asText = (field, max) => {
    const v = source[field];
    return typeof v === "string" && v.length <= max ? v : "";
  };
  const asPrompt = (field, max) => {
    const v = source[field];
    return typeof v === "string" ? v.slice(0, max) : "";
  };
  const asBool = (field) => {
    const v = source[field];
    return typeof v === "boolean" ? v : DEFAULT_SETTINGS[field];
  };
  const asSize = (field) => {
    const v = source[field];
    return typeof v === "number" && Number.isFinite(v) && v >= 320 && v <= 4e3 ? Math.round(v) : void 0;
  };
  const asQuickPrompts = () => {
    const raw = source[QUICK_PROMPTS_FIELD];
    if (!Array.isArray(raw)) return DEFAULT_QUICK_PROMPTS;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of raw) {
      if (out.length >= QUICK_PROMPT_MAX) break;
      if (typeof item !== "object" || item === null) continue;
      const row = item;
      const prompt = typeof row.prompt === "string" ? row.prompt.slice(0, QUICK_TEXT_MAX).trim() : "";
      if (prompt === "") continue;
      const label = typeof row.label === "string" ? row.label.slice(0, QUICK_LABEL_MAX).trim() : "";
      const id = typeof row.id === "string" && row.id !== "" ? row.id.slice(0, 64) : newQuickPromptId();
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        label: label === "" ? prompt.slice(0, 12) : label,
        prompt,
        always: row.always === true,
        firstOnly: row.firstOnly === true
      });
    }
    return out;
  };
  const asTier = () => normalizeOptimizerTier(source[OPTIMIZER_TIER_FIELD]);
  const asNotifyChannel = () => {
    const raw = source[NOTIFY_CHANNEL_FIELD];
    return raw === "wecom" ? "wecom" : "pushplus";
  };
  const asNotifyKinds = () => {
    const raw = source[NOTIFY_KINDS_FIELD];
    const row = typeof raw === "object" && raw !== null ? raw : {};
    return {
      "needs-input": row["needs-input"] !== false,
      done: row.done !== false,
      error: row.error !== false
    };
  };
  return {
    // 微信通知（0.17.0，单向）：默认全关/全空。
    notifyEnabled: asBool(NOTIFY_ENABLED_FIELD),
    // 工作区目录选择自适应（0.19.0）：默认关。
    directoryPickEnabled: asBool(DIRECTORY_PICK_ENABLED_FIELD),
    notifyChannel: asNotifyChannel(),
    notifyPushplusToken: asString(NOTIFY_PUSHPLUS_FIELD),
    notifyWecomWebhook: asString(NOTIFY_WECOM_FIELD),
    notifyKinds: asNotifyKinds(),
    enabled: asBool(ENABLED_FIELD),
    // 五栏开关：显式写过听它的，否则按"用户碰过没"迁移（见 sectionEnabledOf）。
    keysEnabled: sectionEnabledOf(KEYS_ENABLED_FIELD, source),
    menuEnabled: sectionEnabledOf(MENU_ENABLED_FIELD, source),
    quickEnabled: sectionEnabledOf(QUICK_ENABLED_FIELD, source),
    panelEnabled: sectionEnabledOf(PANEL_ENABLED_FIELD, source),
    terminalEnabled: sectionEnabledOf(TERMINAL_ENABLED_FIELD, source),
    sendKey: asString(SEND_KEY_FIELD),
    newlineKey: asString(NEWLINE_KEY_FIELD),
    menuUndo: asBool("menuUndo"),
    menuRedo: asBool("menuRedo"),
    menuCut: asBool("menuCut"),
    menuCopy: asBool("menuCopy"),
    menuPaste: asBool("menuPaste"),
    menuDelete: asBool("menuDelete"),
    menuSelectAll: asBool("menuSelectAll"),
    menuMode: menuModeFrom(source[MENU_MODE_FIELD], source[MENU_NATIVE_FIELD]),
    panelResize: asBool(PANEL_RESIZE_FIELD),
    panelWidth: asSize(PANEL_WIDTH_FIELD),
    panelHeight: asSize(PANEL_HEIGHT_FIELD),
    headerEnabled: asBool(HEADER_ENABLED_FIELD),
    // 头名留空是不合法状态（宿主半会拒绝写入并把原因写进 headerStatus），
    // 故净化只做长度收窄、保留原样，让用户看得见自己输错了什么。
    headerName: asText(HEADER_NAME_FIELD, HEADER_NAME_MAX),
    headerValue: asText(HEADER_VALUE_FIELD, HEADER_VALUE_MAX),
    headerRoutes: asText(HEADER_ROUTES_FIELD, HEADER_VALUE_MAX),
    headerAppliedName: asText(HEADER_APPLIED_NAME_FIELD, HEADER_NAME_MAX),
    headerAppliedValue: asText(HEADER_APPLIED_VALUE_FIELD, HEADER_VALUE_MAX),
    headerStatus: asText(HEADER_STATUS_FIELD, HEADER_VALUE_MAX),
    quickPrompts: asQuickPrompts(),
    optimizerTier: asTier(),
    optimizerContext: asBool(OPTIMIZER_CONTEXT_FIELD),
    optimizerLedger: asBool(OPTIMIZER_LEDGER_FIELD),
    optimizeKeepDock: asBool(OPTIMIZE_KEEP_DOCK_FIELD),
    optimizeReadTools: asBool(OPTIMIZE_READ_TOOLS_FIELD),
    // 枚举只认白名单里的值：写坏了就落回默认（与其它枚举字段同一做法）。
    optimizerFraming: source[OPTIMIZER_FRAMING_FIELD] === "hard" ? "hard" : DEFAULT_OPTIMIZER_FRAMING,
    optimizerPermission: source[OPTIMIZER_PERMISSION_FIELD] === "auto" ? "auto" : DEFAULT_OPTIMIZER_PERMISSION,
    optimizerModel: typeof source[OPTIMIZER_MODEL_FIELD] === "string" ? source[OPTIMIZER_MODEL_FIELD].trim().slice(0, OPTIMIZER_MODEL_MAX) : "",
    optimizerHistory: source[OPTIMIZER_HISTORY_FIELD] === "full" ? "full" : "turns",
    optimizerTurns: normalizeOptimizerTurns(source[OPTIMIZER_TURNS_FIELD]),
    optimizeBash: asBool(OPTIMIZE_BASH_FIELD),
    // 0.14.0 改名迁移：新字段为空而旧字段有内容 ⇒ 用旧内容（用户改过的提示词不该因为改名丢掉）。
    optimizerPromptLight: asPrompt(OPTIMIZER_PROMPT_FIELDS.light, OPTIMIZER_PROMPT_MAX) || asPrompt(LEGACY_OPTIMIZER_PROMPT_FIELDS.light, OPTIMIZER_PROMPT_MAX),
    optimizerPromptStandard: asPrompt(OPTIMIZER_PROMPT_FIELDS.standard, OPTIMIZER_PROMPT_MAX) || asPrompt(LEGACY_OPTIMIZER_PROMPT_FIELDS.standard, OPTIMIZER_PROMPT_MAX),
    optimizerPromptHeavy: asPrompt(OPTIMIZER_PROMPT_FIELDS.heavy, OPTIMIZER_PROMPT_MAX) || asPrompt(LEGACY_OPTIMIZER_PROMPT_FIELDS.heavy, OPTIMIZER_PROMPT_MAX),
    terminalMode: terminalModeFrom(source[TERMINAL_MODE_FIELD]),
    // 路径只做长度与归一化收窄，不在这里判"存不存在"——那是宿主半的探测结论，
    // 由状态行告诉用户（用户看得见自己填了什么，比悄悄清空好）。
    terminalBashPath: asText(TERMINAL_BASH_PATH_FIELD, 400),
    terminalCandidates: sanitizeTerminalCandidates(source[TERMINAL_CANDIDATES_FIELD]),
    terminalStatus: asText(TERMINAL_STATUS_FIELD, 400),
    terminalEffective: asText(TERMINAL_EFFECTIVE_FIELD, 16),
    // 「统计行」（0.7.0）：普通布尔字段、默认开 —— **不走** sectionEnabledOf（那套是给
    // 已发布的五栏做"碰过才开"迁移用的；新栏没有痕迹可依，且用户要求默认生效）。
    statsEnabled: asBool(STATS_ENABLED_FIELD),
    // 「金额」（0.9.1）：整张覆盖价表，形状不对的项由 parsePriceOverrides 逐项丢掉。
    priceOverrides: parsePriceOverrides(source[PRICE_OVERRIDES_FIELD]),
    // 「金额」（0.10.0）：节假日表（坏日期逐条丢）、峰谷提醒、余额开关、同步元信息。
    peakHolidays: parseHolidays(source[PEAK_HOLIDAYS_FIELD]),
    peakAlert: sanitizePeakAlert(source[PEAK_ALERT_FIELD]),
    balanceEnabled: asBool(BALANCE_ENABLED_FIELD),
    syncedPrices: parseSyncedPrices(source[SYNCED_PRICES_FIELD]),
    priceAutoSync: asBool(PRICE_AUTO_SYNC_FIELD)
  };
}
var ALL_SETTINGS_FIELDS = [
  BALANCE_ENABLED_FIELD,
  DIRECTORY_PICK_ENABLED_FIELD,
  ENABLED_FIELD,
  HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD,
  HEADER_CLEANUP_FIELD,
  HEADER_ENABLED_FIELD,
  HEADER_NAME_FIELD,
  HEADER_ROUTES_FIELD,
  HEADER_STATUS_FIELD,
  HEADER_VALUE_FIELD,
  KEYS_ENABLED_FIELD,
  MENU_ENABLED_FIELD,
  MENU_MODE_FIELD,
  MENU_NATIVE_FIELD,
  NEWLINE_KEY_FIELD,
  NOTIFY_CHANNEL_FIELD,
  NOTIFY_ENABLED_FIELD,
  NOTIFY_KINDS_FIELD,
  NOTIFY_PUSHPLUS_FIELD,
  NOTIFY_WECOM_FIELD,
  OPTIMIZER_CONTEXT_FIELD,
  OPTIMIZER_FRAMING_FIELD,
  OPTIMIZER_HISTORY_FIELD,
  OPTIMIZER_LEDGER_FIELD,
  OPTIMIZER_MODEL_FIELD,
  OPTIMIZER_PERMISSION_FIELD,
  OPTIMIZER_TIER_FIELD,
  OPTIMIZER_TURNS_FIELD,
  OPTIMIZE_BASH_FIELD,
  OPTIMIZE_KEEP_DOCK_FIELD,
  OPTIMIZE_READ_TOOLS_FIELD,
  PANEL_ENABLED_FIELD,
  PANEL_HEIGHT_FIELD,
  PANEL_RESIZE_FIELD,
  PANEL_WIDTH_FIELD,
  PEAK_ALERT_FIELD,
  PEAK_HOLIDAYS_FIELD,
  PRICE_AUTO_SYNC_FIELD,
  PRICE_OVERRIDES_FIELD,
  QUICK_ENABLED_FIELD,
  QUICK_PROMPTS_FIELD,
  SEND_KEY_FIELD,
  STATS_ENABLED_FIELD,
  SYNCED_PRICES_FIELD,
  TERMINAL_ENABLED_FIELD
];
var AUTOSTART_API_PATH = "/composer-ux/autostart";
var DOCTOR_API_PATH = "/composer-ux/doctor";

// src/price-sync.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// src/official-pricing.ts
var NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  yen: "\xA5",
  dollar: "$",
  middot: "\xB7",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  times: "\xD7"
};
function decodeEntities(text) {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body.charAt(0) === "#") {
      const hex = body.charAt(1) === "x" || body.charAt(1) === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 1114111 ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}
function normalize(text) {
  return decodeEntities(text).replace(/[\u200b-\u200d\u2060\ufeff]/g, "").replace(/\s+/g, " ").trim();
}
function toText(html) {
  return normalize(
    html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<sup\b[^>]*>[\s\S]*?<\/sup\s*>/gi, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
  );
}
function documentText(html) {
  return toText(html);
}
function readSpan(attrs, name2) {
  const match = new RegExp(`${name2}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  const raw = match === null ? void 0 : match[1] ?? match[2] ?? match[3];
  const span = raw === void 0 ? 1 : Number.parseInt(raw, 10);
  return Number.isFinite(span) && span > 0 ? Math.min(span, 64) : 1;
}
function buildGrid(tableHtml) {
  const rows = [];
  const carry = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const out = [];
    let col = 0;
    const drain = () => {
      while (carry[col] !== void 0 && carry[col].remaining > 0) {
        out[col] = carry[col].cell;
        carry[col].remaining -= 1;
        col += 1;
      }
    };
    const cellRe = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]\s*>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1] ?? "")) !== null) {
      drain();
      const attrs = cellMatch[1] ?? "";
      const cell = {
        text: toText(cellMatch[2] ?? ""),
        colspan: readSpan(attrs, "colspan"),
        rowspan: readSpan(attrs, "rowspan")
      };
      for (let k = 0; k < cell.colspan; k += 1) {
        out[col + k] = cell;
        if (cell.rowspan > 1) carry[col + k] = { cell, remaining: cell.rowspan - 1 };
      }
      col += cell.colspan;
    }
    drain();
    rows.push(out);
  }
  return rows;
}
var MODEL_LABEL_RE = /^(?:模型|model)$/i;
var MODEL_ID_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/;
function withoutFootnoteMark(text) {
  return text.replace(/[\s\u00a0]*[（(]\d+[)）]\s*$/, "").trim();
}
function findHeader(rows) {
  for (const row of rows) {
    for (let start = 0; start < row.length; start += 1) {
      const labelCell = row[start];
      if (labelCell === void 0 || !MODEL_LABEL_RE.test(withoutFootnoteMark(labelCell.text))) continue;
      let end = start;
      while (end + 1 < row.length && row[end + 1] === labelCell) end += 1;
      const modelNames = {};
      for (let col = end + 1; col < row.length; col += 1) {
        const candidate = row[col];
        if (candidate === void 0) continue;
        const name2 = withoutFootnoteMark(candidate.text);
        if (MODEL_ID_RE.test(name2)) modelNames[col] = name2;
      }
      const modelCols = Object.keys(modelNames).map(Number).sort((a, b) => a - b);
      if (modelCols.length > 0) return { modelCols, modelNames };
    }
  }
  return void 0;
}
var CATEGORY_RULES = [
  { field: "hit", re: /缓存命中|CACHE\s*HIT/i },
  { field: "miss", re: /缓存未命中|CACHE\s*MISS/i },
  { field: "out", re: /输出|OUTPUT/i }
];
var OFF_PEAK_RE = /空闲|OFF\s*-?\s*PEAK/i;
var PEAK_RE = /高峰|PEAK/i;
var MONEY_RE = /^(?:(?:US)?\$|[¥￥]|USD|CNY|RMB)?\s*(\d+(?:\.\d+)?)\s*(?:元|人民币|美元|USD|CNY|RMB)?$/i;
function readMoney(text) {
  const match = MONEY_RE.exec(text);
  if (match === null) return void 0;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : void 0;
}
var CNY_RE = /[¥￥]|元|人民币|\bRMB\b|\bCNY\b/i;
var USD_RE = /\$|美元|\bUSD\b/i;
function currencyOf(texts) {
  let cny = false;
  let usd = false;
  for (const text of texts) {
    if (CNY_RE.test(text)) cny = true;
    if (USD_RE.test(text)) usd = true;
  }
  if (cny === usd) return void 0;
  return cny ? "CNY" : "USD";
}
function completeRate(parts) {
  const hit = parts.hit;
  const miss = parts.miss;
  const out = parts.out;
  if (typeof hit !== "number" || !Number.isFinite(hit) || hit < 0 || typeof miss !== "number" || !Number.isFinite(miss) || miss < 0 || typeof out !== "number" || !Number.isFinite(out) || out < 0) return void 0;
  return { hit, miss, out };
}
function parsePricingRows(rows, header) {
  const firstModelCol = header.modelCols[0];
  const drafts = {};
  for (const col of header.modelCols) drafts[header.modelNames[col]] = { peak: {}, offPeak: {} };
  const moneyTexts = [];
  for (const row of rows) {
    if (row.length <= firstModelCol) continue;
    const label = row.slice(0, firstModelCol).map((cell) => cell === void 0 ? "" : cell.text).join(" ");
    const category = CATEGORY_RULES.find((rule) => rule.re.test(label));
    if (category === void 0) continue;
    const tier = OFF_PEAK_RE.test(label) ? "offPeak" : PEAK_RE.test(label) ? "peak" : void 0;
    if (tier === void 0) continue;
    for (const col of header.modelCols) {
      const name2 = header.modelNames[col];
      const raw = row[col] === void 0 ? "" : row[col].text;
      const value = readMoney(raw);
      if (value === void 0) return void 0;
      drafts[name2][tier][category.field] = value;
      moneyTexts.push(raw);
    }
  }
  const table = {};
  for (const [name2, tiers] of Object.entries(drafts)) {
    const peak = completeRate(tiers.peak);
    const offPeak = completeRate(tiers.offPeak);
    if (peak === void 0 || offPeak === void 0) return void 0;
    table[name2] = { peak, offPeak };
  }
  if (Object.keys(table).length === 0) return void 0;
  const allTexts = rows.flatMap((row) => row.map((cell) => cell === void 0 ? "" : cell.text));
  const currency = currencyOf(moneyTexts) ?? currencyOf(allTexts);
  if (currency === void 0) return void 0;
  return { currency, table };
}
var LEGACY_MARKER_RE = /旧模型名|旧名|已下线|已退役|legacy|deprecated|renamed|still accepted|仍可调用/i;
var ALIAS_TOKEN_RE = /(?<![A-Za-z0-9_])[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+/g;
var ALIAS_WINDOW = 400;
function lastMarkerBefore(text, limit) {
  const re = new RegExp(LEGACY_MARKER_RE.source, "gi");
  let found;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index >= limit) break;
    found = { index: match.index, length: match[0].length };
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return found;
}
function extractAliases(html, models) {
  const aliases = {};
  if (models.length === 0) return aliases;
  const text = documentText(html);
  const known = new Set(models);
  const families = new Set(models.map((model) => model.split(/[._-]/)[0] ?? ""));
  const marks = [];
  for (const model of models) {
    const finder = new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let found;
    while ((found = finder.exec(text)) !== null) marks.push({ at: found.index, model });
  }
  marks.sort((a, b) => a.at === b.at ? a.model < b.model ? -1 : 1 : a.at - b.at);
  ALIAS_TOKEN_RE.lastIndex = 0;
  let token;
  while ((token = ALIAS_TOKEN_RE.exec(text)) !== null) {
    const name2 = token[0];
    if (known.has(name2)) continue;
    if (!families.has(name2.split(/[._-]/)[0] ?? "")) continue;
    const at = token.index;
    let owner;
    let ownerAt = -1;
    for (const mark of marks) {
      if (mark.at >= at) break;
      owner = mark.model;
      ownerAt = mark.at;
    }
    if (owner === void 0) continue;
    const marker = lastMarkerBefore(text, at);
    if (marker === void 0 || ownerAt >= marker.index) continue;
    if (at - marker.index > ALIAS_WINDOW) continue;
    if (aliases[name2] === void 0) aliases[name2] = owner;
  }
  return aliases;
}
function parseOfficialPricingPage(html) {
  if (typeof html !== "string" || html.length === 0) return void 0;
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi);
  if (tables === null) return void 0;
  for (const tableHtml of tables) {
    const rows = buildGrid(tableHtml);
    const header = findHeader(rows);
    if (header === void 0) continue;
    const parsed = parsePricingRows(rows, header);
    if (parsed === void 0) return void 0;
    return {
      currency: parsed.currency,
      table: parsed.table,
      aliases: extractAliases(html, Object.keys(parsed.table))
    };
  }
  return void 0;
}

// src/price-sync.ts
var OFFICIAL_PRICING_URLS = {
  cny: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/",
  usd: "https://api-docs.deepseek.com/quick_start/pricing/"
};
function officialPricingCandidates(kind) {
  const canonical = OFFICIAL_PRICING_URLS[kind];
  const alternate = canonical.endsWith("/") ? canonical.slice(0, -1) : `${canonical}/`;
  return [canonical, alternate];
}
var MODELS_DEV_URL = "https://models.dev/api.json";
var PAGE_TIMEOUT_MS = 15e3;
var REGISTRY_TIMEOUT_MS = 6e4;
var AUTO_SYNC_STALE_MS = 24 * 36e5;
function autoSyncDue(options) {
  if (options.enabled !== true) return false;
  if (!Number.isFinite(options.nowMs)) return false;
  const last = typeof options.fetchedAt === "number" && Number.isFinite(options.fetchedAt) ? options.fetchedAt : 0;
  return options.nowMs - last >= (options.staleMs ?? AUTO_SYNC_STALE_MS);
}
var PRICE_STORE_FILE = "prices.json";
function dshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  return fromEnv !== void 0 && fromEnv !== "" ? fromEnv : join(homedir(), ".dsh");
}
function priceStorePath() {
  return join(dshHome(), "storages", "composer-ux", PRICE_STORE_FILE);
}
async function readPriceFile(file = priceStorePath()) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    const value = typeof parsed === "object" && parsed !== null ? parsed : {};
    const fetchedAt = typeof value.fetchedAt === "number" && Number.isFinite(value.fetchedAt) ? value.fetchedAt : void 0;
    const providers = parseProviderPricesLoose(value.providers);
    return {
      ...fetchedAt === void 0 ? {} : { fetchedAt },
      ...providers === void 0 ? {} : { providers }
    };
  } catch {
    return {};
  }
}
async function writePriceFile(data, file = priceStorePath()) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, JSON.stringify(data), "utf8");
  await rename(temp, file);
}
function compactModelsDev(payload) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return void 0;
  const out = {};
  for (const [providerId, provider] of Object.entries(payload)) {
    const id = providerId.trim().toLowerCase();
    if (id === "" || id === "deepseek") continue;
    if (typeof provider !== "object" || provider === null || Array.isArray(provider)) continue;
    const models = provider.models;
    if (typeof models !== "object" || models === null || Array.isArray(models)) continue;
    const kept = {};
    for (const [modelId, model] of Object.entries(models)) {
      if (typeof model !== "object" || model === null || Array.isArray(model)) continue;
      const cost = model.cost;
      if (typeof cost !== "object" || cost === null || Array.isArray(cost)) continue;
      const row = cost;
      const miss = rate(row.input);
      const out_ = rate(row.output);
      if (miss === void 0 || out_ === void 0) continue;
      const hit = rate(row.cache_read);
      const key = modelId.trim().toLowerCase();
      if (key === "") continue;
      kept[key] = { miss, hit: hit ?? miss, out: out_ };
    }
    if (Object.keys(kept).length > 0) out[id] = kept;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function rate(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
function parseProviderPricesLoose(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const out = {};
  for (const [providerId, models] of Object.entries(raw)) {
    if (typeof models !== "object" || models === null || Array.isArray(models)) continue;
    const kept = {};
    for (const [modelId, value] of Object.entries(models)) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
      const row = value;
      const miss = rate(row.miss);
      if (miss === void 0) continue;
      kept[modelId.trim().toLowerCase()] = { miss, hit: rate(row.hit) ?? miss, out: rate(row.out) ?? 0 };
    }
    if (Object.keys(kept).length > 0) out[providerId.trim().toLowerCase()] = kept;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function eraFromOfficial(cnyPage, usdPage, fromMs, source) {
  const table = {};
  for (const [model, cny] of Object.entries(cnyPage.table)) {
    const usd = usdPage.table[model];
    if (usd === void 0) continue;
    table[model.trim().toLowerCase()] = { peak: { cny: cny.peak, usd: usd.peak }, offPeak: { cny: cny.offPeak, usd: usd.offPeak } };
  }
  if (Object.keys(table).length === 0) return void 0;
  return {
    id: `sync-${new Date(fromMs).toISOString().replace(/[:.]/g, "-")}`,
    fromMs,
    label: `\u540C\u6B65\u4E8E ${new Date(fromMs).toLocaleString("zh-CN")}`,
    source,
    table
  };
}
function samePriceTable(left, right) {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    const a = left[key];
    const b = right[key];
    if (a === void 0 || b === void 0) return false;
    for (const tier of ["peak", "offPeak"]) {
      for (const currency of ["cny", "usd"]) {
        const x = a[tier][currency];
        const y = b[tier][currency];
        if (x.miss !== y.miss || x.hit !== y.hit || x.out !== y.out) return false;
      }
    }
  }
  return true;
}
async function fetchText(url, options = {}) {
  const doFetch = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? PAGE_TIMEOUT_MS);
  try {
    const response = await doFetch(url, { signal: controller.signal, headers: { accept: "text/html,application/json" } });
    if (response.ok !== true) return void 0;
    const text = await response.text();
    if (options.minLength !== void 0 && text.length < options.minLength) return void 0;
    return text;
  } catch {
    return void 0;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchOfficialPages(options = {}) {
  const fetchOne = async (kind) => {
    for (const url of officialPricingCandidates(kind)) {
      const text = await fetchText(url, { ...options, minLength: 500 });
      if (text === void 0) continue;
      const page = parseOfficialPricingPage(text);
      if (page !== void 0) return page;
    }
    return void 0;
  };
  const [cny, usd] = await Promise.all([fetchOne("cny"), fetchOne("usd")]);
  if (cny === void 0 || usd === void 0) return void 0;
  return { cny, usd };
}
async function fetchModelsDevPrices(options = {}) {
  const text = await fetchText(MODELS_DEV_URL, { ...options, timeoutMs: options.timeoutMs ?? REGISTRY_TIMEOUT_MS, minLength: 1e3 });
  if (text === void 0) return void 0;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return void 0;
  }
  return compactModelsDev(parsed);
}

// src/holiday-sync.ts
var HOLIDAY_YEAR_TIMEOUT_MS = 15e3;
var HOLIDAY_STALE_MS = 30 * 24 * 36e5;
var HOLIDAY_MAX_DAYS = 400;
function holidayYearUrls(year) {
  const tag = String(year);
  return {
    primary: `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${tag}.json`,
    mirror: `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${tag}.json`
  };
}
function holidayYearsWanted(nowMs) {
  const safe = Number.isFinite(nowMs) ? nowMs : Date.now();
  const year = Number(new Date(safe + 8 * 36e5).toISOString().slice(0, 4));
  return [year, year + 1];
}
function parseHolidayYear(payload, expectedYear) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return void 0;
  const row = payload;
  const year = typeof row.year === "number" ? row.year : Number(row.year);
  if (year !== expectedYear) return void 0;
  const days = row.days;
  if (days === void 0 || days === null) return [];
  if (!Array.isArray(days)) return void 0;
  const out = [];
  for (const item of days) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item;
    if (entry.isOffDay !== true) continue;
    const date2 = entry.date;
    if (!isDayKey(date2)) continue;
    if (date2.slice(0, 4) !== String(expectedYear)) continue;
    out.push(date2);
  }
  return [...new Set(out)].sort().slice(0, HOLIDAY_MAX_DAYS);
}
function holidaySyncDue(options) {
  if (options.enabled !== true) return [];
  if (!Number.isFinite(options.nowMs)) return [];
  const have = new Set((options.yearsHave ?? []).filter((year) => Number.isFinite(year)));
  const last = typeof options.lastAt === "number" && Number.isFinite(options.lastAt) ? options.lastAt : 0;
  const stale = options.staleMs ?? HOLIDAY_STALE_MS;
  const grown = options.nowMs - last >= stale;
  return holidayYearsWanted(options.nowMs).filter((year) => grown || !have.has(year));
}
function mergeHolidayDays(existing, incoming) {
  const list = (value) => Array.isArray(value) ? value.filter(isDayKey) : [];
  const merged = [.../* @__PURE__ */ new Set([...list(existing), ...list(incoming)])].sort();
  return merged.length === 0 ? void 0 : merged.slice(-HOLIDAY_MAX_DAYS);
}
async function fetchHolidayYear(year, options = {}) {
  const urls = holidayYearUrls(year);
  for (const url of [urls.primary, urls.mirror]) {
    const text = await fetchText(url, {
      ...options.fetcher === void 0 ? {} : { fetcher: options.fetcher },
      timeoutMs: options.timeoutMs ?? HOLIDAY_YEAR_TIMEOUT_MS,
      minLength: 20
    });
    if (text === void 0) continue;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }
    const days = parseHolidayYear(parsed, year);
    if (days === void 0) continue;
    return days;
  }
  return void 0;
}
async function fetchHolidayYears(years, options = {}) {
  const days = [];
  const fetched = [];
  const unpublished = [];
  const failed = [];
  for (const year of years) {
    const result = await fetchHolidayYear(year, options);
    if (result === void 0) failed.push(year);
    else if (result.length === 0) unpublished.push(year);
    else {
      fetched.push(year);
      days.push(...result);
    }
  }
  return { days: [...new Set(days)].sort(), fetched, unpublished, failed };
}

// src/notify.ts
var NOTIFY_DEDUPE_MS = 3e4;
var PUSHPLUS_ENDPOINT = "https://www.pushplus.plus/send";
var KIND_TITLE = {
  "needs-input": "DSH \u9700\u8981\u4F60\u56DE\u5E94",
  done: "DSH \u4EFB\u52A1\u5B8C\u6210",
  error: "DSH \u4EFB\u52A1\u51FA\u9519"
};
function redactSecret(value) {
  if (value === "") return "";
  if (value.length < 8) return "****";
  return `${value.slice(0, 4)}\u2026${value.slice(-2)}`;
}
function notifyAllowed(settings, kind) {
  if (!settings.enabled) return false;
  if (settings.kinds[kind] !== true) return false;
  if (settings.channel === "pushplus") return settings.pushplusToken.trim() !== "";
  return settings.wecomWebhook.trim() !== "";
}
function notifySuppressed(last, event, now = Date.now()) {
  const key = `${event.sessionTitle}|${event.kind}`;
  const previous = last[key];
  if (previous === void 0) return false;
  return now - previous < NOTIFY_DEDUPE_MS;
}
function notifyText(event, at) {
  const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const lines = [KIND_TITLE[event.kind]];
  if (event.sessionTitle !== "") lines.push(`\u4F1A\u8BDD\uFF1A${event.sessionTitle}`);
  if (event.detail !== "") lines.push(event.detail);
  lines.push(`${clock} \xB7 \u53EA\u80FD\u901A\u77E5\uFF0C\u4E0D\u80FD\u56DE\uFF08\u8981\u5904\u7406\u8BF7\u56DE DSH \u754C\u9762\uFF09`);
  return lines.join("\n");
}
function buildNotifyRequest(settings, event, at = /* @__PURE__ */ new Date()) {
  const title = KIND_TITLE[event.kind];
  const content = notifyText(event, at);
  if (settings.channel === "pushplus") {
    const token = settings.pushplusToken.trim();
    if (token === "") return null;
    return {
      url: PUSHPLUS_ENDPOINT,
      headers: { "content-type": "application/json" },
      // topic 不传：推给该 token 绑定的人（用户自己关注的公众号对话）。
      body: JSON.stringify({ token, title, content, template: "txt" })
    };
  }
  const webhook = settings.wecomWebhook.trim();
  if (webhook === "") return null;
  return {
    url: webhook,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ msgtype: "text", text: { content: `${title}
${content}` } })
  };
}
function interpretNotifyResponse(channel, status, body) {
  if (status < 200 || status >= 300) return `HTTP ${String(status)}`;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return "\u54CD\u5E94\u4E0D\u662F JSON\uFF08\u6E20\u9053\u5730\u5740\u53EF\u80FD\u586B\u9519\u4E86\uFF09";
  }
  const doc = parsed;
  if (channel === "pushplus") {
    if (doc.code === 200) return "";
    const reason2 = typeof doc.msg === "string" && doc.msg !== "" ? doc.msg : "\u672A\u77E5\u539F\u56E0";
    return `PushPlus \u62D2\u7EDD\uFF1A${reason2}`;
  }
  if (doc.errcode === 0) return "";
  const reason = typeof doc.errmsg === "string" && doc.errmsg !== "" ? doc.errmsg : "\u672A\u77E5\u539F\u56E0";
  return `\u4F01\u4E1A\u5FAE\u4FE1\u62D2\u7EDD\uFF1A${reason}`;
}

// src/notify-send.ts
async function sendNotification(settings, event, io) {
  const now = io.now?.() ?? Date.now();
  if (!notifyAllowed(settings, event.kind)) {
    if (!settings.enabled) return { sent: false, reason: "\u901A\u77E5\u603B\u5F00\u5173\u662F\u5173\u7684" };
    if (settings.kinds[event.kind] !== true) return { sent: false, reason: "\u8FD9\u4E00\u7C7B\u4E8B\u4EF6\u4F60\u6CA1\u5F00" };
    const field = settings.channel === "pushplus" ? "PushPlus token" : "\u4F01\u4E1A\u5FAE\u4FE1 webhook";
    return { sent: false, reason: `\u6CA1\u586B ${field}\uFF08\u73B0\u5728\u586B\u7684\u503C\uFF1A${redactSecret(settings.channel === "pushplus" ? settings.pushplusToken : settings.wecomWebhook) || "\u7A7A"}\uFF09` };
  }
  if (notifySuppressed(io.lastSent, event, now)) {
    return { sent: false, reason: "\u540C\u7C7B\u901A\u77E5 30 \u79D2\u5185\u5DF2\u53D1\u8FC7\u4E00\u6761\uFF08\u9632\u5237\u5C4F\uFF09" };
  }
  const request = buildNotifyRequest(settings, event, new Date(now));
  if (request === null) return { sent: false, reason: "\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u6CA1\u6709\u53EF\u53D1\u7684\u8BF7\u6C42" };
  io.lastSent[`${event.sessionTitle}|${event.kind}`] = now;
  let response;
  try {
    response = await io.fetchText(request.url, { method: "POST", headers: request.headers, body: request.body });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sent: false, reason: `\u8FDE\u4E0D\u4E0A\u6E20\u9053\uFF1A${message}` };
  }
  const problem = interpretNotifyResponse(settings.channel, response.status, response.body);
  return problem === "" ? { sent: true, reason: "" } : { sent: false, reason: problem };
}
var NOTIFY_TEST_EVENT = {
  kind: "done",
  sessionTitle: "",
  detail: "\u8FD9\u662F\u4E00\u6761\u6D4B\u8BD5\u63A8\u9001 \u2014\u2014 \u770B\u5230\u5B83\u8BF4\u660E\u914D\u7F6E\u751F\u6548\u4E86"
};
async function sendTestNotification(settings, io) {
  if (!settings.enabled) return { sent: false, reason: "\u901A\u77E5\u603B\u5F00\u5173\u662F\u5173\u7684\uFF08\u6253\u5F00\u5B83\u518D\u70B9\u6D4B\u8BD5\u63A8\u9001\uFF09" };
  const field = settings.channel === "pushplus" ? "PushPlus token" : "\u4F01\u4E1A\u5FAE\u4FE1 webhook";
  const credential = settings.channel === "pushplus" ? settings.pushplusToken : settings.wecomWebhook;
  if (credential.trim() === "") return { sent: false, reason: `\u8FD8\u6CA1\u586B ${field}` };
  const request = buildNotifyRequest(settings, NOTIFY_TEST_EVENT, /* @__PURE__ */ new Date());
  if (request === null) return { sent: false, reason: "\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u6CA1\u6709\u53EF\u53D1\u7684\u8BF7\u6C42" };
  let response;
  try {
    response = await io.fetchText(request.url, { method: "POST", headers: request.headers, body: request.body });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sent: false, reason: `\u8FDE\u4E0D\u4E0A\u6E20\u9053\uFF1A${message}` };
  }
  const problem = interpretNotifyResponse(settings.channel, response.status, response.body);
  return problem === "" ? { sent: true, reason: "" } : { sent: false, reason: problem };
}

// src/notify-route.ts
function firstHeader(value) {
  if (value === void 0) return "";
  return Array.isArray(value) ? String(value[0] ?? "") : String(value);
}
function createNotifyTestHandler(io) {
  return async (req, res) => {
    const send = (code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    if (req.method !== "POST") {
      send(405, { ok: false, reason: "\u6D4B\u8BD5\u63A8\u9001\u8981\u7528 POST" });
      return;
    }
    if (firstHeader(req.headers?.[RESTART_CSRF_HEADER]) !== RESTART_CSRF_VALUE) {
      send(403, { ok: false, reason: `\u7F3A\u5C11 ${RESTART_CSRF_HEADER}: ${RESTART_CSRF_VALUE} \u5934\uFF08\u8DE8\u7AD9\u9875\u9762\u52A0\u4E0D\u4E86\u8FD9\u4E2A\u5934\uFF09` });
      return;
    }
    let settings;
    try {
      settings = io.readSettings();
    } catch (error) {
      send(500, { ok: false, reason: `\u8BFB\u4E0D\u5230\u901A\u77E5\u8BBE\u7F6E\uFF1A${error instanceof Error ? error.message : String(error)}` });
      return;
    }
    const outcome = await sendTestNotification(settings, { fetchText: io.fetchText });
    send(200, { ok: outcome.sent, reason: outcome.reason });
  };
}

// src/notify-events.ts
var NOTIFY_DETAIL_MAX = 160;
function summarize(value) {
  const one = value.replace(/\s+/gu, " ").trim();
  if (one.length <= NOTIFY_DETAIL_MAX) return one;
  return `${one.slice(0, NOTIFY_DETAIL_MAX - 1)}\u2026`;
}
function describeError(error) {
  if (error === null || error === void 0) return "\u539F\u56E0\u672A\u77E5\uFF08\u4E8B\u4EF6\u91CC\u6CA1\u5E26 error\uFF09";
  if (typeof error === "string") return summarize(error);
  if (typeof error === "object") {
    const message = error.message;
    if (typeof message === "string" && message !== "") return summarize(message);
  }
  if (typeof error === "number" || typeof error === "boolean") return String(error);
  return "\u539F\u56E0\u672A\u77E5\uFF08error \u4E0D\u662F\u5E38\u89C1\u5F62\u72B6\uFF09";
}
function notifyForApproval(sessionTitle, toolName) {
  return {
    kind: "needs-input",
    sessionTitle,
    detail: toolName === void 0 || toolName === "" ? "\u6709\u4E00\u6761\u64CD\u4F5C\u7B49\u4F60\u5BA1\u6279\uFF08\u56DE DSH \u754C\u9762\u5904\u7406\uFF09" : `\u6709\u4E00\u6761\u64CD\u4F5C\u7B49\u4F60\u5BA1\u6279\uFF1A${summarize(toolName)}\uFF08\u56DE DSH \u754C\u9762\u5904\u7406\uFF09`
  };
}
function notifyForQuestion(sessionTitle, question) {
  return {
    kind: "needs-input",
    sessionTitle,
    detail: question === void 0 || question === "" ? "\u6709\u4E00\u4E2A\u95EE\u9898\u7B49\u4F60\u56DE\u7B54\uFF08\u56DE DSH \u754C\u9762\u5904\u7406\uFF09" : `\u7B49\u4F60\u56DE\u7B54\uFF1A${summarize(question)}`
  };
}
function notifyForStatus(previous, next, sessionTitle) {
  if (previous !== "running" || next !== "idle") return null;
  return { kind: "done", sessionTitle, detail: "\u8FD9\u4E00\u8F6E\u8DD1\u5B8C\u4E86\uFF08\u8BE6\u7EC6\u5185\u5BB9\u56DE DSH \u754C\u9762\u770B\uFF09" };
}
function notifyForAgentError(sessionTitle, error) {
  return { kind: "error", sessionTitle, detail: `\u51FA\u9519\u4E86\uFF1A${describeError(error)}` };
}

// src/notify-hooks.ts
function looseSessionId(payload) {
  if (typeof payload !== "object" || payload === null) return void 0;
  const agent = payload.agent;
  if (typeof agent !== "object" || agent === null) return void 0;
  const id = agent.id;
  if (typeof id === "string" && id !== "") return id;
  const sessionId = agent.sessionId;
  return typeof sessionId === "string" && sessionId !== "" ? sessionId : void 0;
}
function registerNotifyHooks(io) {
  const disposers = [];
  const lastStatus = /* @__PURE__ */ new Map();
  const safe = (label, run) => {
    try {
      run();
    } catch (error) {
      io.warn(`[notify] ${label} \u5904\u7406\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const add = (name2, handler) => {
    const dispose = io.on(name2, handler);
    if (typeof dispose === "function") disposers.push(dispose);
  };
  add("approval/request", (payload, next) => {
    safe("approval/request", () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload);
      io.deliver(notifyForApproval(io.titleOf(sessionId), io.toolNameOf?.(payload)));
    });
    return next === void 0 ? void 0 : next();
  });
  add("user-questions/request", (payload, next) => {
    safe("user-questions/request", () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload);
      io.deliver(notifyForQuestion(io.titleOf(sessionId), io.questionOf?.(payload)));
    });
    return next === void 0 ? void 0 : next();
  });
  add("agent/status", (payload) => {
    safe("agent/status", () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload) ?? "";
      const status = typeof payload === "object" && payload !== null ? payload.status : void 0;
      if (typeof status !== "string") return;
      const event = notifyForStatus(lastStatus.get(sessionId), status, io.titleOf(sessionId));
      lastStatus.set(sessionId, status);
      if (event !== null) io.deliver(event);
    });
  });
  add("agent/error", (payload) => {
    safe("agent/error", () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload) ?? "";
      const error = typeof payload === "object" && payload !== null ? payload.error : void 0;
      io.deliver(notifyForAgentError(io.titleOf(sessionId), error));
    });
  });
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
      }
    }
    disposers.length = 0;
    lastStatus.clear();
  };
}

// src/balance.ts
var BALANCE_API_PATH = "/composer-ux/balance";
var DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
function amountOf(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (text.length === 0) return 0;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? withoutNegativeZero(parsed) : 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return withoutNegativeZero(value);
}
function withoutNegativeZero(value) {
  return value === 0 ? 0 : value;
}
function entryOf(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const raw = value;
  if (typeof raw.currency !== "string") return void 0;
  const currency = raw.currency.trim();
  if (currency.length === 0) return void 0;
  const granted = amountOf(raw.granted_balance);
  const toppedUp = amountOf(raw.topped_up_balance);
  const sum = granted + toppedUp;
  return {
    currency,
    // 分项相加的理由见文件头；极端溢出（1e308 + 1e308 ⇒ Infinity）不是余额，当 0 更诚实。
    total: Number.isFinite(sum) ? sum : 0,
    granted,
    toppedUp
  };
}
function parseBalancePayload(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const raw = value;
  const available = raw.is_available;
  if (typeof available !== "boolean") return void 0;
  if (!Array.isArray(raw.balance_infos)) return void 0;
  const entries = [];
  for (const item of raw.balance_infos) {
    const entry = entryOf(item);
    if (entry !== void 0) entries.push(entry);
  }
  if (entries.length === 0) return void 0;
  return { available, entries };
}
function balanceEndpointAllowed(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.length === 0) return false;
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "api.deepseek.com") return false;
  if (parsed.port !== "" && parsed.port !== "443") return false;
  if (parsed.username !== "" || parsed.password !== "") return false;
  return true;
}

// src/opencode-header.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname as dirname2, join as join2, resolve as resolve2 } from "node:path";
var NATIVE_SUPPORT_ENV = "DSH_COMPOSER_UX_HEADER_NATIVE";
function versionOf(piAiRoot) {
  try {
    const parsed = JSON.parse(readFileSync(join2(piAiRoot, "package.json"), "utf8"));
    const version = parsed?.version;
    return typeof version === "string" ? version : "";
  } catch {
    return "";
  }
}
function piAiRoots() {
  const roots = [];
  const resources = process.resourcesPath;
  if (typeof resources === "string" && resources !== "") {
    roots.push(join2(resources, "app.asar", "dsh", "node_modules", "@earendil-works", "pi-ai"));
    roots.push(join2(resources, "app", "node_modules", "@earendil-works", "pi-ai"));
  }
  const entry = process.argv[1];
  if (typeof entry === "string" && entry !== "") {
    let dir = dirname2(resolve2(entry));
    for (let depth = 0; depth < 8; depth += 1) {
      roots.push(join2(dir, "node_modules", "@earendil-works", "pi-ai"));
      const store = join2(dir, "node_modules", ".pnpm");
      try {
        for (const name2 of readdirSync(store)) {
          if (name2.startsWith("@earendil-works+pi-ai@")) {
            roots.push(join2(store, name2, "node_modules", "@earendil-works", "pi-ai"));
          }
        }
      } catch {
      }
      const up = dirname2(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return roots;
}
function inspectPiAiRoot(piAiRoot) {
  try {
    if (!existsSync(join2(piAiRoot, "dist", "providers", "opencode-headers.js"))) return void 0;
  } catch {
    return void 0;
  }
  const version = versionOf(piAiRoot);
  return {
    support: "native",
    evidence: version === "" ? "pi-ai \u81EA\u5E26 opencode-headers.js" : `pi-ai ${version} \u81EA\u5E26 opencode-headers.js`
  };
}
function detectNativeSessionHeader(env = process.env, roots = piAiRoots()) {
  const forced = env[NATIVE_SUPPORT_ENV];
  if (forced === "1" || forced === "true") return { support: "native", evidence: "\u73AF\u5883\u53D8\u91CF\u5F3A\u5236" };
  if (forced === "0" || forced === "false") return { support: "legacy", evidence: "" };
  for (const root of roots) {
    const found = inspectPiAiRoot(root);
    if (found !== void 0) return found;
  }
  return { support: "legacy", evidence: "" };
}
var cached;
function nativeSessionHeader() {
  cached ??= detectNativeSessionHeader();
  return cached;
}
function resetNativeSessionHeaderCache() {
  cached = void 0;
}

// src/runtime-version.ts
function versionOfManifest(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed.version === "string" ? parsed.version.trim() : "";
  } catch {
    return "";
  }
}
function detectRuntimeVersion(options = {}) {
  const env = options.env ?? process.env;
  const readFile4 = options.readFile ?? ((path) => defaultReadFile(path));
  const join9 = options.joinPath ?? ((...parts) => parts.join("/").replace(/\/+/g, "/"));
  const dirname9 = options.dirName ?? ((path) => path.replace(/[\\/][^\\/]*$/, ""));
  const homeDir = options.homeDir ?? defaultHomeDir();
  const candidates = [];
  const entry = options.resolveAppBoot?.() ?? defaultResolveAppBoot();
  if (entry !== void 0 && entry !== "") {
    candidates.push(join9(dirname9(dirname9(entry)), "package.json"));
    candidates.push(join9(dirname9(entry), "package.json"));
  }
  const home = typeof env.DSH_HOME === "string" && env.DSH_HOME.length > 0 ? env.DSH_HOME : join9(homeDir, ".dsh");
  const profiles = join9(home, "profiles");
  candidates.push(join9(profiles, "node_modules", "@deepseek-ai", "dsh-app-boot", "package.json"));
  let names = [];
  try {
    names = options.listProfiles?.(profiles) ?? defaultListProfiles(profiles);
  } catch {
    names = [];
  }
  for (const name2 of names) {
    candidates.push(join9(profiles, name2, "node_modules", "@deepseek-ai", "dsh-app-boot", "package.json"));
  }
  for (const path of candidates) {
    try {
      const version = versionOfManifest(readFile4(path));
      if (version !== "") return version;
    } catch {
    }
  }
  return "";
}
function defaultReadFile(path) {
  return process.getBuiltinModule("node:fs").readFileSync(path, "utf8");
}
function defaultHomeDir() {
  return process.getBuiltinModule("node:os").homedir();
}
function defaultListProfiles(profilesDir) {
  const fs = process.getBuiltinModule("node:fs");
  return fs.readdirSync(profilesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}
function defaultResolveAppBoot() {
  try {
    const require_ = process.getBuiltinModule("node:module").createRequire(import.meta.url);
    return require_.resolve("@deepseek-ai/dsh-app-boot");
  } catch {
    return void 0;
  }
}

// src/subscription-plans.ts
function canonicalModelKey(model) {
  if (typeof model !== "string") return "";
  let key = model.trim().toLowerCase();
  if (key === "") return "";
  for (let round = 0; round < 4; round += 1) {
    const next = key.replace(/-(?:vision|exp|experimental|latest|preview|beta|alpha)$/, "");
    const dated = next.replace(/-(?:19|20)\d{6}$/, "");
    const versioned = dated.replace(/^(.+)-v(\d+(?:\.\d+)?)$/, (whole, head) => head === "" ? whole : head);
    if (versioned === key) break;
    key = versioned;
  }
  return key;
}
var OPENCODE_MODEL_ALIASES = {
  // DeepSeek（官方价目表里 V4.1 Flash 与 V4 Pro 是两档；旧名仍按 Flash 计）
  "deepseek-v4.1-flash": "deepseek-v4.1-flash",
  "deepseek-v4-flash": "deepseek-v4.1-flash",
  "deepseek-flash": "deepseek-v4.1-flash",
  "deepseek-chat": "deepseek-v4.1-flash",
  "deepseek-reasoner": "deepseek-v4.1-flash",
  "deepseek-v4-pro": "deepseek-v4-pro",
  "deepseek-pro": "deepseek-v4-pro",
  "deepseek-reasoner-pro": "deepseek-v4-pro",
  // 其它常见 Coding 模型（价目表来自 Go 文档；没有峰谷）
  "glm-5.3-flash": "glm-5.3-flash",
  "glm-5.3": "glm-5.3",
  "glm-5.2": "glm-5.2",
  "kimi-k3": "kimi-k3",
  "kimi-k2.7-code": "kimi-k2.7-code",
  "minimax-m3": "minimax-m3",
  "longcat-2.0": "longcat-2.0",
  "qwen3.8-flash": "qwen3.8-flash",
  "qwen3.8-max": "qwen3.8-max",
  "qwen3.7-plus": "qwen3.7-plus",
  "mimo-v2.6-flash": "mimo-v2.6-flash",
  "mimo-v2.6-pro": "mimo-v2.6-pro",
  "grok-4.7": "grok-4.7",
  "gpt-6-luna": "gpt-6-luna",
  "gpt-5.6-luna": "gpt-5.6-luna",
  "claude-haiku-5.5": "claude-haiku-5-5"
};
var OPENCODE_GO_PLAN = {
  id: "opencode-go",
  displayName: "OpenCode Go",
  providers: ["opencode-go", "opencode", "go", "opencode-zen", "zen"],
  monthlyFeeUsd: 10,
  quotaPath: "/zen/go/v1/usage",
  quotaOrigin: "https://opencode.ai",
  models: {
    "deepseek-v4.1-flash": {
      peak: { miss: 0.3, hit: 6e-3, out: 1.2 },
      offPeak: { miss: 0.15, hit: 3e-3, out: 0.6 },
      monthlyLimitUsd: 80
    },
    "deepseek-v4-pro": {
      peak: { miss: 1.32, hit: 0.044, out: 3.96 },
      offPeak: { miss: 0.66, hit: 0.022, out: 1.98 },
      monthlyLimitUsd: 15
    },
    "glm-5.3-flash": { offPeak: { miss: 0.15, hit: 0.03, out: 0.5 }, monthlyLimitUsd: 60 },
    "glm-5.3": { offPeak: { miss: 1.4, hit: 0.26, out: 4.4 }, monthlyLimitUsd: 15 },
    "glm-5.2": { offPeak: { miss: 1.4, hit: 0.26, out: 4.4 }, monthlyLimitUsd: 60 },
    "kimi-k3": { offPeak: { miss: 3, hit: 0.3, out: 15 }, monthlyLimitUsd: 15 },
    "kimi-k2.7-code": { offPeak: { miss: 0.95, hit: 0.19, out: 4 }, monthlyLimitUsd: 60 },
    "minimax-m3": { offPeak: { miss: 0.3, hit: 0.06, out: 1.2 }, monthlyLimitUsd: 60 },
    "longcat-2.0": { offPeak: { miss: 0.3, hit: 6e-3, out: 1.2 }, monthlyLimitUsd: 60 },
    "qwen3.8-flash": { offPeak: { miss: 0.15, hit: 0.016, out: 0.47 }, monthlyLimitUsd: 30 },
    "qwen3.8-max": { offPeak: { miss: 2, hit: 0.25, out: 6 }, monthlyLimitUsd: 15 },
    "qwen3.7-plus": { offPeak: { miss: 0.4, hit: 0.04, out: 1.6 }, monthlyLimitUsd: 60 },
    "mimo-v2.6-flash": { offPeak: { miss: 0.14, hit: 28e-4, out: 0.28 }, monthlyLimitUsd: 60 },
    "mimo-v2.6-pro": { offPeak: { miss: 0.435, hit: 3625e-6, out: 0.87 }, monthlyLimitUsd: 15 },
    "grok-4.7": { offPeak: { miss: 2, hit: 0.5, out: 6 }, monthlyLimitUsd: 15 },
    "gpt-6-luna": { offPeak: { miss: 0.1, hit: 0.01, out: 0.5 }, monthlyLimitUsd: 15 },
    "gpt-5.6-luna": { offPeak: { miss: 0.2, hit: 0.02, out: 1.2 }, monthlyLimitUsd: 15 },
    "claude-haiku-5-5": { offPeak: { miss: 0.1, hit: 0.01, out: 0.5 }, monthlyLimitUsd: 15 }
  }
};
var SUBSCRIPTION_PLANS = [OPENCODE_GO_PLAN];
function canonicalProvider(provider) {
  return typeof provider === "string" ? provider.trim().toLowerCase() : "";
}
function planOf(provider) {
  const key = canonicalProvider(provider);
  if (key === "") return void 0;
  return SUBSCRIPTION_PLANS.find((plan) => plan.providers.includes(key));
}
function quotaCostOf(provider, model, peak, tokens) {
  const plan = planOf(provider);
  if (plan === void 0) return void 0;
  const key = canonicalModelKey(model);
  const alias = OPENCODE_MODEL_ALIASES[key];
  const priced = alias === void 0 ? plan.models[key] : plan.models[alias];
  if (priced === void 0) return void 0;
  const rate2 = peak && priced.peak !== void 0 ? priced.peak : priced.offPeak;
  const usd = tokens.miss / 1e6 * rate2.miss + tokens.hit / 1e6 * rate2.hit + tokens.out / 1e6 * rate2.out;
  const limit = priced.monthlyLimitUsd;
  return {
    modelKey: alias ?? key,
    usd,
    ...limit === void 0 ? {} : { monthlyLimitUsd: limit },
    ...limit === void 0 || limit <= 0 ? {} : { percentOfLimit: usd / limit * 100 }
  };
}
function parseQuotaPayload(body) {
  const root = body === null || typeof body !== "object" ? void 0 : body;
  const usage = root?.usage ?? body;
  if (usage === null || typeof usage !== "object") return [];
  const windows = [];
  for (const id of ["rolling", "weekly", "monthly"]) {
    const entry = usage[id];
    if (entry === null || typeof entry !== "object") continue;
    const percent2 = typeof entry.percent === "number" && Number.isFinite(entry.percent) ? Math.min(100, Math.max(0, entry.percent)) : void 0;
    if (percent2 === void 0) continue;
    windows.push({
      id,
      percent: percent2,
      resetsAt: typeof entry.resetsAt === "string" ? entry.resetsAt : ""
    });
  }
  return windows;
}
function degradeQuota(plan, previous, status, reason) {
  return {
    provider: plan.id,
    displayName: plan.displayName,
    status,
    windows: previous?.windows ?? [],
    fetchedAt: previous?.fetchedAt ?? 0,
    reason
  };
}

// src/usage-fold.ts
var UNKNOWN_ROUTE = "\u672A\u77E5";
function zeroBuckets() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}
function addBuckets(left, right) {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens
  };
}
function subBuckets(left, right) {
  return {
    inputTokens: left.inputTokens - right.inputTokens,
    outputTokens: left.outputTokens - right.outputTokens,
    cacheReadTokens: left.cacheReadTokens - right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens - right.cacheWriteTokens
  };
}
function sameBuckets(left, right) {
  return left.inputTokens === right.inputTokens && left.outputTokens === right.outputTokens && left.cacheReadTokens === right.cacheReadTokens && left.cacheWriteTokens === right.cacheWriteTokens;
}
function isZero(buckets) {
  return buckets.inputTokens === 0 && buckets.outputTokens === 0 && buckets.cacheReadTokens === 0 && buckets.cacheWriteTokens === 0;
}
function bucketTotal(buckets) {
  return buckets.inputTokens + buckets.outputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens;
}
function count(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function timeOf(event) {
  const time = event.time;
  return typeof time === "number" && Number.isFinite(time) ? time : Number.NaN;
}
function seqOf(event) {
  const seq = event.seq;
  return typeof seq === "number" && Number.isFinite(seq) ? seq : void 0;
}
function headerOf(event) {
  if (event.type !== "request/header") return void 0;
  const data = event.data;
  const config = data?.header?.config;
  if (config === void 0) return void 0;
  const provider = typeof config.provider === "string" && config.provider.length > 0 ? config.provider : UNKNOWN_ROUTE;
  const model = typeof config.model === "string" && config.model.length > 0 ? config.model : UNKNOWN_ROUTE;
  return { provider, model };
}
function catalogChildOf(event) {
  if (event.type !== "subagent/catalog") return void 0;
  const data = event.data;
  const childId = data?.childId;
  if (typeof childId !== "string" || childId === "") return void 0;
  return { sessionId: childId, external: data?.mode === "external" };
}
function lastUsageOf(stream) {
  if (!Array.isArray(stream)) return void 0;
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index];
    if (record?.type === "chunk" && record.chunk?.type === "usage") return record.chunk.usage;
  }
  return void 0;
}
function usageOf(event) {
  if (event.type !== "assistant/message" && event.type !== "assistant/attempt") return void 0;
  const data = event.data;
  if (data === void 0) return void 0;
  if (event.type === "assistant/message" && data.usage !== void 0) return data.usage;
  return lastUsageOf(data.stream);
}
function bucketsOf(usage) {
  const source = usage;
  if (source === void 0 || source === null || typeof source !== "object") return zeroBuckets();
  return {
    inputTokens: count(source.inputTokens),
    outputTokens: count(source.outputTokens),
    cacheReadTokens: count(source.cacheReadTokens),
    cacheWriteTokens: count(source.cacheWriteTokens)
  };
}
function createUsageFolder(tierAt) {
  const byRoute = /* @__PURE__ */ new Map();
  const children = /* @__PURE__ */ new Map();
  let provider = UNKNOWN_ROUTE;
  let model = UNKNOWN_ROUTE;
  let headerTime = Number.NaN;
  let last = null;
  let total = zeroBuckets();
  let tierPeak = zeroBuckets();
  let tierOffPeak = zeroBuckets();
  let events = 0;
  let samples = 0;
  let lastSeq;
  return {
    feed(batch) {
      for (const raw of batch) {
        if (typeof raw !== "object" || raw === null) continue;
        const event = raw;
        const seq = seqOf(event);
        if (seq !== void 0 && lastSeq !== void 0 && seq <= lastSeq) continue;
        if (seq !== void 0) lastSeq = seq;
        events += 1;
        const child = catalogChildOf(event);
        if (child !== void 0) {
          if (!children.has(child.sessionId)) children.set(child.sessionId, child.external);
          continue;
        }
        const header = headerOf(event);
        if (header !== void 0) {
          provider = header.provider;
          model = header.model;
          headerTime = timeOf(event);
          continue;
        }
        if (event.type === "llm/retry-started") {
          const data2 = event.data;
          if (last !== null && data2?.turn === last.turn && data2?.step === last.step) last = null;
          continue;
        }
        const usage = usageOf(event);
        if (usage === void 0) continue;
        const data = event.data;
        const buckets = bucketsOf(usage);
        samples += 1;
        const previous = last !== null && last.turn === data.turn && last.step === data.step ? last : void 0;
        if (previous !== void 0 && sameBuckets(previous.buckets, buckets)) continue;
        const delta = previous === void 0 ? buckets : subBuckets(buckets, previous.buckets);
        const tier = previous?.tier ?? tierAt(Number.isFinite(headerTime) ? headerTime : timeOf(event), provider, model);
        last = { turn: data.turn, step: data.step, buckets, tier };
        if (isZero(delta)) continue;
        const key = `${provider}\0${model}\0${tier.peak ? "peak" : "offPeak"}\0${tier.era}`;
        const row = byRoute.get(key) ?? { provider, model, peak: tier.peak, era: tier.era, usage: zeroBuckets() };
        row.usage = addBuckets(row.usage, delta);
        byRoute.set(key, row);
        total = addBuckets(total, delta);
        if (tier.peak) tierPeak = addBuckets(tierPeak, delta);
        else tierOffPeak = addBuckets(tierOffPeak, delta);
      }
    },
    snapshot() {
      const routes = [...byRoute.values()].filter((row) => !isZero(row.usage)).sort((left, right) => bucketTotal(right.usage) - bucketTotal(left.usage));
      return {
        total,
        tiers: { peak: tierPeak, offPeak: tierOffPeak },
        routes,
        children: [...children].map(([sessionId, external]) => ({ sessionId, external })),
        events,
        samples
      };
    }
  };
}
function createUsageCache(tierAt, options = {}) {
  const rows = /* @__PURE__ */ new Map();
  const maxSessions = options.maxSessions ?? 8;
  const trim = () => {
    while (rows.size > maxSessions) {
      const oldest = rows.keys().next().value;
      if (oldest === void 0) return;
      rows.delete(oldest);
    }
  };
  const seqOf2 = (event) => {
    const seq = event?.seq;
    return typeof seq === "number" && Number.isFinite(seq) ? seq : void 0;
  };
  const feedAll = (row, events) => {
    if (events.length === 0) return;
    row.folder.feed(events);
    for (const event of events) {
      const seq = seqOf2(event);
      if (seq !== void 0) row.lastSeq = seq;
    }
  };
  return {
    event(sessionId, event) {
      const row = rows.get(sessionId);
      if (row === void 0) return;
      if (row.seeding) {
        row.buffered.push(event);
        return;
      }
      feedAll(row, [event]);
    },
    clear() {
      rows.clear();
    },
    async sync(sessionId, liveSeq, read) {
      let row = rows.get(sessionId);
      const behind = row === void 0 || row.lastSeq === void 0 || liveSeq !== void 0 && liveSeq - 1 > row.lastSeq;
      if (!behind) return { fold: row.folder.snapshot(), source: "cache" };
      if (row === void 0) {
        row = { folder: createUsageFolder(tierAt), lastSeq: void 0, seeding: true, buffered: [] };
        rows.set(sessionId, row);
        trim();
      } else {
        row.seeding = true;
      }
      const seeding = row;
      let source = "cache";
      try {
        const events = await read();
        if (events.length > 0) {
          feedAll(seeding, events);
          source = "sessionQuery";
        }
      } catch {
      }
      seeding.seeding = false;
      const tail = seeding.buffered;
      seeding.buffered = [];
      if (tail.length > 0) {
        tail.sort((left, right) => (seqOf2(left) ?? 0) - (seqOf2(right) ?? 0));
        feedAll(seeding, tail);
      }
      return { fold: seeding.folder.snapshot(), source };
    }
  };
}

// src/terminal/host.ts
import { existsSync as existsSync2, readdirSync as readdirSync2 } from "node:fs";
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
function resolveWorkdir(modelWorkdir, exec, policyWorkspaceRoot, sep3, isAbsolute3) {
  const headerCwd = exec.agent?.session.header.cwd;
  const sessionCwd = policyWorkspaceRoot ?? headerCwd;
  if (modelWorkdir === void 0) return sessionCwd;
  if (sessionCwd !== void 0 && !isAbsolute3(modelWorkdir)) return `${sessionCwd}${sep3}${modelWorkdir}`;
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
  const sep3 = options.sep ?? "\\";
  const isAbsolute3 = options.isAbsolute ?? ((path) => /^([a-zA-Z]:[\\/]|[\\/])/.test(path));
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
    const workdir = resolveWorkdir(args.workdir, exec, standingPolicy?.workspaceRoot, sep3, isAbsolute3);
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

// src/retry-write.ts
async function retryWrite(write2, attempts, baseDelayMs) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await write2();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolve5) => setTimeout(resolve5, baseDelayMs * attempt));
    }
  }
}
var STARTUP_WRITE_ATTEMPTS = 4;
var STARTUP_WRITE_RETRY_MS = 300;

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
  const existsFn = options.exists ?? existsSync2;
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
        return readdirSync2(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
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
      await retryWrite(() => settings.mutate(namespace, ops), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS);
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
  const { node, argv1, execArgv, rest, cwd, platform } = facts;
  if (argv1 !== void 0 && argv1 !== "") {
    if (/\.(?:cmd|bat)$/iu.test(argv1)) {
      return { file: argv1, args: [...rest], cwd, viaShell: true };
    }
    return { file: node, args: [...execArgv, argv1, ...rest], cwd, viaShell: false };
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
var DSH_APP_ORIGIN = /^dsh-app:\/\//iu;
function explainRestartTrust(request) {
  const headers = request.headers;
  const origin = firstHeader2(headers.origin) ?? "";
  const host = firstHeader2(headers.host) ?? "";
  const peer = request.remoteAddress ?? "";
  const forwarded = firstHeader2(headers.forwarded) ?? firstHeader2(headers["x-forwarded-for"]) ?? firstHeader2(headers["x-forwarded-host"]) ?? firstHeader2(headers["x-real-ip"]) ?? "";
  const base = { peer, origin, host, forwarded };
  if (!isLoopbackAddress(request.remoteAddress)) return { ...base, reason: "peer-not-loopback" };
  if (forwarded !== "") return { ...base, reason: "forwarded-header" };
  if (origin === "" || origin === "null" || DSH_APP_ORIGIN.test(origin)) return { ...base, reason: "ok" };
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ...base, reason: "origin-unparsable" };
    if (parsed.host !== host) return { ...base, reason: "origin-host-mismatch" };
    if (!isLoopbackAddress(parsed.hostname)) return { ...base, reason: "origin-not-loopback" };
    return { ...base, reason: "ok" };
  } catch {
    return { ...base, reason: "origin-unparsable" };
  }
}
function restartTrustText(facts) {
  if (facts.reason === "ok") return "";
  const why = {
    "peer-not-loopback": "\u8BF7\u6C42\u4E0D\u662F\u4ECE\u672C\u673A\u56DE\u73AF\u5730\u5740\u6765\u7684",
    "forwarded-header": "\u8BF7\u6C42\u5E26\u7740\u8F6C\u53D1\u5934\uFF08\u4E2D\u95F4\u6709\u4EE3\u7406\uFF0C\u4E0D\u662F\u4F60\u7684\u6D4F\u89C8\u5668\u76F4\u8FDE\uFF09",
    "origin-unparsable": "Origin \u5934\u89E3\u6790\u4E0D\u51FA http/https \u6765\u6E90",
    "origin-host-mismatch": "Origin \u4E0E Host \u4E0D\u662F\u540C\u4E00\u4E2A\u6765\u6E90",
    "origin-not-loopback": "Origin \u6307\u5411\u7684\u4E0D\u662F\u672C\u673A\u5730\u5740"
  };
  const peer = facts.peer === "" ? "\u7A7A" : facts.peer;
  const origin = facts.origin === "" ? "\u7A7A" : facts.origin;
  const host = facts.host === "" ? "\u7A7A" : facts.host;
  const fwd = facts.forwarded === "" ? "\u65E0" : facts.forwarded;
  return why[facts.reason] + "\uFF08peer=" + peer + " \xB7 origin=" + origin + " \xB7 host=" + host + " \xB7 \u8F6C\u53D1\u5934=" + fwd + "\uFF09";
}
function firstHeader2(value) {
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
function desktopKindOf(input) {
  return input.env.ELECTRON_RUN_AS_NODE === "1" && /\.exe$/iu.test(input.execPath);
}
function restartHelperSource(input) {
  const { spawned, cwd, logs, port, desktop } = input;
  const desktopFacts = desktop === null || desktop === void 0 ? "null" : `{ shellPid: ${String(desktop.shellPid)}, hostPid: ${String(desktop.hostPid)}, appExe: ${JSON.stringify(desktop.appExe)} }`;
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
    `const desktop = ${desktopFacts}`,
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
    "const alive = (pid) => new Promise((resolve) => {",
    '  let out = ""',
    '  const probe = spawn("tasklist", ["/FI", "PID eq " + pid, "/FO", "CSV", "/NH"], { windowsHide: true })',
    '  probe.stdout.on("data", (chunk) => { out += String(chunk) })',
    '  probe.on("close", () => resolve(out.includes("\\"" + pid + "\\"")))',
    '  probe.on("error", () => resolve(false))',
    "})",
    "// \u684C\u9762\u5F62\u6001\uFF1A\u8FDE\u58F3\u4E00\u8D77\u6362\u6389 \u2014\u2014 \u58F3\u770B\u4E0D\u5230\u81EA\u5DF1\u5B50\u8FDB\u7A0B\u7684\u9000\u51FA\uFF0C\u5C31\u4E0D\u4F1A\u5F39\u6062\u590D\u6846\u3002",
    "const desktopMain = async () => {",
    '  const out = fs.openSync(logOut, "a")',
    '  const err = fs.openSync(logErr, "a")',
    "  // \u8D77\u98DE\u524D\u68C0\u67E5\uFF1A\u62FF\u4E0D\u5230\u5E94\u7528 exe \u5C31**\u7EDD\u4E0D\u6740\u58F3** \u2014\u2014 \u6740\u5B8C\u6CA1\u4EBA\u80FD\u628A\u5B83\u62C9\u56DE\u6765",
    "  //\uFF08\u53C2\u8003\u63D2\u4EF6 README \u91CC\u90A3\u6761 relaunch aborted: executable missing \u5C31\u662F\u8FD9\u4E2A\u6B7B\u6CD5\uFF09\u3002",
    "  if (!desktop.appExe || !fs.existsSync(desktop.appExe)) {",
    '    note("app executable missing (" + String(desktop.appExe) + "); falling back to host-only restart")',
    "    return main()",
    "  }",
    '  // \u53EA /PID\uFF1A/T \u4F1A\u628A"\u8D1F\u8D23\u91CD\u542F\u7684\u52A9\u624B\u81EA\u5DF1"\u4E00\u8D77\u5E26\u8D70\uFF08\u53C2\u8003\u63D2\u4EF6\u8E29\u8FC7\u7684\u5751\uFF09\u3002',
    "  try {",
    '    const killer = spawn("taskkill", ["/F", "/PID", String(desktop.shellPid)], { windowsHide: true, stdio: ["ignore", out, err] })',
    '    killer.on("error", (error) => note("could not kill the shell: " + (error && error.message ? error.message : String(error))))',
    "    killer.unref()",
    '  } catch (error) { note("could not kill the shell: " + String(error)) }',
    "  const until = Date.now() + portWaitMs",
    "  while (Date.now() < until && await alive(desktop.hostPid)) await sleep(pollMs)",
    '  if (await alive(desktop.hostPid)) note("the old host was still alive after " + portWaitMs + "ms; relaunching anyway")',
    "  await sleep(settleMs)",
    '  // \u5FC5\u987B\u5220\u6389 ELECTRON_RUN_AS_NODE\uFF1A\u7559\u7740\u5B83\u62C9\u8D77\u6765\u7684\u4F1A\u662F"\u53C8\u4E00\u4E2A node \u8FDB\u7A0B"\uFF0C\u4E0D\u662F\u5E94\u7528\u3002',
    "  const env = { ...process.env }",
    "  delete env.ELECTRON_RUN_AS_NODE",
    "  try {",
    '    const child = spawn(desktop.appExe, [], { detached: true, stdio: ["ignore", out, err], env, windowsHide: true })',
    '    child.on("error", (error) => note("could not relaunch the app: " + (error && error.message ? error.message : String(error))))',
    "    child.unref()",
    '  } catch (error) { note("could not relaunch the app: " + String(error)) }',
    "  await sleep(lingerMs)",
    "}",
    "if (desktop === null) main()",
    "else desktopMain()"
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
  const desktop = desktopKindOf({ env: io.env, execPath: io.execPath }) ? { shellPid: io.ppid, hostPid: io.pid, appExe: io.execPath } : null;
  const respawn = respawnCommand(launch, io.platform);
  const logOut = io.join(io.tmpdir, `${RESTART_LOG_PREFIX}${io.stamp}.out.log`);
  const logErr = io.join(io.tmpdir, `${RESTART_LOG_PREFIX}${io.stamp}.err.log`);
  return {
    node,
    launch,
    respawn,
    helper: restartHelperSource({ spawned: respawn, cwd: launch.cwd, logs: { out: logOut, err: logErr }, port, desktop }),
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

// src/optimizer-transplant.ts
var UPSTREAM_MISSION = [
  "\u3010\u6700\u91CD\u8981\u7684\u4E00\u6761\u3011\u7528\u6237\u539F\u8BDD\u4F1A\u88AB\u539F\u6837\u4FDD\u7559\u3002\u4F60\u4E0D\u6539\u5199\u5B83\uFF0C\u4F60\u53EA\u8865\u5B83\u6CA1\u8BF4\u7684\u3001\u800C\u5DE5\u4F5C AI \u65E0\u6CD5\u81EA\u77E5\u7684\u4E1C\u897F\u3002"
].join("\n");
var UPSTREAM_RULES = [
  "\u3010\u786C\u89C4\u5219\uFF08\u5BBF\u4E3B\u9010\u6761\u673A\u68B0\u6838\u5BF9\uFF1A\u5199\u9519\u5C31\u4E22\u90A3\u4E00\u6761\uFF0C\u4E0D\u4F1A\u62A5\u9519\u7ED9\u4F60\u3001\u4E5F\u6CA1\u4EBA\u63D0\u9192\u4F60\uFF09\u3011",
  "1. \u53EA\u6709\u7528\u6237**\u660E\u8BF4**\u7684\u624D\u7B97 user_requirement\u3002\u4E3A\u5B83\u5EFA\u6761\u76EE\u65F6\uFF0C\u5FC5\u987B\u9644 quote \u2014\u2014 \u4E00\u6BB5\u5728\u7528\u6237\u539F\u8BDD\u91CC",
  "   **\u9010\u5B57\u5B58\u5728**\u7684\u5B50\u4E32\uFF08\u7167\u6284\uFF0C\u4E0D\u8981\u6539\u5199\u3001\u4E0D\u8981\u8865\u6807\u70B9\uFF09\u3002\u5BBF\u4E3B\u4F1A\u505A\u5B57\u9762\u6BD4\u5BF9\uFF0C\u5BF9\u4E0D\u4E0A\u5C31\u6574\u6761\u4F5C\u5E9F\u3002",
  "   \u4F60\u53EF\u4EE5\u628A\u4E00\u53E5\u8BDD\u62C6\u6210\u591A\u6761\u539F\u5B50\u8981\u6C42\uFF0C\u6BCF\u6761\u5404\u81EA\u5F15\u7528\u539F\u8BDD\u7684\u4E00\u6BB5\u3002",
  '2. \u7528\u6237\u8868\u8FBE\u7684\u8D28\u91CF\u76EE\u6807\uFF08"\u7CBE\u7EC6""\u771F\u5B9E""\u5E05\u6C14""\u9AD8\u7EA7\u611F"\u8FD9\u7C7B\uFF09\u2192 \u5199\u6210 quality_interpretation\uFF0C',
  "   \u5E76\u5728 rationale \u91CC\u6307\u51FA\u5B83\u6765\u81EA\u539F\u8BDD\u7684\u54EA\u51E0\u4E2A\u5B57\u3002**\u4E0D\u8981**\u628A\u5B83\u5199\u6210 user_requirement\u3002",
  '   **\u8D28\u91CF\u89E3\u91CA\u662F"\u7ED3\u679C\u65B9\u5411"\uFF0C\u4E0D\u662F"\u5236\u4F5C\u6E05\u5355"**\uFF1A\u4E00\u6761\u53EA\u8BF4"\u6700\u7EC8\u8981\u770B\u8D77\u6765/\u7528\u8D77\u6765\u600E\u6837"\uFF0C\u4E0D\u8981\u628A\u96F6\u4EF6\u3001',
  "   \u53C2\u6570\u3001\u6750\u8D28\u3001\u540E\u671F\u6548\u679C\u6216\u5B9E\u73B0\u624B\u6BB5\u9010\u9879\u5217\u6210\u6E05\u5355\u2014\u2014\u90A3\u662F\u5DE5\u4F5C AI \u7684\u6D3B\u3002\u7ED9\u4E00\u4E2A\u793A\u4F8B\u5C31\u591F\uFF0C",
  "   \u4E14\u793A\u4F8B\u4E0D\u662F\u9A8C\u6536\u9879\uFF1B\u540C\u4E00\u65B9\u5411\u4E0D\u62C6\u6210\u591A\u6761\u3002",
  '3. \u4E0D\u5F97\u65B0\u589E\u4EA7\u54C1\u76EE\u6807\u3001\u529F\u80FD\u6216\u786C\u7EA6\u675F\uFF08\u4F8B\u5982"\u5FC5\u987B\u79BB\u7EBF""\u7981\u6B62\u8054\u7F51""\u53EA\u80FD\u7528\u67D0\u4E2A\u5E93""\u5FC5\u987B\u652F\u6301\u79FB\u52A8\u7AEF"\uFF09\u3002',
  "   \u4F60\u89C9\u5F97\u6709\u4EF7\u503C\u7684\u4E1C\u897F\u5199\u6210 proposal\uFF0C\u5E76\u63A5\u53D7\u5B83\u53EF\u80FD\u4E0D\u88AB\u91C7\u7EB3\u3002",
  "   **\u53EF\u9006\u7684\u5B9E\u73B0\u9ED8\u8BA4\u5199 implementation_option**\uFF1A\u7528\u6237\u6CA1\u6307\u5B9A\u3001\u4F46\u9009\u4E86\u4E5F**\u4E0D\u6539\u53D8\u4EA4\u4ED8\u65B9\u5411**\u3001",
  '   \u4E14\u968F\u65F6\u80FD\u6362\u7684\u7EC6\u8282\uFF08\u5916\u5F62\u8BED\u8A00\u3001\u9ED8\u8BA4\u673A\u4F4D\u3001\u5185\u90E8\u6587\u4EF6\u7EC4\u7EC7\u3001\u547D\u540D\uFF09\u653E\u8FD9\u91CC\uFF0C\u5E76\u8BF4\u660E"\u9ED8\u8BA4\u53D6\u4EC0\u4E48\u3001',
  '   \u4E3A\u4EC0\u4E48\u53EF\u9006"\u3002\u5B83**\u4E0D\u662F**\u7528\u6237\u8981\u6C42\uFF0C\u5DE5\u4F5C AI \u53EF\u81EA\u884C\u8C03\u6574\u3002\u533A\u522B\u5728\u4E8E\uFF1A\u53EF\u9006\u7EC6\u8282 \u2192',
  "   implementation_option\uFF1B**\u4E0D\u53EF\u9006\u7684\u4EA7\u54C1\u65B9\u5411**\uFF08\u8054\u7F51\u4E0E\u5426\u3001\u4EA4\u4ED8\u5F62\u5F0F\u3001\u529F\u80FD\u8303\u56F4\u3001\u5BA1\u7F8E\u53D6\u820D\uFF09",
  "   \u2192 \u53EA\u80FD\u5199 unknown\uFF0C\u4E0D\u8BB8\u5199\u6210\u9ED8\u8BA4\u3002",
  '4. \u4F60\u81EA\u5DF1\u4E0D\u786E\u5B9A\u3001\u4E14\u4F1A\u5F71\u54CD\u7ED3\u679C\u7684\u9009\u62E9 \u2192 \u5199\u6210 unknown\uFF0C\u4E0D\u8981\u66FF\u7528\u6237\u731C\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6309\u6700\u4FDD\u5B88\u7406\u89E3\u6267\u884C"\u3002',
  "   unknown \u5FC5\u987B\u5E26 unknownClass\uFF0C\u53D6\u503C\u53EA\u80FD\u662F\u8FD9\u4E09\u79CD\u4E4B\u4E00\uFF1A",
  '     \xB7 "user_preference"     \u2014\u2014 \u53EA\u6709\u7528\u6237\u80FD\u5B9A\u7684\u53D6\u820D\uFF08\u4F1A\u6539\u53D8\u7ED3\u679C\uFF09\u3002\u8FD9\u4E00\u7C7B\u624D\u53EF\u80FD\u88AB\u62FF\u53BB\u95EE\u7528\u6237\u3002',
  '     \xB7 "lookupable_fact"     \u2014\u2014 \u5728\u8BB8\u53EF\u8303\u56F4\u5185\u8BFB\u6587\u4EF6/\u67E5\u4EE3\u7801\u5C31\u80FD\u786E\u5B9A\u7684\u4E8B\u5B9E\u3002**\u4E0D\u8981**\u628A\u8FD9\u7C7B\u4E22\u56DE\u7528\u6237\u3002',
  '     \xB7 "implementation_detail" \u2014\u2014 \u53EF\u9006\u7684\u5B9E\u73B0\u7EC6\u8282\uFF08\u95F4\u8DDD\u3001\u547D\u540D\u3001\u5E93\u7684\u5185\u90E8\u7528\u6CD5\uFF09\u3002\u4EA4\u7ED9\u5DE5\u4F5C AI \u81EA\u5DF1\u5B9A\u3002',
  "   \u82E5\u8FD9\u6761\u672A\u77E5\u4F1A\u6321\u4F4F\u4E0B\u4E00\u6B65\uFF0C\u989D\u5916\u52A0 blocking: true\uFF1B\u786E\u5B9A\u4E0D\u5F71\u54CD\u4E0B\u4E00\u6B65\u5C31\u5199 false\u3002",
  "   \u540C\u4E00\u53E5\u8BDD\u6709\u51E0\u79CD\u8BF4\u5F97\u901A\u7684\u8BFB\u6CD5\u65F6\uFF0C\u53EF\u4EE5\u7ED9 candidates\uFF08\u6700\u591A 3 \u4E2A\uFF0C\u53EA\u5141\u8BB8\u7528\u5728 user_preference \u4E0A\uFF09\uFF1A",
  '   \u5B83\u662F"\u51E0\u79CD\u8BFB\u6CD5"\uFF0C**\u4E0D\u662F\u65B0\u589E\u8981\u6C42\u3001\u4E5F\u4E0D\u6784\u6210\u6388\u6743**\u2014\u2014\u4E0D\u8981\u62FF\u5B83\u63A8\u9500\u4F60\u89C9\u5F97\u597D\u7684\u65B9\u6848\u3002',
  "5. \u53EA\u6709\u4F60**\u8FD9\u6B21\u786E\u5B9E\u8BFB\u5230**\u7684\u9879\u76EE\u4E8B\u5B9E\u624D\u5199\u6210 observed_fact\uFF0C\u5E76\u7ED9\u51FA sourceRefs\uFF08\u4F60\u8BFB\u8FC7\u7684\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002",
  "   \u6CA1\u8BFB\u5230\u5C31\u4E0D\u8981\u5199\u4E8B\u5B9E\uFF1B\u53EA\u5217\u8FC7\u76EE\u5F55\u4E0D\u7B97\u77E5\u9053\u5185\u5BB9\u3002",
  "6. \u4E0E\u672C\u6B21\u8BF7\u6C42\u65E0\u5173\u7684\u5185\u5BB9\u4E0D\u8981\u8F93\u51FA\u3002\u4E0D\u8981\u5199\u6D41\u7A0B\u4EEA\u5F0F\u3001\u901A\u7528\u6559\u5B66\u3001\u9A8C\u6536\u5957\u8BDD\u3002",
  "7. **\u8F6E\u6B21\u4E4B\u95F4\u4E0D\u9057\u4F20**\uFF1A\u4E0A\u4E00\u8F6E\u7684\u76EE\u6807**\u4E0D\u4F1A**\u5E26\u8FDB\u8FD9\u4E00\u8F6E\uFF0C\u6240\u4EE5\u4F60**\u4E0D\u8981**\u5199\u300C\u5EF6\u7EED\u4E0A\u4E00\u8F6E\u300D\u3001",
  "    \u300C\u4E4B\u524D\u63D0\u8FC7\u7684\u8FD8\u8981\u7EE7\u7EED\u300D\u8FD9\u7C7B\u8BDD\uFF0C\u4E5F\u4E0D\u8981\u5047\u8BBE\u81EA\u5DF1\u770B\u8FC7\u4E0A\u4E00\u8F6E\u7684\u4EA7\u7269\u2014\u2014**\u628A\u8FD9\u4E00\u8F6E\u8BE5\u6709\u7684\u76EE\u6807",
  "   \u91CD\u65B0\u8BF4\u6E05\u695A**\u3002\uFF08\u5DEE\u5F02\uFF1A\u4E0A\u6E38\u5728\u8FD9\u91CC\u8FD8\u6709 set_item_status \u9500\u8D26\u52A8\u4F5C\uFF1B\u6211\u4EEC\u6BCF\u4E00\u8F6E\u72EC\u7ACB\u4EA7\u51FA\uFF0C\u6CA1\u6709\u9500\u8D26\u3002\uFF09",
  "8. \u4F60\u7684\u4EA7\u7269**\u53EA\u4F5C\u7528\u4E8E\u8FD9\u4E00\u8F6E**\u3002\u8DE8\u8F6E\u7684\u957F\u671F\u8BB0\u5FC6\u7531\u4F1A\u8BDD\u672C\u8EAB\u627F\u62C5\uFF08\u5DE5\u4F5C AI \u770B\u5F97\u5230\u5B8C\u6574\u5BF9\u8BDD\uFF09\uFF0C",
  "   \u4F60\u4E0D\u9700\u8981\u3001\u4E5F\u4E0D\u8981\u8BD5\u56FE\u5728\u8FD9\u91CC\u7EF4\u62A4\u957F\u671F\u72B6\u6001\u3002"
].join("\n");
var UPSTREAM_STYLE = [
  '\u3010\u5199 text \u7684\u7EAA\u5F8B\u3011\u4F60\u7684 text \u4F1A\u88AB\u5BBF\u4E3B\u62FC\u8FDB\u6700\u7EC8\u547D\u4EE4\uFF0C\u8BFB\u8005\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\uFF1A',
  "- \u7948\u4F7F\u53E5\u3001\u76F4\u7ED9\u8981\u6C42\u3001\u53EF\u6267\u884C\uFF1B\u4E2D\u6587\u8FDB\u4E2D\u6587\u51FA\u3002",
  '- \u4E0D\u8981\u5143\u8BDD\u8BED\u4E0E\u5143\u6807\u9898\uFF08"\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD""\u6539\u5199\u540E""\u8BF4\u660E""\u4EE5\u4E0B\u662F\u2026"\uFF09\u3002',
  '- \u4E0D\u8981\u63D0\u5230"\u7528\u6237/\u539F\u6587/\u4E0A\u9762\u7684\u8BDD"\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6211\u6765\u5E2E\u4F60\u2026"\u3002',
  '- \u4E0D\u8981\u5199\u6D41\u7A0B\u4EEA\u5F0F\u3001\u901A\u7528\u6559\u5B66\u3001\u9A8C\u6536\u5957\u8BDD\uFF08"\u8BF7\u786E\u4FDD\u4EE3\u7801\u8D28\u91CF"\u8FD9\u79CD\u6CA1\u6709\u6307\u5411\u7684\u8BDD\uFF09\u3002',
  '- user_requirement \u7684 text \u662F"\u5BF9\u5DE5\u4F5C AI \u7684\u8981\u6C42"\uFF0C\u4E0D\u662F\u5BF9\u7528\u6237\u8BF4\u7684\u8BDD\u3002'
].join("\n");
var TIER_STRATEGY_BLOCKS = Object.freeze({
  light: [
    "\u3010\u672C\u8F6E\u7B56\u7565\uFF1A\u8F7B\u5EA6 \u2014\u2014 \u5355\u4E00\u89E3\u8BFB\u3011",
    "\xB7 \u89E3\u8BFB\u6A21\u5F0F\uFF1A\u5355\u4E00\u89E3\u8BFB\uFF08single\uFF09\u2014\u2014\u53EA\u7ED9\u4E00\u79CD\u8BF4\u5F97\u901A\u7684\u8BFB\u6CD5\uFF0C\u4E0D\u8981\u94FA\u5F00\u5E76\u5217\u5047\u8BBE\u3002",
    "\xB7 \u5019\u9009\uFF1A0 \u4E2A\uFF08\u4E0D\u8981\u7ED9 candidates\uFF09\u3002",
    "\xB7 \u6700\u591A 4 \u6761\u6761\u76EE\uFF08\u77ED\u539F\u8BDD\u4E0D\u8BB8\u81A8\u80C0\uFF09\u3002",
    "\xB7 \u8D28\u91CF\u7EF4\u5EA6\uFF1A\u53EF\u4EE5\u63D0\u4E00\u4E0B\u8BE5\u9886\u57DF\u7684\u68C0\u67E5\u89D2\u5EA6\uFF08refer\uFF09\uFF0C\u4F46\u4E0D\u5FC5\u9010\u6761\u843D\u5230\u7EF4\u5EA6\u4E0A\u3002",
    "\xB7 \u601D\u8003\u6DF1\u5EA6\uFF1A\u7B80\u77ED\uFF08brief\uFF09\u2014\u2014\u8FD9\u7C7B\u8BF7\u6C42\u4E0D\u9700\u8981\u957F\u7BC7\u63A8\u6F14\u3002"
  ].join("\n"),
  standard: [
    "\u3010\u672C\u8F6E\u7B56\u7565\uFF1A\u6807\u51C6 \u2014\u2014 \u6761\u76EE\u5185\u5E76\u5217\u3011",
    "\xB7 \u89E3\u8BFB\u6A21\u5F0F\uFF1A\u6761\u76EE\u5185\u5E76\u5217\uFF08parallel\uFF09\u2014\u2014\u540C\u4E00\u4EF6\u4E8B\u53EF\u4EE5\u62C6\u6210\u51E0\u6761\u5E76\u5217\u7684\u539F\u5B50\u8981\u6C42\uFF0C\u4F46\u4E0D\u8981\u9020\u5206\u652F\u5047\u8BBE\u3002",
    "\xB7 \u5019\u9009\uFF1A0 \u4E2A\uFF08\u4E0D\u8981\u7ED9 candidates\uFF09\u3002",
    "\xB7 \u6700\u591A 8 \u6761\u6761\u76EE\u3002",
    "\xB7 \u8D28\u91CF\u7EF4\u5EA6\uFF1A\u5BF9\u7528\u6237\u7684\u8D28\u91CF\u8BCD\uFF0C**\u81F3\u5C11\u843D\u5230 1 \u4E2A\u8BE5\u9886\u57DF\u53EF\u68C0\u7684\u7EF4\u5EA6**\u4E0A\uFF08one\uFF09\u3002",
    "\xB7 \u601D\u8003\u6DF1\u5EA6\uFF1A\u6B63\u5E38\uFF08normal\uFF09\u3002"
  ].join("\n"),
  heavy: [
    "\u3010\u672C\u8F6E\u7B56\u7565\uFF1A\u91CD\u5EA6 \u2014\u2014 \u663E\u5F0F\u591A\u5047\u8BBE\u5206\u652F\u3011",
    "\xB7 \u89E3\u8BFB\u6A21\u5F0F\uFF1A\u663E\u5F0F\u591A\u5047\u8BBE\u5206\u652F\uFF08branching\uFF09\u2014\u2014\u540C\u4E00\u53E5\u8BDD\u6709\u51E0\u79CD\u8BF4\u5F97\u901A\u7684\u8BFB\u6CD5\u65F6\uFF0C\u660E\u786E\u8BF4\u51FA\u6765\u3002",
    "\xB7 \u5019\u9009\uFF1A\u6700\u591A 3 \u4E2A\uFF08\u53EA\u7528\u4E8E unknown + user_preference\uFF1B\u6BCF\u4E2A text \u2264200 \u5B57\uFF09\u3002",
    "\xB7 \u6700\u591A 12 \u6761\u6761\u76EE\u3002",
    "\xB7 \u8D28\u91CF\u7EF4\u5EA6\uFF1A**\u81F3\u5C11\u843D\u5230 2 \u4E2A\u8BE5\u9886\u57DF\u53EF\u68C0\u7684\u7EF4\u5EA6**\u4E0A\uFF08two\uFF09\u3002",
    "\xB7 \u601D\u8003\u6DF1\u5EA6\uFF1A\u6DF1\uFF08deep\uFF09\u2014\u2014\u8FD9\u4E00\u6B65\u503C\u5F97\u591A\u63A8\u6F14\u4E00\u5C42\uFF0C\u4F46\u4E0D\u8BBE\u8F93\u51FA\u4E0A\u9650\u3002"
  ].join("\n")
});
var HARD_TONE_BLOCK = [
  "\u3010\u786C\u90A6\u90A6\u6A21\u5F0F \xB7 \u6574\u4EFD\u8F85\u52A9\u5305\u7684\u5199\u6CD5\uFF08\u672C\u8F6E\u534F\u4F5C\u57FA\u8C03 = \u786C\u90A6\u90A6\uFF09\u3011",
  "\u8FD9\u4E00\u8F6E**\u6574\u4EFD\u8F85\u52A9\u4E0A\u4E0B\u6587\u90FD\u7528\u8FD9\u4E2A\u53E3\u6C14\u5199**\uFF0C\u4E0D\u662F\u53EA\u5728\u6700\u540E\u52A0\u4E00\u53E5\u53E3\u53F7\u3002\u8BFB\u8005\u662F\u5DE5\u4F5C AI\uFF1B",
  '\u8BED\u57DF\u672C\u8EAB\u5C31\u662F\u6548\u679C\u6765\u6E90\uFF08\u6B63\u5F0F\u8BED\u57DF\u4F1A\u628A\u6574\u5305\u5E26\u56DE"\u4E13\u4E1A\u52A9\u624B"\u90A3\u4E00\u7C07\uFF0C\u7B49\u4E8E\u767D\u5F00\u8FD9\u4E00\u6863\uFF09\u3002',
  "",
  "**\u8981\u5199\u6210\u786C\u90A6\u90A6\u7684**\uFF1A\u89E3\u91CA\u7528\u6237\u539F\u8BDD\u3001\u8D28\u91CF\u9610\u8FF0\u3001\u5B9E\u73B0\u9009\u9879\u3001\u5EFA\u8BAE\u2014\u2014\u90FD\u7528\u53E3\u8BED\u3001\u76F4\u7ED9\u3001\u5E26\u52B2\u7684\u5199\u6CD5\u3002",
  '\u5141\u8BB8"\u8D3C\u62C9\u725B\u903C""\u786C\u90A6\u90A6""\u522B\u6574\u90A3\u4E9B\u865A\u7684""\u7ED9\u6211\u5F80\u731B\u4E86\u9020"\u8FD9\u7C7B\u53E3\u6C34\u8BDD\uFF08\u5B83\u4EEC\u4E0D\u662F\u810F\u8BDD\uFF0C\u662F\u8BED\u57DF\uFF09\u3002',
  "\u8981\u63A5\u5730\u6C14\uFF1A\u50CF\u5144\u5F1F\u50AC\u4F60\u5E72\u6D3B\uFF0C\u4E0D\u50CF\u7532\u65B9\u53D1\u9700\u6C42\u6587\u6863\u3002",
  "",
  "**\u5FC5\u987B\u4FDD\u6301\u5B57\u9762\u3001\u4E0D\u52A0\u4FEE\u8F9E\u7684**\uFF08\u4E00\u4FEE\u8F9E\u5C31\u6F0F\u8BED\u4E49\uFF0C\u4EE3\u4EF7\u6BD4\u6536\u76CA\u5927\uFF09\uFF1A",
  "  \xB7 **\u672A\u51B3\u9879**\uFF1A\u6CA1\u62CD\u677F\u7684\u4E8B\u8981\u8BF4\u6E05\u695A\u8BF4\u51C6\uFF08\u8C01\u6765\u62CD\u677F\u3001\u5F71\u54CD\u4EC0\u4E48\uFF09\uFF0C\u4E0D\u8BB8\u7528\u53E3\u6C14\u8BCD\u7CCA\u8FC7\u53BB\uFF1B",
  '  \xB7 **\u9632\u5FA1\u6027\u9650\u5236**\uFF1A\u4E0D\u8BB8\u505A\u4EC0\u4E48\u3001\u8303\u56F4\u8FB9\u754C\u3001\u5B89\u5168\u4E0E\u6388\u6743\u7C7B\u8981\u6C42\uFF08\u5982"\u4E0D\u8BB8\u8BFB\u5176\u5B83\u6587\u4EF6""\u4E0D\u8BB8\u66FF\u6211\u62CD\u677F"\uFF09',
  "    \u7167\u5B57\u9762\u5199\uFF0C\u522B\u6539\u6210\u987A\u53E3\u6E9C\u3002",
  "",
  "**\u4E0D\u8BB8\u56E0\u4E3A\u53E3\u6C14\u53D8\u4E86\u800C\u6539\u52A8\u5185\u5BB9**\uFF1A",
  '  \xB7 \u6761\u76EE\u96C6\u5408\u4E00\u4E2A\u5B57\u90FD\u4E0D\u8BB8\u589E\u51CF\u2014\u2014\u53E3\u8BED\u5316\u53EA\u6539**\u5199\u6CD5**\uFF0C\u4E0D\u6539"\u8BE5\u6709\u54EA\u4E9B\u8981\u6C42"\uFF1B',
  "  \xB7 \u6BCF\u6761\u4ECD\u7136\u5FC5\u987B\u5E26\u9010\u5B57\u4F9D\u636E\uFF08\u6765\u6E90\u89C4\u5219\u4E0D\u53D8\uFF09\uFF1B",
  "  \xB7 \u4E0D\u8BB8\u65B0\u589E\u539F\u8BDD\u91CC\u6CA1\u6709\u7684\u9700\u6C42\uFF08\u578B\u53F7\u3001\u8054\u7F51\u3001\u52A0\u529F\u80FD\u3001\u6539\u4EA4\u4ED8\u5F62\u6001\u7B49\uFF09\u3002"
].join("\n");
var DOMAIN_QUALITY_BLOCK = [
  "\u3010\u9886\u57DF\u8D28\u91CF\u7EF4\u5EA6\uFF08\u8D28\u91CF\u8BCD\u843D\u5230\u53EF\u68C0\u7684\u5730\u65B9\uFF09\u3011",
  "\u9886\u57DF\u53EA\u80FD\u4ECE**\u4E0A\u4E0B\u6587\u91CC\u8BFB\u5230\u7684\u7EBF\u7D22**\u63A8\u65AD\uFF08\u6587\u4EF6\u540E\u7F00\u3001\u76EE\u5F55\u540D\u3001\u539F\u8BDD\u91CC\u7684\u540D\u8BCD\uFF09\uFF0C**\u4E0D\u8BB8\u51ED\u7A7A\u8BA4\u9886**\uFF1B",
  "\u63A8\u4E0D\u51FA\u5C31\u628A\u9886\u57DF\u672C\u8EAB\u5199\u6210 unknown\uFF0C\u800C\u4E0D\u662F\u786C\u5957\u4E00\u4E2A\u3002",
  "",
  "\xB7 ui   \uFF1A\u95F4\u8DDD\u4E0E\u5C42\u7EA7 / \u914D\u8272\u4E0E\u5BF9\u6BD4\u5EA6\uFF08\u542B\u6D45\u6DF1\u4E24\u5957\uFF09/ \u72B6\u6001\u53CD\u9988\uFF08\u60AC\u505C\xB7\u6309\u4E0B\xB7\u7981\u7528\xB7\u52A0\u8F7D\uFF09/ \u52A8\u6548\u65F6\u957F\u4E0E\u7F13\u52A8 / \u7A7A\u6001\u4E0E\u9519\u8BEF\u6001 / \u53EF\u8BFB\u6027\uFF08\u5B57\u53F7\xB7\u884C\u9AD8\xB7\u884C\u957F\uFF09",
  "\xB7 cli  \uFF1A\u9519\u8BEF\u4FE1\u606F\u7684\u53EF\u64CD\u4F5C\u6027 / \u53C2\u6570\u4E0E\u8F93\u51FA\u7684\u4E00\u81F4\u6027 / \u9000\u51FA\u7801\u8BED\u4E49 / \u5E2E\u52A9\u6587\u672C\u7684\u5B8C\u6574\u6027 / \u5E42\u7B49\u4E0E\u91CD\u590D\u6267\u884C\u5B89\u5168",
  "\xB7 doc  \uFF1A\u7ED3\u6784\u4E0E\u68C0\u7D22\u8DEF\u5F84 / \u672F\u8BED\u4E00\u81F4\u6027 / \u8BFB\u8005\u5B9A\u4F4D\u4E0E\u524D\u7F6E\u6761\u4EF6 / \u53EF\u590D\u6838\u7684\u5F15\u7528\u4E0E\u547D\u4EE4",
  "\xB7 data \uFF1A\u53E3\u5F84\u4E0E\u5355\u4F4D / \u7F3A\u5931\u503C\u4E0E\u5F02\u5E38\u503C\u5904\u7406 / \u53EF\u590D\u73B0\u7684\u67E5\u8BE2\u6B65\u9AA4 / \u7ED3\u679C\u6821\u9A8C\u65B9\u5F0F",
  "\xB7 code \uFF1A\u547D\u540D\u4E0E\u8FB9\u754C / \u9519\u8BEF\u5904\u7406\u4E0E\u5931\u8D25\u8DEF\u5F84 / \u53EF\u6D4B\u8BD5\u6027 / \u4F9D\u8D56\u4E0E\u517C\u5BB9\u9762 / \u6027\u80FD\u4E0E\u8D44\u6E90\u4E0A\u754C",
  "\xB7 game \uFF1A\u624B\u611F\u4E0E\u8282\u594F / \u89C6\u89C9\u53CD\u9988\u4E0E\u63D0\u793A / \u6570\u503C\u4E0E\u96BE\u5EA6\u66F2\u7EBF / \u5931\u8D25\u4E0E\u91CD\u8BD5\u6210\u672C",
  "",
  "\u26A0\uFE0F \u4E24\u6761\u4E0D\u8BB8\u8D8A\u7684\u7EBF\uFF1A\u2460 \u7EF4\u5EA6\u662F**\u600E\u4E48\u68C0\u67E5**\u7684\u5EFA\u8BAE\uFF0C\u4E0D\u662F\u65B0\u589E\u9700\u6C42 \u2014\u2014 \u5B83\u5C5E\u4E8E quality_interpretation\uFF0C",
  "\u4E0D\u5192\u5145\u7528\u6237\u8981\u6C42\uFF1B\u2461 \u9886\u57DF\u63A8\u4E0D\u51FA\u6765\u5C31\u5199 unknown\uFF0C\u522B\u786C\u5957\u3002"
].join("\n");
var OPTIMIZER_OUTPUT_CONTRACT_V2 = [
  "\u3010\u8F93\u51FA\u5951\u7EA6\uFF08\u56FA\u5B9A\uFF0C\u4E0D\u53EF\u66F4\u6539\uFF09\u3011",
  "\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\u3001\u4E0D\u8981\u5728 JSON \u524D\u540E\u5199\u4EFB\u4F55\u5B57\uFF1A",
  '{"items":[{"kind":"user_requirement","quote":"\u539F\u8BDD\u91CC\u9010\u5B57\u5B58\u5728\u7684\u7247\u6BB5","text":"\u5BF9\u5DE5\u4F5C AI \u7684\u8981\u6C42"}]}',
  "`kind` \u53EA\u80FD\u662F\u8FD9\u516D\u79CD\uFF0C\u5404\u81EA\u7684\u5FC5\u586B\u5B57\u6BB5\u5982\u4E0B\uFF08\u7F3A\u4E86\u6216\u5BF9\u4E0D\u4E0A\uFF0C\u5BBF\u4E3B\u53EA\u4E22\u90A3\u4E00\u6761\u5E76\u8BB0\u8D26\uFF09\uFF1A",
  "- user_requirement\uFF1A\u7528\u6237\u660E\u8BF4\u7684\u8981\u6C42\u3002`quote` **\u5FC5\u586B**\uFF0C\u4E14\u5FC5\u987B\u662F\u539F\u8BDD\u91CC\u7684\u9010\u5B57\u5B50\u4E32\u3002",
  "- quality_interpretation\uFF1A\u8D28\u91CF\u8BCD\u600E\u4E48\u7406\u89E3\u3002`rationale` **\u5FC5\u586B**\uFF08\u6307\u51FA\u5B83\u6765\u81EA\u539F\u8BDD\u54EA\u51E0\u4E2A\u5B57\uFF09\u3002",
  "- observed_fact\uFF1A\u4F60**\u8FD9\u6B21\u786E\u5B9E\u8BFB\u5230**\u7684\u9879\u76EE\u4E8B\u5B9E\u3002`sourceRefs` **\u5FC5\u586B**\uFF08\u4F60\u8BFB\u8FC7\u7684\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002",
  "- implementation_option\uFF1A\u53EF\u9006\u7684\u5B9E\u73B0\u7EC6\u8282\uFF08\u9ED8\u8BA4\u53D6\u4EC0\u4E48 + \u4E3A\u4EC0\u4E48\u53EF\u9006\uFF09\u3002\u4E0D\u9700\u8981\u5F15\u6587\u3002",
  "- proposal\uFF1A\u5EFA\u8BAE\uFF08\u53EF\u80FD\u4E0D\u88AB\u91C7\u7EB3\uFF09\u3002\u4E0D\u9700\u8981\u5F15\u6587\u3002",
  "- unknown\uFF1A\u672A\u51B3\u9879\u3002\u5FC5\u987B\u5E26 `unknownClass`\uFF08user_preference / lookupable_fact / implementation_detail\uFF09\uFF1B",
  "  \u53EF\u9009 `blocking`\uFF08true/false\uFF09\uFF1B\u53EA\u6709 `unknownClass` = user_preference \u65F6\u53EF\u4EE5\u5E26 `candidates`",
  "  \uFF08\u6700\u591A 3 \u4E2A\uFF0C\u6BCF\u4E2A {id, text, impact?}\uFF0Ctext \u2264200 \u5B57\uFF09\u3002",
  "\u9650\u5236\uFF1A`text` \u6BCF\u6761\u4E0D\u8D85\u8FC7 300 \u5B57\uFF08`rationale` \u2264160 \u5B57\uFF09\uFF1B`items` \u603B\u5171\u4E0D\u8D85\u8FC7 12 \u6761\uFF1Bid \u4E0D\u9700\u8981\u7ED9\u3002",
  '**\u6BCF\u4E00\u8F6E\u90FD\u5FC5\u987B\u7ED9\u51FA"\u8FD9\u4E00\u8F6E\u6211\u7406\u89E3\u5230\u4E86\u4EC0\u4E48"**\uFF1A\u54EA\u6015\u7528\u6237\u53EA\u5199\u4E86\u4E00\u4E24\u4E2A\u5B57\uFF0C\u4E5F\u8981\u7ED3\u5408\u4E0A\u4E0B\u6587\u63A8\u65AD\u51FA\u4ED6\u7684\u610F\u56FE\uFF0C',
  '\u81F3\u5C11\u8F93\u51FA\u4E00\u6761\u6761\u76EE\uFF08\u901A\u5E38\u662F user_requirement \u6216 quality_interpretation\uFF09\uFF0C**\u4E0D\u8BB8\u56E0\u4E3A"\u6CA1\u4EC0\u4E48\u53EF\u8865"\u5C31\u4EA4\u7A7A\u6570\u7EC4**\u3002'
].join("\n");

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
var OPTIMIZE_ITEM_KINDS = [
  "user_requirement",
  "quality_interpretation",
  "observed_fact",
  "implementation_option",
  "proposal",
  "unknown",
  "rewrite",
  "requirement",
  "quality",
  "plan",
  "risk"
];
var OPTIMIZE_UNKNOWN_CLASSES = ["user_preference", "lookupable_fact", "implementation_detail"];
var OPTIMIZE_MAX_ITEMS = 12;
var OPTIMIZE_ITEM_MAX_CHARS = 300;
var OPTIMIZE_RATIONALE_MAX_CHARS = 160;
var OPTIMIZE_CANDIDATES_MAX = 3;
var OPTIMIZE_CANDIDATE_MAX_CHARS = 200;
var buildTierSystem = (tier) => [
  RELAY_ROLE,
  UPSTREAM_MISSION,
  TIER_STRATEGY_BLOCKS[tier],
  UPSTREAM_RULES,
  UPSTREAM_STYLE,
  DOMAIN_QUALITY_BLOCK
].join("\n\n");
var OPTIMIZER_SPECS = {
  light: { temperature: 0.2, system: buildTierSystem("light") },
  standard: { temperature: 0.3, system: buildTierSystem("standard") },
  heavy: { temperature: 0.3, system: buildTierSystem("heavy") }
};
var FALLBACK_TIER = "standard";
function specOf(tier) {
  return OPTIMIZER_SPECS[tier] ?? OPTIMIZER_SPECS[FALLBACK_TIER];
}
var OPTIMIZER_INTENT_SEGMENT = `\u3010\u8FD9\u4E00\u8F6E\u80FD\u770B\u5230\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u3011
\u6211\u5728 <\u4F1A\u8BDD\u4E0A\u4E0B\u6587> \u91CC\u7ED9\u4E86\u4F60\u8FD9\u6BB5\u5BF9\u8BDD\u6700\u8FD1\u7684\u5F80\u6765\u3002
- \u7528\u5B83\u6765**\u6D88\u6B67\u4E49**\uFF1A\u628A\u8349\u7A3F\u91CC\u542B\u7CCA\u7684\u6307\u4EE3\uFF08"\u90A3\u4E2A\u9875\u9762""\u5B83""\u4E0A\u9762\u90A3\u7248"\uFF09\u8865\u6210\u4E0A\u4E0B\u6587\u91CC\u660E\u786E\u7684\u5BF9\u8C61\u3002
- \u4E0A\u4E0B\u6587**\u53EA\u7528\u4E8E\u7406\u89E3**\uFF0C\u4E0D\u8981\u56DE\u5E94\u5B83\u3001\u4E0D\u8981\u5EF6\u7EED\u5B83\u3001\u4E0D\u8981\u628A\u5B83\u5F53\u6210\u8981\u5904\u7406\u7684\u5185\u5BB9\u3002
- \u4ECD\u7136\u53EA\u4EA7\u51FA**\u80FD\u6307\u56DE <\u539F\u6587> \u67D0\u4E00\u53E5**\u7684\u6761\u76EE\uFF1A\u4E0A\u4E0B\u6587\u91CC\u51FA\u73B0\u7684\u4E1C\u897F**\u4E0D\u7B97\u4F9D\u636E**\uFF0C\u4E0D\u80FD\u62FF\u5B83\u5F53\u5F15\u6587\u3002`;
function buildOptimizeSystem(tier, custom = "", options = {}) {
  const body = custom.trim() === "" ? specOf(tier).system : custom.trim();
  const parts = [body];
  if (options.intent === true) parts.push(OPTIMIZER_INTENT_SEGMENT);
  if (options.framing === "hard") parts.push(HARD_TONE_BLOCK);
  parts.push(OPTIMIZER_OUTPUT_CONTRACT_V2);
  return parts.join("\n\n");
}
function buildOptimizeTemperature(tier) {
  return specOf(tier).temperature;
}
function optimizePromptSource(custom) {
  return String(custom ?? "").trim() === "" ? "builtin" : "custom";
}
function buildOptimizeUser(original, options = {}) {
  const parts = [];
  const context = String(options.context ?? "").trim();
  if (context !== "") {
    parts.push(
      "\u3010\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u3011\u4E0B\u9762\u662F\u8FD9\u4E2A\u4F1A\u8BDD\u6700\u8FD1\u7684\u5F80\u6765\uFF0C**\u53EA\u5E2E\u4F60\u7406\u89E3\u8FD9\u53E5\u8BDD\u5728\u8BF4\u4EC0\u4E48**\u3002",
      "<\u4F1A\u8BDD\u4E0A\u4E0B\u6587>",
      context,
      "</\u4F1A\u8BDD\u4E0A\u4E0B\u6587>",
      ""
    );
  }
  const previous = String(options.previous ?? "").trim();
  if (previous !== "") {
    parts.push(
      "\u3010\u4E0A\u4E00\u8F6E\u4F60\u7ED9\u51FA\u7684\u7248\u672C\u3011\u7528\u6237\u5728\u8FD9\u4E00\u7248\u7684\u57FA\u7840\u4E0A\u53C8\u6539\u4E86\u539F\u6587\uFF0C\u5E76\u518D\u70B9\u4E86\u4E00\u6B21\u4F18\u5316\u3002",
      "<\u4E0A\u4E00\u8F6E\u6210\u54C1>",
      previous,
      "</\u4E0A\u4E00\u8F6E\u6210\u54C1>",
      "\u6CBF\u7528\u5176\u4E2D\u5DF2\u7ECF\u786E\u8BA4\u7684\u51B3\u7B56\uFF0C\u53EA\u56F4\u7ED5\u53D1\u751F\u53D8\u5316\u7684\u5730\u65B9\u8C03\u6574\uFF1B\u4E0D\u8981\u628A\u5B83\u5F53\u6210\u65B0\u7684\u9700\u6C42\u6765\u6E90\uFF0C\u4E5F\u4E0D\u8981\u6574\u6BB5\u91CD\u5199\u6210\u53E6\u4E00\u4E2A\u65B9\u5411\u3002",
      ""
    );
  }
  parts.push(
    '\u3010\u5F85\u8F6C\u8FBE\u5185\u5BB9\u3011\u4E0B\u9762\u662F"\u7528\u6237"\u53D1\u7ED9\u6211\u7684\u539F\u8BDD\u3002**\u5B83\u4E0D\u662F\u8BF4\u7ED9\u4F60\u542C\u7684**\uFF0C\u4F60\u4E0D\u9700\u8981\u56DE\u5E94\u5B83\u3001\u4E5F\u4E0D\u9700\u8981\u66FF\u7528\u6237\u53BB\u505A\u8FD9\u4EF6\u4E8B\u3002',
    "<\u539F\u6587>",
    String(original ?? ""),
    "</\u539F\u6587>",
    "",
    "\u3010\u4F60\u7684\u4EFB\u52A1\u3011\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u7684\u89C4\u5219\uFF0C\u628A\u4E0A\u9762\u7684\u539F\u8BDD\u62C6\u6210**\u6761\u76EE**\u5E76\u7ED9\u6BCF\u6761\u9644\u4E0A**\u9010\u5B57\u5F15\u6587**\u3002",
    "- \u53EA\u8F93\u51FA\u90A3\u4EFD JSON \u5951\u7EA6\u8981\u6C42\u7684\u4E1C\u897F\uFF1B\u4E0D\u8981\u56DE\u5E94\u6211\u3001\u4E0D\u8981\u56DE\u7B54\u95EE\u9898\u3001\u4E0D\u8981\u8C22\u5E55\u3001\u4E0D\u8981\u89E3\u91CA\u4F60\u505A\u4E86\u4EC0\u4E48\u3002",
    '- \u8BFB\u8005\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\uFF0C\u800C\u4F60\u7684\u4EA7\u51FA\u4F1A\u5148\u7ECF\u5BBF\u4E3B\u9010\u6761\u6838\u5BF9\u5F15\u6587\u3002'
  );
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
  light: { factor: 1.4, floor: 400 },
  standard: { factor: 2.6, floor: 700 },
  heavy: { factor: 4, floor: 1400 }
};
var TIER_KINDS = {
  // `off` 档不调用模型（宿主半会拦），空数组只是防御。
  off: [],
  light: ["rewrite", "unknown", "user_requirement"],
  standard: ["rewrite", "requirement", "quality", "unknown", "user_requirement", "quality_interpretation", "implementation_option"],
  heavy: [
    "rewrite",
    "requirement",
    "quality",
    "unknown",
    "plan",
    "risk",
    "user_requirement",
    "quality_interpretation",
    "implementation_option",
    "observed_fact",
    "proposal"
  ]
};
function allowedKindsFor(tier) {
  return TIER_KINDS[tier] ?? TIER_KINDS.standard;
}
function optimizeBudgetFor(tier, originalChars) {
  const spec = TIER_BUDGET[tier] ?? TIER_BUDGET.standard;
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
function findQuoteSpan(original, quote2) {
  const q = String(quote2 ?? "").trim();
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
function validateRawItem(entry, options) {
  const { original, index, accepted, seenRewrite } = options;
  const id = `item#${index + 1}`;
  const warnings = [];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return { kind: "dropped", dropped: { id, kind: "(\u975E\u5BF9\u8C61)", reason: "\u6761\u76EE\u4E0D\u662F\u5BF9\u8C61" }, warnings };
  }
  const row = entry;
  const kind = String(row.kind ?? "");
  if (!OPTIMIZE_ITEM_KINDS.includes(kind)) {
    return {
      kind: "dropped",
      dropped: { id, kind: kind === "" ? "(\u7A7A)" : kind, reason: `kind \u4E0D\u5728\u5141\u8BB8\u5217\u8868\u91CC\uFF08${OPTIMIZE_ITEM_KINDS.join(" / ")}\uFF09` },
      warnings
    };
  }
  let text = typeof row.text === "string" ? row.text.trim() : "";
  if (text === "") {
    return { kind: "dropped", dropped: { id, kind, reason: "text \u662F\u7A7A\u7684" }, warnings };
  }
  if (text.length > OPTIMIZE_ITEM_MAX_CHARS) {
    warnings.push(`${id}\uFF1Atext \u8D85 ${OPTIMIZE_ITEM_MAX_CHARS} \u5B57\uFF0C\u5DF2\u622A\u65AD`);
    text = text.slice(0, OPTIMIZE_ITEM_MAX_CHARS);
  }
  if (accepted >= OPTIMIZE_MAX_ITEMS) {
    return {
      kind: "dropped",
      dropped: { id, kind, reason: `\u8D85\u8FC7\u5355\u8F6E\u4E0A\u9650 ${OPTIMIZE_MAX_ITEMS} \u6761 \u21D2 \u622A\u65AD\u4E22\u5F03\uFF08\u6574\u8F6E\u7167\u5E38\u51FA\u6210\u54C1\uFF09` },
      warnings
    };
  }
  const rationale = typeof row.rationale === "string" ? row.rationale.trim() : "";
  if (kind === "quality_interpretation" && rationale === "") {
    return { kind: "dropped", dropped: { id, kind, reason: "\u7F3A\u5C11 rationale\uFF08\u8D28\u91CF\u89E3\u8BFB\u8981\u8BF4\u6E05\u5B83\u6765\u81EA\u539F\u8BDD\u54EA\u51E0\u4E2A\u5B57\uFF09" }, warnings };
  }
  const sourceRefs = Array.isArray(row.sourceRefs) ? row.sourceRefs.filter((value) => typeof value === "string" && value.trim() !== "").map((value) => String(value).trim()) : [];
  if (kind === "observed_fact" && sourceRefs.length === 0) {
    return { kind: "dropped", dropped: { id, kind, reason: "\u7F3A\u5C11 sourceRefs\uFF08\u53EA\u6709\u771F\u8BFB\u5230\u624D\u7B97\u4E8B\u5B9E\uFF1B\u53EA\u5217\u8FC7\u76EE\u5F55\u4E0D\u7B97\uFF09" }, warnings };
  }
  const rawCandidates = Array.isArray(row.candidates) ? row.candidates : [];
  const candidates = [];
  if (rawCandidates.length > 0 && !(kind === "unknown" && (row.unknownClass ?? "user_preference") === "user_preference")) {
    warnings.push(`${id}\uFF1Acandidates \u53EA\u5141\u8BB8\u7528\u5728 unknown + user_preference \u4E0A\uFF0C\u5DF2\u5FFD\u7565`);
  } else {
    for (const entry0 of rawCandidates) {
      if (typeof entry0 !== "object" || entry0 === null) continue;
      const row0 = entry0;
      const cid = typeof row0.id === "string" ? row0.id.trim() : "";
      const ctext = typeof row0.text === "string" ? row0.text.trim() : "";
      if (cid === "" || ctext === "") continue;
      if (candidates.length >= OPTIMIZE_CANDIDATES_MAX) {
        warnings.push(`${id}\uFF1A\u5019\u9009\u8D85\u8FC7 ${OPTIMIZE_CANDIDATES_MAX} \u4E2A\uFF0C\u591A\u7684\u5DF2\u5FFD\u7565`);
        break;
      }
      const impact = typeof row0.impact === "string" ? row0.impact.trim() : "";
      candidates.push({
        id: cid,
        text: ctext.length > OPTIMIZE_CANDIDATE_MAX_CHARS ? ctext.slice(0, OPTIMIZE_CANDIDATE_MAX_CHARS) : ctext,
        ...impact === "" ? {} : { impact }
      });
    }
  }
  const needsQuote = kind === "rewrite" || kind === "requirement" || kind === "quality" || kind === "user_requirement";
  const quote2 = typeof row.quote === "string" ? row.quote.trim() : "";
  if (needsQuote) {
    if (quote2 === "") {
      return { kind: "dropped", dropped: { id, kind, reason: "\u7F3A\u5C11 quote\uFF08\u8FD9\u4E00\u7C7B\u6761\u76EE\u5FC5\u987B\u6709\u9010\u5B57\u5F15\u6587\uFF09" }, warnings };
    }
    const span2 = findQuoteSpan(original, quote2);
    if (span2 === void 0) {
      return {
        kind: "dropped",
        dropped: { id, kind, reason: `\u5F15\u6587\u4E0D\u662F\u539F\u8BDD\u91CC\u7684\u9010\u5B57\u7247\u6BB5\uFF1A\u300C${quote2.slice(0, 40)}\u300D` },
        warnings
      };
    }
    if (kind === "rewrite") {
      const key = `${String(span2.start)}-${String(span2.end)}`;
      if (seenRewrite.has(key)) {
        return { kind: "dropped", dropped: { id, kind, reason: "\u4E0E\u53E6\u4E00\u6761 rewrite \u5F15\u7528\u4E86\u540C\u4E00\u6BB5\u539F\u8BDD\uFF08\u91CD\u590D\uFF09" }, warnings };
      }
      seenRewrite.add(key);
    }
    return {
      kind: "item",
      item: {
        id,
        kind,
        text,
        quote: quote2,
        span: span2,
        quoteSource: "user",
        ...rationale === "" ? {} : { rationale: rationale.slice(0, OPTIMIZE_RATIONALE_MAX_CHARS) },
        ...sourceRefs.length === 0 ? {} : { sourceRefs },
        ...candidates.length === 0 ? {} : { candidates }
      },
      warnings
    };
  }
  const span = quote2 === "" ? void 0 : findQuoteSpan(original, quote2);
  if (quote2 !== "" && span === void 0) {
    warnings.push(`${id}\uFF1A\u5F15\u6587\u5BF9\u4E0D\u4E0A\u539F\u8BDD\uFF0C\u5DF2\u6309"\u6A21\u578B\u81EA\u5DF1\u8865\u7684"\u8BB0\u8D26\uFF08\u4E0D\u5192\u5145\u4F60\u8BF4\u8FC7\u7684\u8BDD\uFF09`);
  }
  return {
    kind: "item",
    item: {
      id,
      kind,
      text,
      quoteSource: span === void 0 ? "none" : "user",
      ...span === void 0 ? {} : { span, quote: quote2 },
      ...kind === "unknown" ? { unknownClass: unknownClassOf(row.unknownClass), blocking: row.blocking === true } : {},
      // 0.14.0：这几类不走引文那条路径，但它们各自的必填字段要带上（否则成品里就丢了依据）。
      ...rationale === "" ? {} : { rationale: rationale.slice(0, OPTIMIZE_RATIONALE_MAX_CHARS) },
      ...sourceRefs.length === 0 ? {} : { sourceRefs },
      ...candidates.length === 0 ? {} : { candidates }
    },
    warnings
  };
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
    const checked = validateRawItem(raw_items[index], { original, index, accepted: items.length, seenRewrite });
    warnings.push(...checked.warnings);
    if (checked.kind === "item") items.push(checked.item);
    else dropped.push(checked.dropped);
  }
  if (items.length === 0 && dropped.length === 0 && raw_items.length === 0) warnings.push("\u6A21\u578B\u4EA4\u56DE\u7A7A\u6570\u7EC4\uFF1A\u8FD9\u4E00\u8F6E\u6CA1\u6709\u53EF\u6838\u5B9E\u7684\u8865\u5168");
  return { ok: true, items, dropped, warnings };
}
function envelopeArrayStart(buffer) {
  const pattern2 = /"(?:items|ops)"\s*:\s*\[/g;
  let last = -1;
  let matched = pattern2.exec(buffer);
  while (matched !== null) {
    last = matched.index + matched[0].length;
    matched = pattern2.exec(buffer);
  }
  return last;
}
function scanEnvelopeArray(buffer) {
  const start = envelopeArrayStart(buffer);
  if (start < 0) return { elements: [], closed: false };
  const elements = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let elementStart = -1;
  for (let i = start; i < buffer.length; i += 1) {
    const ch = buffer[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) elementStart = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && elementStart >= 0) {
        elements.push({ index: elements.length, raw: buffer.slice(elementStart, i + 1) });
        elementStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) return { elements, closed: true };
  }
  return { elements, closed: false };
}
function normalizeStreamElement(value, warnings) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const row = value;
  if (row.op === "add_item" && typeof row.item === "object" && row.item !== null) return row.item;
  if (typeof row.op === "string") {
    warnings.push(`\u5FFD\u7565\u4E86\u4E0D\u652F\u6301\u7684 op\u300C${row.op}\u300D\uFF1A\u672C\u63D2\u4EF6\u4E0D\u505A\u8DE8\u8F6E\u72B6\u6001\uFF0C\u53EA\u8BA4 add_item`);
    return void 0;
  }
  return row;
}
function scanOptimizeStream(buffer, original, tier) {
  const { elements, closed } = scanEnvelopeArray(buffer);
  const allowed = allowedKindsFor(tier);
  const items = [];
  const dropped = [];
  const warnings = [];
  const seenRewrite = /* @__PURE__ */ new Set();
  let position = 0;
  for (const element of elements) {
    let value;
    try {
      value = JSON.parse(element.raw);
    } catch {
      continue;
    }
    const normalized = normalizeStreamElement(value, warnings);
    if (normalized === void 0) continue;
    const checked = validateRawItem(normalized, { original, index: position, accepted: items.length, seenRewrite });
    position += 1;
    warnings.push(...checked.warnings);
    if (checked.kind === "dropped") {
      dropped.push(checked.dropped);
      continue;
    }
    if (!allowed.includes(checked.item.kind)) {
      dropped.push({
        id: checked.item.id,
        kind: checked.item.kind,
        reason: `\u5F53\u524D\u6863\u4F4D\uFF08${tier}\uFF09\u4E0D\u4EA7\u51FA\u300C${checked.item.kind}\u300D\u8FD9\u4E00\u7C7B\u6761\u76EE`
      });
      continue;
    }
    items.push(checked.item);
  }
  return { items, dropped, warnings, closed };
}
var SECTIONS = [
  // 0.14.0（上游本体）：装配按 kind 分桶，所以"支持一类"就等于在这里加一节的标签。
  { key: "user_requirement", label: "\u4F60\u8981\u7684\uFF08\u6BCF\u6761\u90FD\u6307\u56DE\u4F60\u539F\u8BDD\u91CC\u7684\u67D0\u53E5\uFF09", required: true },
  { key: "quality_interpretation", label: "\u5BF9\u8D28\u91CF\u8BCD\u7684\u7406\u89E3", required: false },
  { key: "observed_fact", label: "\u5DF2\u6838\u5B9E\u7684\u4E8B\u5B9E\uFF08\u6765\u81EA\u4F60\u9879\u76EE\u91CC\u7684\u6587\u4EF6\uFF09", required: false },
  { key: "implementation_option", label: "\u53EF\u9006\u7684\u5B9E\u73B0\u9009\u62E9\uFF08\u4E0D\u662F\u4F60\u7684\u8981\u6C42\uFF0C\u5DE5\u4F5C AI \u53EF\u81EA\u884C\u8C03\u6574\uFF09", required: false },
  { key: "proposal", label: "\u5EFA\u8BAE\uFF08\u53EF\u80FD\u4E0D\u88AB\u91C7\u7EB3\uFF09", required: false },
  { key: "requirement", label: "\u8865\u5168\u8981\u6C42\uFF08\u6BCF\u6761\u90FD\u6307\u56DE\u4F60\u539F\u8BDD\u91CC\u7684\u67D0\u53E5\uFF09", required: true },
  { key: "quality", label: "\u5BF9\u8D28\u91CF\u8BCD\u7684\u7406\u89E3", required: false },
  { key: "plan", label: "\u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212", required: false },
  { key: "risk", label: "\u591A\u60C5\u51B5\u9884\u6848", required: false },
  { key: "unknown", label: "\u4E0D\u660E\u786E\u5904", required: false }
];
var DROP_ORDER = [
  "proposal",
  "implementation_option",
  "observed_fact",
  "quality_interpretation",
  "risk",
  "plan",
  "quality",
  "unknown"
];
var UNKNOWN_SUFFIX = {
  user_preference: "\uFF08\u53EA\u6709\u6211\u80FD\u5B9A\uFF1A\u5148\u95EE\u6211\uFF0C\u4E0D\u8981\u81EA\u884C\u5047\u8BBE\uFF09",
  lookupable_fact: "\uFF08\u53EF\u67E5\u8BC1\u7684\u4E8B\u5B9E\uFF1A\u5148\u8BFB\u4EE3\u7801/\u6587\u6863\u786E\u8BA4\uFF0C\u4E0D\u8981\u731C\uFF09",
  implementation_detail: "\uFF08\u5B9E\u73B0\u7EC6\u8282\uFF1A\u4F60\u81EA\u5DF1\u5B9A\uFF09"
};
function lineFor(item) {
  if (item.kind === "unknown") {
    const cls = item.unknownClass ?? "user_preference";
    const blocking = item.blocking === true ? "[\u6321\u4F4F\u4E0B\u4E00\u6B65] " : "";
    const candidates = (item.candidates ?? []).length === 0 ? "" : `
${(item.candidates ?? []).map((c) => `  \xB7 ${c.text}${c.impact === void 0 ? "" : `\uFF08${c.impact}\uFF09`}`).join("\n")}`;
    return `- ${blocking}${item.text}${UNKNOWN_SUFFIX[cls]}${candidates}`;
  }
  if (item.kind === "quality_interpretation") {
    const why = item.rationale === void 0 ? "" : `\uFF08\u6765\u81EA\u539F\u8BDD\uFF1A\u300C${item.rationale}\u300D\uFF09`;
    return `- ${item.text}${why}`;
  }
  if (item.kind === "observed_fact") {
    const from2 = (item.sourceRefs ?? []).length === 0 ? "" : `\uFF08\u4F9D\u636E\uFF1A${(item.sourceRefs ?? []).join("\u3001")}\uFF09`;
    return `- ${item.text}${from2}`;
  }
  if (item.kind === "implementation_option" || item.kind === "proposal") {
    return `- ${item.text}`;
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
  const body = body0;
  for (const item of usable) {
    if (item.kind !== "rewrite") continue;
    dropped.push({ id: item.id, kind: item.kind, reason: "\u8FD9\u4E00\u7C7B\u5DF2\u505C\u7528\uFF1A\u6210\u54C1\u4E0D\u518D\u6539\u5199\u4F60\u7684\u539F\u8BDD\uFF080.14.0 \u8D77\u539F\u8BDD\u539F\u6837\u4FDD\u7559\uFF09" });
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
  const itemCount = SECTIONS.reduce((sum, section) => sum + (included[section.key] ?? []).length, 0);
  return {
    text,
    sections: SECTIONS.filter((section) => (included[section.key] ?? []).length > 0).map((section) => section.label),
    dropped: [...dropped, ...removed],
    warnings,
    chars: text.length,
    budget,
    overBudget: overBy > 0,
    overBy,
    // 0.14.0 起原话原样保留（回填路径已撤），所以这个数**恒为 0**；
    // 字段留着是为了不破坏台账/面板的既有读取方，语义见接口上的说明。
    rewrittenChars: 0,
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

// src/optimize-ledger.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync, readFileSync as readFileSync2, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname as dirname4, join as join4 } from "node:path";

// src/quick-store.ts
import { mkdir as mkdir2, open, readFile as readFile2, rename as rename2, unlink } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname3, join as join3 } from "node:path";
var QUICK_STORE_FILE = "quick-prompts.json";
var LOCK_RETRY_MS = 50;
var LOCK_RETRY_MAX = 40;
var LOCK_STALE_MS = 3e4;
function dshHome2() {
  const fromEnv = process.env.DSH_HOME?.trim();
  return fromEnv !== void 0 && fromEnv !== "" ? fromEnv : join3(homedir2(), ".dsh");
}
function quickStorePath() {
  return join3(dshHome2(), QUICK_STORE_FILE);
}
function errorText2(error) {
  return error instanceof Error ? error.message : String(error);
}
function hasCode(error, code) {
  return typeof error === "object" && error !== null && error.code === code;
}
function delay(ms) {
  return new Promise((resolve5) => {
    setTimeout(resolve5, ms);
  });
}
async function quarantine(file) {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const target = `${file}.bad-${stamp}`;
  try {
    await rename2(file, target);
    return target;
  } catch {
    return void 0;
  }
}
async function readQuickBook(file = quickStorePath()) {
  let raw;
  try {
    raw = await readFile2(file, "utf8");
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
  await mkdir2(dirname3(file), { recursive: true });
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
  await rename2(tmp, file);
}
async function ensureQuickBook(seed, file = quickStorePath()) {
  const current = await readQuickBook(file);
  if (current.kind !== "missing") return current;
  await mkdir2(dirname3(file), { recursive: true });
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

// src/optimize-ledger.ts
var LEDGER_DIR = "composer-ux";
var LEDGER_FILE = "optimize-log.jsonl";
var LEDGER_MAX_BYTES = 512 * 1024;
function ledgerPath(home = dshHome2()) {
  return join4(home, LEDGER_DIR, LEDGER_FILE);
}
function ledgerSafeReason(reason, max = 60) {
  return String(reason ?? "").replace(/「[^」]*」/g, "").replace(/“[^”]*”/g, "").replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "").replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
function safeFailure(failure) {
  return ledgerSafeReason(String(failure ?? ""), 200);
}
function buildLedgerRun(input, at = (/* @__PURE__ */ new Date()).toISOString()) {
  const failure = safeFailure(input.failure ?? "");
  return {
    kind: "run",
    at,
    sessionId: input.sessionId.slice(0, 64),
    tier: input.tier,
    provider: input.provider,
    model: input.model,
    draftChars: Math.max(0, Math.trunc(input.draftChars)),
    contextTurns: Math.max(0, Math.trunc(input.contextTurns)),
    contextChars: Math.max(0, Math.trunc(input.contextChars)),
    items: Math.max(0, Math.trunc(input.items)),
    dropped: Math.max(0, Math.trunc(input.dropped)),
    // 原因先消毒再去重（见 ledgerSafeReason：那几条模板里嵌着模型给的值）。
    // ⚠️ 必须写成箭头函数：`map(ledgerSafeReason)` 会把**下标**当成第二个参数（`max`），
    // 而下标 0 会把原因整条截成空串 —— 测试当场抓住了它（"丢弃原因仍能回答为什么丢"红了）。
    droppedReasons: [...new Set(input.droppedReasons.map((reason) => ledgerSafeReason(reason)).filter((reason) => reason !== ""))].slice(0, 8),
    warnings: Math.max(0, Math.trunc(input.warnings)),
    fallback: input.fallback === true,
    retried: input.retried === true,
    promptSource: input.promptSource,
    ms: Math.max(0, Math.trunc(input.ms)),
    ok: input.ok === true,
    ...failure === "" ? {} : { failure },
    // 工具字段：只收数字/布尔/工具名；`toolError` 同样过消毒（它可能带着模型的原文报错）。
    ...input.toolRounds === void 0 ? {} : { toolRounds: Math.max(0, Math.trunc(input.toolRounds)) },
    ...input.toolCalls === void 0 ? {} : { toolCalls: Math.max(0, Math.trunc(input.toolCalls)) },
    ...input.toolNames === void 0 ? {} : { toolNames: [...new Set(input.toolNames.map((name2) => ledgerSafeReason(String(name2), 24)))].filter((name2) => name2 !== "").slice(0, 8) },
    ...input.toolCapped === void 0 ? {} : { toolCapped: input.toolCapped === true },
    ...input.toolFallback === void 0 ? {} : { toolFallback: input.toolFallback === true },
    ...input.toolRejected === void 0 ? {} : { toolRejected: Math.max(0, Math.trunc(input.toolRejected)) },
    ...(input.toolError ?? "") === "" ? {} : { toolError: ledgerSafeReason(String(input.toolError), 120) }
  };
}
function ledgerLine(record) {
  return `${JSON.stringify(record)}
`;
}
function rotateLedger(text, maxBytes = LEDGER_MAX_BYTES) {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return null;
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const target = Math.floor(lines.length / 2);
  const kept = lines.slice(-Math.max(1, target));
  return {
    text: kept.length === 0 ? "" : `${kept.join("\n")}
`,
    droppedLines: lines.length - kept.length,
    keptLines: kept.length
  };
}
function appendLedger(record, file = ledgerPath()) {
  try {
    mkdirSync(dirname4(file), { recursive: true });
    const line = ledgerLine(record);
    let rotated = false;
    if (existsSync3(file)) {
      const current = readFileSync2(file, "utf8");
      const slim = rotateLedger(current, LEDGER_MAX_BYTES - Buffer.byteLength(line, "utf8"));
      if (slim !== null) {
        const tmp = `${file}.tmp-${process.pid}`;
        writeFileSync(tmp, slim.text);
        renameSync(tmp, file);
        rotated = true;
        appendFileSync(file, ledgerLine({
          kind: "rotated",
          at: (/* @__PURE__ */ new Date()).toISOString(),
          droppedLines: slim.droppedLines,
          keptLines: slim.keptLines
        }));
      }
    }
    appendFileSync(file, line);
    return { written: true, rotated };
  } catch {
    return { written: false, rotated: false };
  }
}

// src/optimize-state.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readFileSync as readFileSync3, renameSync as renameSync2, rmSync, statSync as statSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname5, join as join5 } from "node:path";
var OPTIMIZE_STATE_FILE = "optimize-dock.json";
var OPTIMIZE_STATE_MAX_BYTES = 64 * 1024;
var OPTIMIZE_STATE_VERSION = 1;
function optimizeStatePath(home = dshHome2()) {
  return join5(home, "composer-ux", OPTIMIZE_STATE_FILE);
}
function quarantineDockState(file, at = Date.now()) {
  try {
    const target = `${file}.corrupt-${new Date(at).toISOString().replace(/[:.]/g, "-")}.json`;
    renameSync2(file, target);
    return target;
  } catch {
    return void 0;
  }
}
function readDockState(file = optimizeStatePath()) {
  if (!existsSync4(file)) return { state: null, corrupt: false, hidden: false };
  let text = "";
  try {
    text = readFileSync3(file, "utf8");
  } catch {
    return { state: null, corrupt: false, hidden: false };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: null, corrupt: true, hidden: false, quarantined: quarantineDockState(file) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { state: null, corrupt: true, hidden: false, quarantined: quarantineDockState(file) };
  }
  const envelope = parsed;
  const version = Number(envelope.version);
  if (version !== OPTIMIZE_STATE_VERSION) {
    return { state: null, corrupt: false, hidden: false, ...Number.isFinite(version) ? { unknownVersion: version } : {} };
  }
  const state = envelope.state;
  if (typeof state !== "object" || state === null || Array.isArray(state)) {
    return { state: null, corrupt: true, hidden: false, quarantined: quarantineDockState(file) };
  }
  return { state, corrupt: false, hidden: envelope.hidden === true };
}
function writeDockState(state, file = optimizeStatePath(), hidden = false) {
  try {
    if (state === null) {
      if (existsSync4(file)) rmSync(file);
      return { written: true, bytes: 0 };
    }
    const payload = `${JSON.stringify({
      version: OPTIMIZE_STATE_VERSION,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      state,
      ...hidden ? { hidden: true } : {}
    })}
`;
    const bytes = Buffer.byteLength(payload, "utf8");
    if (bytes > OPTIMIZE_STATE_MAX_BYTES) return { written: false, tooBig: true, bytes };
    mkdirSync2(dirname5(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync2(tmp, payload);
    renameSync2(tmp, file);
    return { written: true, bytes };
  } catch (error) {
    return { written: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function clearDockState(file = optimizeStatePath()) {
  try {
    if (existsSync4(file)) rmSync(file);
    return true;
  } catch {
    return false;
  }
}
function dockStateBytes(file = optimizeStatePath()) {
  try {
    return existsSync4(file) ? statSync2(file).size : 0;
  } catch {
    return 0;
  }
}

// src/optimize-bash.ts
import { spawn } from "node:child_process";
import { realpathSync, statSync as statSync3 } from "node:fs";
import { isAbsolute as isAbsolute2, relative, resolve as resolvePath } from "node:path";
var BASH_TOOL_NAME2 = "bash";
var BASH_MAX_COMMAND_CHARS = 2e3;
var BASH_TIMEOUT_MS = 2e4;
var BASH_MAX_TIMEOUT_MS = 6e4;
var BASH_MAX_OUTPUT_CHARS = 4e3;
var BASH_COMMAND_FIELD = "command";
var BASH_SCRIPT_FIELD = "script_path";
var BASH_TOOL_SCHEMA = {
  name: BASH_TOOL_NAME2,
  description: [
    "Run a shell command in the user's project working directory and read its output.",
    "Use it to check facts you would otherwise have to guess (file names, versions, git status).",
    "Give either `command` (one line, short) or `script_path` (a file you already wrote inside the",
    "working directory) \u2014 never both. Multi-line or quote-heavy scripts belong in a file: put them",
    "there with the file tools first, then pass `script_path`, so no shell text has to survive JSON",
    "escaping. It is time-limited and its output is truncated. Read-only use is expected."
  ].join(" "),
  parameters: {
    type: "object",
    properties: {
      [BASH_COMMAND_FIELD]: {
        type: "string",
        description: "The shell command line to run (one line, no interactive input). Mutually exclusive with script_path."
      },
      [BASH_SCRIPT_FIELD]: {
        type: "string",
        description: "Path to a script file inside the working directory; it runs through the same shell. Mutually exclusive with command."
      }
    },
    additionalProperties: false
  }
};
var BASH_TOOL_SYSTEM_NOTE = [
  "\u3010\u5173\u4E8E bash \u5DE5\u5177\u3011\u4F60\u53EF\u4EE5\u8C03\u7528 `bash` \u5728\u7528\u6237\u7684\u5DE5\u4F5C\u76EE\u5F55\u91CC\u6267\u884C\u547D\u4EE4\u6765**\u6838\u5BF9\u4E8B\u5B9E**\uFF1A",
  "- \u4E00\u6B21\u4E00\u6761\u547D\u4EE4\uFF0C\u4E0D\u63A5\u4EA4\u4E92\u8F93\u5165\uFF1B\u8D85\u65F6\u6216\u8F93\u51FA\u8FC7\u957F\u4F1A\u88AB\u622A\u65AD\uFF08\u622A\u65AD\u4F1A\u5982\u5B9E\u544A\u8BC9\u4F60\uFF09\u3002",
  "- **\u957F\u811A\u672C\u3001\u591A\u884C\u3001\u542B\u5927\u91CF\u5F15\u53F7/\u53CD\u659C\u6760/\u4E2D\u6587\u7684\u547D\u4EE4**\uFF1A\u5148\u7528\u6587\u4EF6\u5DE5\u5177\u628A\u5B83\u5199\u6210\u5DE5\u4F5C\u76EE\u5F55\u91CC\u7684\u4E00\u4E2A\u811A\u672C\uFF0C",
  "  \u518D\u628A `script_path` \u4EA4\u7ED9 `bash`\uFF08\u4E0D\u8981\u585E\u8FDB `command`\uFF09\u2014\u2014 \u90A3\u6837\u4E0D\u5FC5\u5728\u5DE5\u5177\u8C03\u7528 JSON \u91CC\u505A\u591A\u5C42\u8F6C\u4E49\u3002",
  "- \u53EA\u80FD\u5728\u5DE5\u4F5C\u76EE\u5F55\u91CC\u8DD1\uFF1A\u4E0D\u8981 `cd` \u5230\u522B\u5904\u3001\u4E0D\u8981\u5199\u6587\u4EF6\u3001\u4E0D\u8981\u88C5\u4E1C\u897F \u2014\u2014 \u4F60\u7684\u4EFB\u52A1\u662F**\u8BFB\u4E8B\u5B9E**\u3002",
  "- \u547D\u4EE4\u5931\u8D25\u4E0D\u662F\u707E\u96BE\uFF1A\u9000\u51FA\u7801\u4E0E\u62A5\u9519\u4F1A\u539F\u6837\u56DE\u5230\u4F60\u8FD9\u91CC\uFF0C\u636E\u6B64\u6539\u5224\u65AD\u5373\u53EF\u3002"
].join("\n");
function clamp(text) {
  if (text.length <= BASH_MAX_OUTPUT_CHARS) return { text, truncated: false };
  return { text: `${text.slice(0, BASH_MAX_OUTPUT_CHARS)}
\u2026\uFF08\u8F93\u51FA\u8D85\u957F\uFF0C\u53EA\u7ED9\u4E86\u524D ${BASH_MAX_OUTPUT_CHARS} \u5B57\uFF09`, truncated: true };
}
function reject(reason) {
  return {
    text: `\u62D2\u7EDD\uFF1A${reason}`,
    isError: true,
    meta: { tool: BASH_TOOL_NAME2, files: 0, hits: 0, bytes: 0, rejected: reason }
  };
}
function resolveInside(root, candidate) {
  try {
    const abs = isAbsolute2(candidate) ? candidate : resolvePath(root, candidate);
    let real = abs;
    try {
      real = realpathSync.native(abs);
    } catch {
      real = abs;
    }
    let realRoot = root;
    try {
      realRoot = realpathSync.native(root);
    } catch {
      realRoot = root;
    }
    const rel = relative(realRoot, real);
    if (rel === "" || isAbsolute2(rel) || rel.startsWith("..")) return void 0;
    return real;
  } catch {
    return void 0;
  }
}
var BASH_ALLOWED_FIELDS = [BASH_COMMAND_FIELD, BASH_SCRIPT_FIELD];
function readBashIntent(args) {
  const row = typeof args === "object" && args !== null ? args : {};
  const unknown = Object.keys(row).filter((key) => !BASH_ALLOWED_FIELDS.includes(key));
  if (unknown.length > 0) {
    return {
      kind: "reject",
      reason: `\u4E0D\u8BA4\u8BC6\u7684\u53C2\u6570 ${unknown.map((key) => `\`${key}\``).join("\u3001")}\uFF08\u672C\u5DE5\u5177\u53EA\u63A5\u53D7 ${BASH_ALLOWED_FIELDS.map((key) => `\`${key}\``).join(" \u4E0E ")}\uFF09`
    };
  }
  const rawCommand = typeof row[BASH_COMMAND_FIELD] === "string" ? row[BASH_COMMAND_FIELD].trim() : "";
  const rawScript = typeof row[BASH_SCRIPT_FIELD] === "string" ? row[BASH_SCRIPT_FIELD].trim() : "";
  const hasCommand = rawCommand !== "";
  const hasScript = rawScript !== "";
  if (hasCommand && hasScript) return { kind: "reject", reason: "`command` \u4E0E `script_path` \u53EA\u80FD\u7ED9\u4E00\u4E2A" };
  if (!hasCommand && !hasScript) return { kind: "reject", reason: `\u7F3A\u5C11 \`${BASH_COMMAND_FIELD}\`\uFF0C\u6216\u8005\u7ED9 \`${BASH_SCRIPT_FIELD}\`\uFF08\u4E8C\u9009\u4E00\uFF09` };
  if (hasCommand) {
    if (rawCommand.length > BASH_MAX_COMMAND_CHARS) {
      return { kind: "reject", reason: `\u547D\u4EE4\u8D85\u8FC7 ${String(BASH_MAX_COMMAND_CHARS)} \u5B57\uFF08\u957F\u811A\u672C\u8BF7\u5148\u5199\u6210\u6587\u4EF6\u518D\u7ED9 \`${BASH_SCRIPT_FIELD}\`\uFF09` };
    }
    return { kind: "command", command: rawCommand };
  }
  return { kind: "script", scriptPath: rawScript };
}
function resolveBashAuthority(input) {
  if (!input.enabled) return { kind: "off" };
  if (input.mode === "danger-full-access") return { kind: "open", confined: false };
  if (input.mode !== "read-only" && input.mode !== "workspace-write") {
    return { kind: "denied", reason: "\u62FF\u4E0D\u5230\u8FD9\u4E2A\u4F1A\u8BDD\u7684\u6743\u9650\u6A21\u5F0F\uFF0C\u65E0\u6CD5\u8BC1\u660E\u547D\u4EE4\u4F1A\u88AB\u7EA6\u675F" };
  }
  if (!input.hasConfine) {
    return { kind: "denied", reason: `\u4F1A\u8BDD\u662F ${input.mode}\uFF08\u4E0D\u662F\u5B8C\u5168\u6743\u9650\uFF09\uFF0C\u800C\u5BBF\u4E3B\u6CA1\u6709\u53EF\u7528\u7684\u6C99\u7BB1\u670D\u52A1` };
  }
  return { kind: "open", confined: true };
}
function runBashTool(root, args, options = {}) {
  const intent = readBashIntent(args);
  if (intent.kind === "reject") return Promise.resolve(reject(intent.reason));
  if (root === "") return Promise.resolve(reject("\u62FF\u4E0D\u5230\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\uFF0C\u62D2\u7EDD\u6267\u884C"));
  try {
    if (!statSync3(root).isDirectory()) return Promise.resolve(reject("\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u662F\u4E00\u4E2A\u76EE\u5F55"));
  } catch {
    return Promise.resolve(reject("\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u5B58\u5728"));
  }
  const isWindows = process.platform === "win32";
  const shell = isWindows ? process.env.ComSpec ?? "cmd.exe" : "/bin/sh";
  let baseArgv;
  if (intent.kind === "command") {
    const winCommand = intent.command.startsWith('"') ? `"${intent.command}"` : intent.command;
    baseArgv = isWindows ? [shell, "/d", "/s", "/c", winCommand] : [shell, "-c", intent.command];
  } else {
    const inside = resolveInside(root, intent.scriptPath);
    if (inside === void 0) {
      return Promise.resolve(reject(`\u811A\u672C\u5FC5\u987B\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u91CC\uFF1A${intent.scriptPath}`));
    }
    try {
      if (!statSync3(inside).isFile()) return Promise.resolve(reject(`\u4E0D\u662F\u6587\u4EF6\uFF1A${intent.scriptPath}`));
    } catch {
      return Promise.resolve(reject(`\u811A\u672C\u4E0D\u5B58\u5728\uFF1A${intent.scriptPath}`));
    }
    baseArgv = isWindows ? [shell, "/d", "/s", "/c", `"${inside}"`] : [shell, inside];
  }
  return new Promise((resolve5) => {
    const wantTimeout = options.timeoutMs ?? BASH_TIMEOUT_MS;
    const timeoutMs = Math.max(1e3, Math.min(BASH_MAX_TIMEOUT_MS, Math.round(wantTimeout)));
    const started = Date.now();
    const launch = (argv) => {
      if (argv.length === 0) {
        resolve5(reject("\u6C99\u7BB1\u8FD4\u56DE\u4E86\u7A7A\u7684 argv\uFF0C\u6CA1\u6709\u6267\u884C"));
        return;
      }
      const [file, ...rest] = argv;
      let child;
      try {
        child = spawn(file, rest, {
          cwd: root,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          // Windows 上必须**原样**把 argv 交给 cmd：Node 默认会再转义一遍参数，
          // 那会把上面刚拼好的引号又改坏（实测：报"文件名、目录名或卷标语法不正确"）。
          ...isWindows ? { windowsVerbatimArguments: true } : {},
          // POSIX 上让子进程自成**进程组**：超时时要能整组杀掉（见 killTree）。
          ...isWindows ? {} : { detached: true }
        });
      } catch (error) {
        resolve5(reject(`\u542F\u52A8\u547D\u4EE4\u5931\u8D25\uFF08${file ?? ""}\uFF09\uFF1A${error instanceof Error ? error.message : String(error)}`));
        return;
      }
      let collected = "";
      let bytes = 0;
      let killed = false;
      const append = (chunk) => {
        bytes += chunk.byteLength;
        if (collected.length >= BASH_MAX_OUTPUT_CHARS) return;
        collected += chunk.toString("utf8");
      };
      child.stdout?.on("data", append);
      child.stderr?.on("data", append);
      const kill = () => {
        killed = true;
        const pid = child.pid ?? 0;
        try {
          if (isWindows) {
            spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
          } else if (pid > 0) {
            process.kill(-pid, "SIGKILL");
          } else {
            child.kill("SIGKILL");
          }
        } catch {
          try {
            child.kill("SIGKILL");
          } catch {
          }
        }
      };
      const timer = setTimeout(kill, timeoutMs);
      const onAbort = () => {
        kill();
      };
      if (options.signal !== void 0) {
        if (options.signal.aborted) kill();
        else options.signal.addEventListener("abort", onAbort, { once: true });
      }
      const finish = (code, errorText4) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        const { text, truncated } = clamp(collected.trimEnd());
        const elapsed = Date.now() - started;
        const readable = errorText4 === void 0 ? void 0 : /ENOENT/i.test(errorText4) ? `\u627E\u4E0D\u5230\u6267\u884C\u5668 ${file ?? ""}\uFF08ENOENT\uFF09\uFF1A\u8FD9\u53F0\u673A\u5668\u4E0A\u6CA1\u6709\u5B83\uFF0C\u6216\u8DEF\u5F84\u4E0D\u5BF9` : errorText4;
        const head = killed ? `\u8D85\u65F6 ${String(elapsed)} ms\uFF08\u6216\u672C\u8F6E\u5DF2\u4E2D\u6B62\uFF09\uFF1A\u547D\u4EE4\u5DF2\u88AB\u6740\u6389` : readable !== void 0 ? `\u6267\u884C\u5931\u8D25\uFF1A${readable}` : `\u9000\u51FA\u7801 ${String(code ?? "null")}`;
        const note = truncated ? "\n\uFF08\u8F93\u51FA\u5DF2\u622A\u65AD\uFF09" : "";
        const lines = text === "" ? 0 : text.split("\n").length;
        resolve5({
          text: `${head}
${text}${note}`.trimEnd(),
          isError: killed || errorText4 !== void 0 || (code ?? 0) !== 0,
          meta: {
            tool: BASH_TOOL_NAME2,
            files: 0,
            hits: lines,
            bytes,
            ...killed ? { rejected: `\u8D85\u65F6 ${String(timeoutMs)} ms \u88AB\u6740` } : {}
          }
        });
      };
      child.on("error", (error) => {
        finish(null, error.message);
      });
      child.on("close", (code) => {
        finish(code);
      });
    };
    if (options.confine === void 0) {
      launch(baseArgv);
      return;
    }
    void Promise.resolve().then(() => options.confine?.(baseArgv)).then((confined) => {
      if (confined === void 0 || !Array.isArray(confined.argv) || confined.argv.length === 0) {
        resolve5(reject("\u6C99\u7BB1\u6CA1\u6709\u8FD4\u56DE\u53EF\u6267\u884C\u7684 argv\uFF0C\u6CA1\u6709\u6267\u884C"));
        return;
      }
      if (confined.enforcement !== void 0 && confined.enforcement !== "full") {
        resolve5(reject(`\u5BBF\u4E3B\u6C99\u7BB1\u53EA\u63D0\u4F9B\u90E8\u5206\u7EA6\u675F\uFF08enforcement=${confined.enforcement}\uFF09\uFF0C\u672C\u4F1A\u8BDD\u4E0D\u662F\u5B8C\u5168\u6743\u9650\uFF0C\u62D2\u7EDD\u6267\u884C`));
        return;
      }
      launch(confined.argv);
    }).catch((error) => {
      resolve5(reject(`\u6C99\u7BB1\u7EA6\u675F\u5931\u8D25\uFF0C\u6CA1\u6709\u6267\u884C\uFF1A${error instanceof Error ? error.message : String(error)}`));
    });
  });
}

// src/optimize-tools.ts
import { existsSync as existsSync5, readdirSync as readdirSync3, readFileSync as readFileSync4, realpathSync as realpathSync2, statSync as statSync4 } from "node:fs";
import { basename, dirname as dirname6, join as join6, resolve as resolve3, sep as sep2 } from "node:path";
var TOOL_MAX_FILE_BYTES = 200 * 1024;
var TOOL_MAX_RESULT_CHARS = 4e3;
var TOOL_MAX_FILES = 400;
var TOOL_MAX_GLOB_HITS = 50;
var TOOL_MAX_GREP_HITS = 40;
var TOOL_MAX_DEPTH = 6;
var TOOL_MAX_CALLS_PER_ROUND = 3;
var TOOL_MAX_ROUNDS = 3;
var TOOL_TOTAL_TIMEOUT_MS = 2e4;
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".svn", ".hg", "dist", "build", "out", "coverage", ".next", ".cache"]);
var looksBinary = (buffer) => buffer.includes(0);
var READ_TOOL_SCHEMAS = [
  {
    name: "read",
    description: '\u8BFB\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185\u7684\u4E00\u4E2A\u6587\u672C\u6587\u4EF6\uFF08\u53EA\u8BFB\uFF09\u3002\u9002\u5408\u786E\u8BA4"\u8FD9\u4E2A\u6587\u4EF6\u73B0\u5728\u662F\u600E\u4E48\u5199\u7684"\u3002',
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "\u76F8\u5BF9\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u7684\u8DEF\u5F84\uFF08\u4E5F\u63A5\u53D7\u76EE\u5F55\u5185\u7684\u7EDD\u5BF9\u8DEF\u5F84\uFF09" }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  {
    name: "glob",
    description: '\u6309\u901A\u914D\u7B26\u5217\u51FA\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185\u7684\u6587\u4EF6\uFF08\u53EA\u8BFB\uFF09\u3002\u652F\u6301 ** / * / ?\uFF0C\u7528\u4E8E\u786E\u8BA4"\u6709\u54EA\u4E9B\u6587\u4EF6"\u3002',
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "\u4F8B\u5982 src/**/*.ts \u6216 *.md" }
      },
      required: ["pattern"],
      additionalProperties: false
    }
  },
  {
    name: "grep",
    description: "\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185\u7684\u6587\u672C\u6587\u4EF6\u91CC\u6309\u6B63\u5219\u627E\u5185\u5BB9\uFF08\u53EA\u8BFB\uFF09\uFF0C\u8FD4\u56DE\u8DEF\u5F84\u3001\u884C\u53F7\u4E0E\u90A3\u4E00\u884C\u7684\u7247\u6BB5\u3002",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JavaScript \u6B63\u5219\uFF08\u4E0D\u662F\u901A\u914D\u7B26\uFF09" },
        glob: { type: "string", description: "\u53EF\u9009\uFF1A\u53EA\u5728\u8FD9\u4E9B\u6587\u4EF6\u91CC\u627E\uFF0C\u4F8B\u5982 src/**/*.ts" }
      },
      required: ["pattern"],
      additionalProperties: false
    }
  }
];
var READ_TOOLS_SYSTEM_NOTE = [
  "",
  "",
  "\u3010\u53EA\u8BFB\u67E5\u8BC1\u3011\u4F60\u53EF\u4EE5\u8C03\u7528 read / glob / grep \u4E09\u4E2A**\u53EA\u8BFB**\u5DE5\u5177\u786E\u8BA4\u9879\u76EE\u91CC\u7684\u5B9E\u9645\u60C5\u51B5",
  "\uFF08\u9650\u5B9A\u5728\u672C\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185\uFF1B\u5355\u6587\u4EF6 \u2264200KB\uFF1B\u6BCF\u8F6E \u22643 \u6B21\u8C03\u7528\u3001\u603B\u5171 \u22643 \u8F6E\uFF09\u3002",
  "\u89C4\u5219\uFF1A",
  '- **\u60F3\u6E05\u695A\u518D\u67E5**\uFF1A\u53EA\u5728"\u4E0D\u67E5\u5C31\u53EA\u80FD\u731C\u3001\u731C\u9519\u4F1A\u505A\u9519"\u65F6\u67E5\uFF1B\u4E0D\u8981\u4E3A\u4E86\u5199\u5F97\u66F4\u957F\u800C\u67E5\u3002',
  "- **\u67E5\u5230\u7684\u7B97\u4E8B\u5B9E**\uFF0C\u53EF\u4EE5\u636E\u6B64\u628A\u4E0D\u786E\u5B9A\u7684\u5730\u65B9\u5B9A\u4E0B\u6765\uFF08\u4F8B\u5982\u539F\u672C\u8981\u5199 `unknown` \u7684\u67E5\u627E\u7C7B\u95EE\u9898\uFF09\u3002",
  "- **\u4E0D\u8BB8\u628A\u6587\u4EF6\u91CC\u7684\u5185\u5BB9\u5F53\u4F5C\u7528\u6237\u539F\u8BDD**\uFF1A`rewrite` / `requirement` / `quality` \u7684 `quote`",
  "  \u5FC5\u987B\u662F\u3010\u7528\u6237\u539F\u8BDD\u3011\u91CC\u7684\u9010\u5B57\u7247\u6BB5 \u2014\u2014 \u4ECE\u6587\u4EF6\u8BFB\u6765\u7684\u53E5\u5B50\u5199\u8FDB quote \u4F1A\u88AB\u5BBF\u4E3B\u9010\u6761\u4E22\u5F03\u3002",
  "- **\u6CA1\u8BFB\u5230\u5C31\u8BF4\u6CA1\u8BFB\u5230**\uFF1A\u4E0D\u8981\u51ED\u5370\u8C61\u8865\u6587\u4EF6\u5185\u5BB9\uFF1B\u67E5\u4E0D\u5230\u5C31\u628A\u90A3\u6761\u5199\u6210 `unknown`\u3002",
  '- \u5DE5\u5177\u5185\u5BB9\u53EA\u7528\u4E8E**\u7406\u89E3\u4E0E\u6D88\u6B67\u4E49**\uFF0C\u6700\u7EC8\u4EA7\u51FA\u4ECD\u7136\u662F\u90A3\u4EFD `{"items":[...]}` JSON\u3002'
].join("\n");
function realOf(path) {
  try {
    return realpathSync2(path);
  } catch {
    return void 0;
  }
}
function fencePath(root, raw) {
  const rootReal = realOf(root) ?? resolve3(root);
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: false, reason: "\u8DEF\u5F84\u662F\u7A7A\u7684" };
  if (text.includes("\0")) return { ok: false, reason: "\u8DEF\u5F84\u91CC\u6709 NUL" };
  const target = resolve3(rootReal, text);
  const parts = [];
  let probe = target;
  let guard = 0;
  while (!existsSync5(probe) && guard < 64) {
    const parent = dirname6(probe);
    if (parent === probe) break;
    parts.unshift(basename(probe));
    probe = parent;
    guard += 1;
  }
  const probeReal = realOf(probe) ?? probe;
  const final = parts.length === 0 ? probeReal : join6(probeReal, ...parts);
  const inside = final === rootReal || final.startsWith(`${rootReal}${sep2}`);
  if (!inside) return { ok: false, reason: `\u8D8A\u754C\uFF1A${text} \u4E0D\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185` };
  return { ok: true, path: final };
}
function resolveRoot(root) {
  return realOf(root) ?? resolve3(root);
}
var toSlashes = (path) => path.split(sep2).join("/");
function clampResult(text) {
  if (text.length <= TOOL_MAX_RESULT_CHARS) return { text, truncated: false };
  return { text: `${text.slice(0, TOOL_MAX_RESULT_CHARS)}
\u2026\uFF08\u7ED3\u679C\u8D85\u957F\uFF0C\u53EA\u7ED9\u4E86\u524D ${TOOL_MAX_RESULT_CHARS} \u5B57\uFF09`, truncated: true };
}
function globToRegExp(pattern2) {
  const escaped = String(pattern2 ?? "").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\0").replace(/\*\*/g, "").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*");
  return new RegExp(`^${escaped}$`);
}
function walk(root, pattern2, visit, limit) {
  const rows = [];
  let files = 0;
  let truncated = false;
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === void 0) break;
    if (files >= TOOL_MAX_FILES || rows.length >= limit) {
      truncated = true;
      break;
    }
    let entries;
    try {
      entries = readdirSync3(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (rows.length >= limit || files >= TOOL_MAX_FILES) {
        truncated = true;
        break;
      }
      if (entry.name.startsWith(".")) continue;
      const absolute = join6(current.dir, entry.name);
      const relative2 = toSlashes(absolute.slice(root.length + 1));
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (current.depth + 1 > TOOL_MAX_DEPTH) continue;
        queue.push({ dir: absolute, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (pattern2 !== null && !pattern2.test(relative2)) continue;
      files += 1;
      const row = visit(relative2, absolute);
      if (row !== void 0) rows.push(row);
    }
  }
  return { files, rows, truncated };
}
function runReadTool(rootInput, args) {
  const root = resolveRoot(rootInput);
  const row = typeof args === "object" && args !== null ? args : {};
  const raw = typeof row.path === "string" ? row.path : "";
  const fenced = fencePath(root, raw);
  if (!fenced.ok) {
    return { text: `\u62D2\u7EDD\uFF1A${fenced.reason}`, isError: true, meta: { tool: "read", files: 0, hits: 0, bytes: 0, rejected: fenced.reason } };
  }
  try {
    const info = statSync4(fenced.path);
    if (!info.isFile()) {
      return { text: `\u62D2\u7EDD\uFF1A${raw} \u4E0D\u662F\u6587\u4EF6`, isError: true, meta: { tool: "read", files: 0, hits: 0, bytes: 0, rejected: "\u4E0D\u662F\u6587\u4EF6" } };
    }
    if (info.size > TOOL_MAX_FILE_BYTES) {
      const reason = `\u6587\u4EF6 ${info.size} \u5B57\u8282\uFF0C\u8D85\u8FC7\u4E0A\u9650 ${TOOL_MAX_FILE_BYTES}`;
      return { text: `\u62D2\u7EDD\uFF1A${reason}`, isError: true, meta: { tool: "read", files: 0, hits: 0, bytes: info.size, rejected: reason } };
    }
    const buffer = readFileSync4(fenced.path);
    if (looksBinary(buffer)) {
      return { text: "\u62D2\u7EDD\uFF1A\u8FD9\u662F\u4E8C\u8FDB\u5236\u6587\u4EF6", isError: true, meta: { tool: "read", files: 0, hits: 0, bytes: info.size, rejected: "\u4E8C\u8FDB\u5236\u6587\u4EF6" } };
    }
    const clamped = clampResult(buffer.toString("utf8"));
    const relative2 = fenced.path.slice(root.length + 1) === "" ? "." : toSlashes(fenced.path.slice(root.length + 1));
    return {
      text: `\u3010${relative2}\u3011
${clamped.text}${clamped.truncated ? "" : ""}`,
      isError: false,
      meta: { tool: "read", files: 1, hits: 0, bytes: info.size }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { text: `\u8BFB\u5931\u8D25\uFF1A${reason}`, isError: true, meta: { tool: "read", files: 0, hits: 0, bytes: 0, rejected: reason } };
  }
}
function runGlobTool(rootInput, args) {
  const root = resolveRoot(rootInput);
  const row = typeof args === "object" && args !== null ? args : {};
  const rawPattern = typeof row.pattern === "string" ? row.pattern.trim() : "";
  if (rawPattern === "") {
    return { text: "\u62D2\u7EDD\uFF1Apattern \u662F\u7A7A\u7684", isError: true, meta: { tool: "glob", files: 0, hits: 0, bytes: 0, rejected: "pattern \u662F\u7A7A\u7684" } };
  }
  if (rawPattern.startsWith("/") || rawPattern.startsWith("\\") || rawPattern.split("/").includes("..")) {
    const reason = `\u8D8A\u754C\uFF1A\u6A21\u5F0F ${rawPattern} \u6307\u5230\u5DE5\u4F5C\u76EE\u5F55\u4E4B\u5916`;
    return { text: `\u62D2\u7EDD\uFF1A${reason}`, isError: true, meta: { tool: "glob", files: 0, hits: 0, bytes: 0, rejected: reason } };
  }
  const pattern2 = globToRegExp(rawPattern);
  const hit = walk(root, pattern2, (relative2) => relative2, TOOL_MAX_GLOB_HITS);
  const head = hit.rows.length === 0 ? "\uFF08\u6CA1\u6709\u5339\u914D\u7684\u6587\u4EF6\uFF09" : hit.rows.map((row2) => `- ${row2}`).join("\n");
  const notes = [
    hit.truncated ? `\uFF08\u8FD8\u6709\u66F4\u591A\uFF0C\u5DF2\u5230\u4E0A\u9650\uFF1A${TOOL_MAX_GLOB_HITS} \u547D\u4E2D / ${TOOL_MAX_FILES} \u6587\u4EF6\uFF09` : ""
  ].filter(Boolean);
  return {
    text: [`\u6A21\u5F0F\uFF1A${rawPattern}`, head, ...notes].join("\n"),
    isError: false,
    meta: { tool: "glob", files: hit.files, hits: hit.rows.length, bytes: 0 }
  };
}
function runGrepTool(rootInput, args) {
  const root = resolveRoot(rootInput);
  const row = typeof args === "object" && args !== null ? args : {};
  const rawPattern = typeof row.pattern === "string" ? row.pattern : "";
  if (rawPattern === "") {
    return { text: "\u62D2\u7EDD\uFF1Apattern \u662F\u7A7A\u7684", isError: true, meta: { tool: "grep", files: 0, hits: 0, bytes: 0, rejected: "pattern \u662F\u7A7A\u7684" } };
  }
  let matcher;
  try {
    matcher = new RegExp(rawPattern);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { text: `\u62D2\u7EDD\uFF1A\u6B63\u5219\u4E0D\u5408\u6CD5\uFF08${reason}\uFF09`, isError: true, meta: { tool: "grep", files: 0, hits: 0, bytes: 0, rejected: "\u6B63\u5219\u4E0D\u5408\u6CD5" } };
  }
  const rawGlob = typeof row.glob === "string" ? row.glob.trim() : "";
  if (rawGlob !== "" && (rawGlob.startsWith("/") || rawGlob.split("/").includes(".."))) {
    const reason = `\u8D8A\u754C\uFF1Aglob ${rawGlob} \u6307\u5230\u5DE5\u4F5C\u76EE\u5F55\u4E4B\u5916`;
    return { text: `\u62D2\u7EDD\uFF1A${reason}`, isError: true, meta: { tool: "grep", files: 0, hits: 0, bytes: 0, rejected: reason } };
  }
  const fileFilter = rawGlob === "" ? null : globToRegExp(rawGlob);
  const hit = walk(root, fileFilter, (relative2, absolute) => {
    let info;
    try {
      info = statSync4(absolute);
    } catch {
      return void 0;
    }
    if (info.size > TOOL_MAX_FILE_BYTES) return void 0;
    let buffer;
    try {
      buffer = readFileSync4(absolute);
    } catch {
      return void 0;
    }
    if (looksBinary(buffer)) return void 0;
    const lines = buffer.toString("utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (matcher.test(line)) {
        return `${relative2}:${index + 1}: ${line.trim().slice(0, 200)}`;
      }
    }
    return void 0;
  }, TOOL_MAX_GREP_HITS);
  const head = hit.rows.length === 0 ? "\uFF08\u6CA1\u6709\u547D\u4E2D\uFF09" : hit.rows.join("\n");
  const notes = hit.truncated ? `\uFF08\u8FD8\u6709\u66F4\u591A\uFF0C\u5DF2\u5230\u4E0A\u9650\uFF1A${TOOL_MAX_GREP_HITS} \u547D\u4E2D\uFF09` : "";
  return {
    text: [`\u6B63\u5219\uFF1A${rawPattern}`, head, notes].filter((line) => line !== "").join("\n"),
    isError: false,
    meta: { tool: "grep", files: hit.files, hits: hit.rows.length, bytes: 0 }
  };
}
function runReadToolByName(root, name2, args) {
  if (name2 === "read") return runReadTool(root, args);
  if (name2 === "glob") return runGlobTool(root, args);
  if (name2 === "grep") return runGrepTool(root, args);
  return {
    text: `\u62D2\u7EDD\uFF1A\u4E0D\u8BA4\u8BC6\u7684\u5DE5\u5177 ${name2}\uFF08\u53EA\u6709 read / glob / grep\uFF09`,
    isError: true,
    meta: { tool: name2, files: 0, hits: 0, bytes: 0, rejected: "\u4E0D\u8BA4\u8BC6\u7684\u5DE5\u5177" }
  };
}
function parseToolArguments(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return { args: {} };
  try {
    return { args: JSON.parse(text) };
  } catch (error) {
    return { args: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

// src/optimize-tool-loop.ts
var freezeMessages = (messages) => messages;
async function runOptimizeToolLoop(deps) {
  const started = Date.now();
  const maxChars = deps.maxChars ?? 48e3;
  const messages = [{
    id: `optimize-${started.toString(36)}`,
    role: "user",
    content: [{ type: "text", text: deps.userText }],
    source: { kind: "user" }
  }];
  const names = [];
  let calls = 0;
  let rejected = 0;
  let rounds = 0;
  let capped = false;
  let out = "";
  let failure = "";
  for (let round = 1; round <= TOOL_MAX_ROUNDS; round += 1) {
    if (Date.now() - started > TOOL_TOTAL_TIMEOUT_MS) {
      capped = true;
      break;
    }
    rounds = round;
    let text = "";
    const pending = /* @__PURE__ */ new Map();
    try {
      const stream = deps.llm.stream({
        provider: deps.provider,
        model: deps.model,
        system: deps.system,
        ...deps.temperature === void 0 ? {} : { temperature: deps.temperature },
        ...deps.reasoningEffort === void 0 || deps.reasoningEffort === "" ? {} : { reasoningEffort: deps.reasoningEffort },
        tools: deps.bash === true ? [...READ_TOOL_SCHEMAS, BASH_TOOL_SCHEMA] : READ_TOOL_SCHEMAS,
        ...deps.signal === void 0 ? {} : { signal: deps.signal },
        messages: freezeMessages(messages)
      });
      for await (const chunk of stream) {
        if (chunk.type === "text-delta") {
          const delta = String(chunk.text ?? "");
          text += delta;
          deps.onDelta?.(text, delta);
          if (text.length > maxChars) break;
        } else if (chunk.type === "tool-call-delta") {
          const index = Number(chunk.index ?? 0);
          const current = pending.get(index) ?? { id: "", name: "", args: "" };
          if (typeof chunk.id === "string" && chunk.id !== "") current.id = chunk.id;
          if (typeof chunk.name === "string" && chunk.name !== "") current.name = chunk.name;
          current.args += String(chunk.argumentsDelta ?? "");
          pending.set(index, current);
        } else if (chunk.type === "block-end") {
          const block = chunk.block;
          if (block !== void 0 && block.type === "tool-call") {
            const index = Number(chunk.index ?? 0);
            pending.set(index, {
              id: String(block.id ?? ""),
              name: String(block.name ?? ""),
              args: String(block.arguments ?? "")
            });
          }
        } else if (chunk.type === "finish") {
          const reason = typeof chunk.reason === "object" && chunk.reason !== null ? chunk.reason : {};
          if (reason.kind === "error" || reason.kind === "aborted") {
            const detail = typeof reason.failure === "object" && reason.failure !== null ? reason.failure : {};
            failure = String(detail.message ?? (reason.kind === "aborted" ? "\u4F18\u5316\u88AB\u4E2D\u65AD" : "\u6A21\u578B\u8FD4\u56DE\u9519\u8BEF"));
          }
        }
      }
    } catch (error) {
      return {
        out,
        failure: error instanceof Error ? error.message : String(error),
        rounds,
        calls,
        names,
        capped,
        rejected,
        elapsedMs: Date.now() - started
      };
    }
    out = text;
    if (failure !== "") break;
    const ordered = [...pending.entries()].sort(([a], [b]) => a - b).map(([, call]) => call).filter((call) => call.name !== "");
    if (ordered.length === 0) break;
    if (round >= TOOL_MAX_ROUNDS) {
      capped = true;
      break;
    }
    if (ordered.length > TOOL_MAX_CALLS_PER_ROUND) capped = true;
    const batch = ordered.slice(0, TOOL_MAX_CALLS_PER_ROUND);
    messages.push({
      id: `optimize-assistant-${round}-${started.toString(36)}`,
      role: "assistant",
      source: { kind: "model", provider: deps.provider, model: deps.model },
      content: [
        ...text === "" ? [] : [{ type: "text", text }],
        ...batch.map((call) => ({ type: "tool-call", id: call.id, name: call.name, arguments: call.args }))
      ]
    });
    for (const call of batch) {
      if (calls >= TOOL_MAX_CALLS_PER_ROUND * TOOL_MAX_ROUNDS) {
        capped = true;
        break;
      }
      calls += 1;
      names.push(call.name);
      const parsed = parseToolArguments(call.args);
      const result = parsed.error !== void 0 ? {
        text: `\u62D2\u7EDD\uFF1A\u5DE5\u5177\u53C2\u6570\u4E0D\u662F\u5408\u6CD5 JSON\uFF08${parsed.error}\uFF09`,
        isError: true,
        meta: { tool: call.name, files: 0, hits: 0, bytes: 0, rejected: "\u53C2\u6570\u4E0D\u662F\u5408\u6CD5 JSON" }
      } : call.name === BASH_TOOL_NAME2 ? await runBashTool(deps.root, parsed.args, { signal: deps.signal, ...deps.bashConfine === void 0 ? {} : { confine: deps.bashConfine } }) : runReadToolByName(deps.root, call.name, parsed.args);
      if (result.meta.rejected !== void 0) rejected += 1;
      messages.push({
        id: `optimize-tool-${round}-${calls}-${started.toString(36)}`,
        role: "tool",
        source: { kind: "tool", callId: call.id },
        toolCallId: call.id,
        content: [{ type: "text", text: result.text }],
        ...result.isError ? { isError: true } : {}
      });
    }
  }
  return { out, failure, rounds, calls, names, capped, rejected, elapsedMs: Date.now() - started };
}

// src/prompt-context.ts
var ELLIPSIS = "\u2026";
var objectOf2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
var textOf2 = (value) => typeof value === "string" ? value : "";
function messageTextOf(message) {
  const row = objectOf2(message);
  if (row === void 0) return "";
  const content = row.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const raw of content) {
    const block = objectOf2(raw);
    if (block === void 0) continue;
    if (textOf2(block.type) !== "text") continue;
    const text = textOf2(block.text);
    if (text !== "") parts.push(text);
  }
  return parts.join("\n").trim();
}
function recentTurns(snapshot2, turns = OPTIMIZER_CONTEXT_TURNS) {
  const row = objectOf2(snapshot2);
  const events = Array.isArray(row?.events) ? row.events : [];
  const collected = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = objectOf2(events[index]);
    const type = textOf2(event?.type);
    const data = objectOf2(event?.data);
    if (type === "user/message") {
      if (data === void 0) continue;
      const source = objectOf2(data.source);
      if (source !== void 0 && textOf2(source.kind) !== "user") continue;
      const text = messageTextOf(data);
      if (text !== "") collected.push({ index, role: "user", text });
      continue;
    }
    if (type === "assistant/message") {
      const text = messageTextOf(data?.message);
      if (text !== "") collected.push({ index, role: "assistant", text });
    }
  }
  const users = collected.filter((item) => item.role === "user").slice(-Math.max(0, turns));
  const assistants = collected.filter((item) => item.role === "assistant").slice(-Math.max(0, turns));
  return [...users, ...assistants].sort((left, right) => left.index - right.index).map((item) => ({ role: item.role, text: item.text }));
}
function clipTail(text, max) {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  return `${ELLIPSIS}${text.slice(text.length - (max - ELLIPSIS.length))}`;
}
function contextWithinBudget(turns, limits = {}) {
  const maxChars = limits.maxChars ?? OPTIMIZER_CONTEXT_MAX_CHARS;
  const turnMax = limits.turnMaxChars ?? OPTIMIZER_CONTEXT_TURN_MAX_CHARS;
  const clipped = turns.map((turn) => ({ role: turn.role, text: clipTail(turn.text, turnMax) }));
  if (clipped.length === 0) return clipped;
  let total = clipped.reduce((sum, turn) => sum + turn.text.length, 0);
  let dropped = 0;
  while (total > maxChars && dropped < clipped.length - 1) {
    total -= clipped[dropped].text.length;
    dropped += 1;
  }
  const kept = clipped.slice(dropped);
  if (kept.length === 1 && kept[0].text.length > maxChars) {
    return [{ role: kept[0].role, text: clipTail(kept[0].text, Math.max(maxChars, ELLIPSIS.length)) }];
  }
  return kept;
}
function contextBlock(turns) {
  return turns.map((turn) => `${turn.role === "user" ? "\u7528\u6237" : "\u5DE5\u4F5C AI"}\uFF1A${turn.text}`).join("\n");
}

// src/migrations.ts
var MIGRATIONS = [
  {
    version: 1,
    field: "headerCleanupVersion",
    label: "\u6E05\u7406 0.21.x \u53CA\u4EE5\u524D\u5199\u8FDB\u7528\u6237\u6A21\u578B\u8DEF\u7531\u914D\u7F6E\u91CC\u7684\u8BF7\u6C42\u5934\uFF08\u6539\u6210\u8FD0\u884C\u671F\u8986\u76D6\u540E\u4E0D\u518D\u9700\u8981\u843D\u76D8\uFF09"
  }
];
function migrationVersionOf(own, field) {
  const value = own === void 0 ? void 0 : own[field];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function pendingMigrations(own, rows = MIGRATIONS) {
  return rows.filter((row) => migrationVersionOf(own, row.field) < row.version).slice().sort((left, right) => left.version - right.version);
}

// src/autostart.ts
var RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
var AUTOSTART_ENTRY_PREFIX = "dsh-composer-ux:autostart:";
function autostartEntryName(profile) {
  return `${AUTOSTART_ENTRY_PREFIX}${profile === "" ? "default" : profile}`;
}
function unsupportedReason(platform) {
  return platform === "win32" ? "" : "\u53EA\u5728 Windows \u4E0A\u652F\u6301\uFF08\u5176\u5B83\u5E73\u53F0\u6CA1\u6709\u767B\u5F55\u542F\u52A8\u9879\uFF09";
}
function quote(value) {
  return `"${value.replace(/"/g, "")}"`;
}
function planAutostart(facts) {
  const entryName = autostartEntryName(facts.profile);
  if (facts.runtime === "desktop") {
    return {
      entryName,
      value: quote(facts.desktopExe),
      describe: `\u767B\u5F55\u540E\u542F\u52A8\u684C\u9762\u5E94\u7528\uFF1A${facts.desktopExe}`
    };
  }
  const { file, args, cwd, viaShell } = facts.launch;
  const parts = [];
  if (viaShell) parts.push("cmd.exe", "/c");
  parts.push(quote(file));
  for (const arg of args) parts.push(quote(arg));
  const command = parts.join(" ");
  const launcherPath = `${facts.stateDir}\\autostart-${facts.profile === "" ? "default" : facts.profile}.vbs`;
  const escaped = command.replace(/"/g, '""');
  const content = [
    "' dsh-composer-ux\uFF1A\u767B\u5F55\u81EA\u542F\u52A8\uFF08\u7F51\u9875\u7248\uFF09\u3002\u7531\u8BBE\u7F6E\u9875\u300C\u81EA\u542F\u52A8\u300D\u5F00\u5173\u751F\u6210/\u5220\u9664\uFF0C\u522B\u624B\u6539 \u2014\u2014",
    "' \u5173\u6389\u5F00\u5173\u65F6\u8FD9\u4E2A\u6587\u4EF6\u4F1A\u88AB\u5220\u9664\uFF1B\u60F3\u6362\u542F\u52A8\u53C2\u6570\u8BF7\u5728\u8BBE\u7F6E\u9875\u91CC\u6539\uFF0C\u4E0D\u8981\u76F4\u63A5\u7F16\u8F91\u8FD9\u91CC\u3002",
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = "${cwd.replace(/"/g, "")}"`,
    "' 7 = \u6700\u5C0F\u5316\u4E14\u4E0D\u62A2\u7126\u70B9\uFF1BFalse = \u4E0D\u7B49\u5B83\u7ED3\u675F",
    `shell.Run "${escaped}", 7, False`,
    ""
  ].join("\r\n");
  return {
    entryName,
    value: `wscript.exe ${quote(launcherPath)}`,
    launcher: { path: launcherPath, content },
    describe: `\u767B\u5F55\u540E\u6700\u5C0F\u5316\u542F\u52A8\u7F51\u9875\u7248\uFF1A${command}`
  };
}
function runtimeOf(argv1) {
  return /dsh-desktop-host/iu.test(argv1 ?? "") ? "desktop" : "web";
}
function listArgs() {
  return ["query", RUN_KEY];
}
function addArgs(entryName, value) {
  return ["add", RUN_KEY, "/v", entryName, "/t", "REG_SZ", "/d", value, "/f"];
}
function deleteArgs(entryName) {
  return ["delete", RUN_KEY, "/v", entryName, "/f"];
}
function parseQueryValue(entryName, stdout) {
  for (const rawLine of stdout.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line.startsWith(entryName)) continue;
    const rest = line.slice(entryName.length).trim();
    const match = /^REG_[A-Z_]+\s+([\s\S]*)$/u.exec(rest);
    if (match === null) continue;
    return match[1].trim();
  }
  return void 0;
}
function describeAutostart(input) {
  const supported = input.platform === "win32";
  const enabled = input.registered !== void 0 && input.registered !== "";
  const stale = enabled && input.registered !== input.plan.value;
  const note = !supported ? "\u53EA\u5728 Windows \u4E0A\u6709\u610F\u4E49\uFF08\u5176\u5B83\u5E73\u53F0\u6CA1\u6709\u767B\u5F55\u542F\u52A8\u9879\u8FD9\u4E2A\u6982\u5FF5\uFF0C\u672C\u680F\u4E0D\u751F\u6548\uFF09" : input.readError !== "" ? `\u8BFB\u4E0D\u5230\u542F\u52A8\u9879\uFF1A${input.readError}` : stale ? "\u2757\u6CE8\u518C\u8868\u91CC\u90A3\u6761\u4E0E\u5F53\u524D\u8FDB\u7A0B\u7B97\u51FA\u6765\u7684\u4E0D\u4E00\u81F4\uFF08\u53EF\u80FD\u662F\u522B\u7684 profile \u6216\u65E7\u7248\u672C\u7559\u4E0B\u7684\uFF09\uFF1A\u767B\u5F55\u540E\u4F1A\u8DD1\u65E7\u547D\u4EE4\uFF0C\u5EFA\u8BAE\u5173\u6389\u518D\u6253\u5F00\u4E00\u6B21" : "";
  return {
    supported,
    enabled,
    entryName: input.plan.entryName,
    registeredValue: input.registered ?? "",
    expectedValue: input.plan.value,
    describe: input.plan.describe,
    note
  };
}

// src/doctor.ts
function missingSchemaFields(input) {
  const keys = new Set(input.schemaKeys);
  return input.fieldConstants.filter((name2) => !keys.has(name2)).slice().sort();
}
function enabledSections(sections) {
  return Object.entries(sections).filter(([, on]) => on === true).map(([name2]) => name2).sort();
}
function buildDoctorReport(input) {
  const rows = [];
  const missing = missingSchemaFields(input);
  rows.push({
    id: "settings.schema",
    label: "\u8BBE\u7F6E\u5B57\u6BB5\u90FD\u5728\u5BBF\u4E3B schema \u91CC",
    level: missing.length === 0 ? "ok" : "fail",
    detail: missing.length === 0 ? `${String(input.fieldConstants.length)} \u4E2A\u5B57\u6BB5\u5168\u90E8\u58F0\u660E\uFF08\u4E0D\u7136\u5199\u8BBE\u7F6E\u4F1A\u88AB settings.mutate \u62D2\u7EDD\uFF09` : `\u7F3A ${missing.join("\u3001")} \u2014\u2014 \u5199\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5BBF\u4E3B\u62D2\u7EDD\uFF08Config field is not volatile\uFF09`
  });
  rows.push({
    id: "plugin.switch",
    label: "\u63D2\u4EF6\u603B\u5F00\u5173",
    level: input.enabled ? "ok" : "info",
    detail: input.enabled ? "\u5F00\u542F\u4E2D" : "\u5DF2\u5173\u95ED\uFF08\u680F\u5185\u8BBE\u7F6E\u5168\u90E8\u4FDD\u7559\uFF09"
  });
  const on = enabledSections(input.sections);
  rows.push({
    id: "sections",
    label: "\u5404\u680F\u76EE\u5F00\u5173",
    level: "info",
    detail: on.length === 0 ? "\u516B\u680F\u5168\u5173\uFF08\u672C\u63D2\u4EF6\u76EE\u524D\u5B8C\u5168\u4E0D\u4ECB\u5165\uFF09" : `\u5F00\u7740\uFF1A${on.join("\u3001")}`
  });
  const persistent = input.persistentTerminals;
  rows.push({
    id: "terminals.persistent",
    label: "\u6301\u4E45\u7EC8\u7AEF\u5DE5\u5177",
    level: persistent.mismatch ? "warn" : persistent.servicePresent ? "ok" : "info",
    detail: persistent.mismatch ? `\u2757\u88C5\u5728 profile \u91CC\u7684 tool-terminal ${persistent.toolVersion} \u8981\u6C42 ${persistent.peerRequired}\uFF0C\u800C profile \u91CC\u5B9E\u9645\u662F ${persistent.peerInstalled === "" ? "\uFF08\u8BFB\u4E0D\u5230\uFF09" : persistent.peerInstalled} \u21D2 \u5BBF\u4E3B\u4F1A\u7981\u7528\u8FD9\u4E00\u884C\uFF0C\u6A21\u578B\u62FF\u4E0D\u5230\u90A3 6 \u4E2A terminal_* \u5DE5\u5177\u3002\u4FEE\u6CD5\uFF1Adsh plugin --profile <\u540D\u5B57> add @deepseek-ai/dsh-tool-terminal@<\u8FD0\u884C\u65F6\u7248\u672C>` : persistent.servicePresent ? `\u5DF2\u6302\u4E0A\uFF1Btool-terminal ${persistent.toolVersion === "" ? "\uFF08\u8BFB\u4E0D\u5230\u7248\u672C\uFF09" : persistent.toolVersion}${persistent.peerRequired === "" ? "" : `\uFF08\u8981\u6C42 ${persistent.peerRequired}\uFF0Cprofile \u91CC ${persistent.peerInstalled === "" ? "\u8BFB\u4E0D\u5230" : persistent.peerInstalled}\uFF09`}` : "\u5BBF\u4E3B\u6CA1\u6709 ctx.terminals\uFF1A\u8FD9\u4E00\u6863\u6CA1\u6302\uFF08\u6A21\u578B\u6CA1\u6709\u6301\u4E45\u7EC8\u7AEF\u5DE5\u5177\uFF1B\u9700\u8981\u5B98\u65B9\u53EF\u9009 bundle \u6216 profile \u5C42\u88C5\u8FD9\u4E09\u4EF6\u5957\uFF09"
  });
  rows.push({
    id: "terminal",
    label: "\u9ED8\u8BA4\u7EC8\u7AEF",
    level: input.terminal.platform !== "win32" ? "info" : input.terminal.rowInstalled ? input.terminal.bashPath === "" ? "warn" : "ok" : "warn",
    detail: input.terminal.platform !== "win32" ? `\u975E Windows\uFF08${input.terminal.platform}\uFF09\uFF1A\u4E0D\u63A5\u7BA1\uFF0C\u7528\u5B98\u65B9 bash` : input.terminal.rowInstalled ? `\u5BBF\u4E3B\u7EC8\u7AEF\u670D\u52A1\u5728\uFF08ctx.terminals\uFF09\uFF1Bbash=${input.terminal.bashPath === "" ? "\u6CA1\u63A2\u6D4B\u5230\uFF08\u4F1A\u7528\u5B98\u65B9\u9ED8\u8BA4\uFF09" : input.terminal.bashPath}\uFF1B\u4F1A\u8BDD\u6A21\u5F0F=${input.terminal.mode}\uFF1B\u6C99\u7BB1\u670D\u52A1=${input.terminal.hasSandbox ? "\u6709" : "\u6CA1\u6709"}${input.terminal.status === "" ? "" : `\uFF1B${input.terminal.status}`}` : "\u5BBF\u4E3B\u6CA1\u6709\u7EC8\u7AEF\u670D\u52A1\uFF08ctx.terminals \u4E0D\u5728\uFF09\uFF1A\u8FD9\u4E00\u680F\u5373\u4FBF\u5F00\u7740\u4E5F\u63A5\u7BA1\u4E0D\u4E86"
  });
  rows.push({
    id: "header",
    label: "OpenCode \u8BF7\u6C42\u5934",
    level: input.header.writesUserConfig ? "fail" : !input.header.native && !input.header.overlayInstalled && input.header.status !== "" ? "warn" : "ok",
    detail: input.header.writesUserConfig ? "\u2757\u68C0\u6D4B\u5230\u5B83\u4ECD\u5728\u5199\u7528\u6237\u914D\u7F6E\uFF080.22.0 \u8D77\u5E94\u6539\u4E3A\u8FD0\u884C\u671F\u8986\u76D6\uFF09" : input.header.native ? `\u5BBF\u4E3B\u5DF2\u539F\u751F\u652F\u6301\uFF08${input.header.nativeEvidence}\uFF09\uFF1A\u6309\u6BCF\u6BB5\u5BF9\u8BDD\u7684\u771F\u5B9E session id \u81EA\u52A8\u53D1\u9001\uFF0C\u8FD9\u4E00\u680F\u4E0D\u9700\u8981\u3001\u4E5F\u4E0D\u4F1A\u6CE8\u5165` : `${input.header.overlayInstalled ? "\u8FD0\u884C\u671F\u8986\u76D6\u5DF2\u6302\u4E0A" : input.header.hasLoader ? "\u8986\u76D6\u6CA1\u6302\u4E0A" : "\u6CA1\u6709 loader \u670D\u52A1\uFF0C\u6302\u4E0D\u4E0A"}\uFF1B\u65E7\u5199\u5165\u6E05\u7406=${input.header.migrated ? "\u5DF2\u5B8C\u6210" : "\u672A\u5B8C\u6210"}${input.header.status === "" ? "\uFF1B\u5F53\u524D\u672A\u542F\u7528" : `\uFF1B${input.header.status}`}`
  });
  rows.push({
    id: "quick",
    label: "\u5FEB\u6377\u6307\u4EE4\u672C",
    level: input.quick.readable ? "ok" : "fail",
    detail: input.quick.readable ? `${input.quick.file}${input.quick.custom ? "\uFF08\u6709\u81EA\u5B9A\u4E49\u5185\u5BB9\uFF09" : "\uFF08\u5185\u7F6E 9 \u6761\uFF09"}` : `\u8BFB\u4E0D\u5230 ${input.quick.file}\uFF1A${input.quick.error === "" ? "\u672A\u77E5\u539F\u56E0" : input.quick.error}`
  });
  rows.push({
    id: "notify",
    label: "\u5FAE\u4FE1\u901A\u77E5",
    level: input.notify.enabled ? input.notify.credentialSet ? "ok" : "fail" : "info",
    detail: input.notify.enabled ? `${input.notify.channel}\uFF1A${input.notify.credentialSet ? "\u51ED\u636E\u5DF2\u8BBE\u7F6E" : "\u7F3A\u51ED\u636E\uFF08\u5F00\u5173\u662F\u5F00\u7684\uFF0C\u4F46\u53D1\u4E0D\u51FA\u53BB\uFF09"}` : "\u672A\u542F\u7528"
  });
  rows.push({
    id: "optimize",
    label: "\u63D0\u793A\u8BCD\u4F18\u5316",
    level: "info",
    detail: `\u6863\u4F4D=${input.optimize.tier}\uFF1B\u53EA\u8BFB\u67E5\u8BC1=${input.optimize.readTools ? "\u5F00" : "\u5173"}\uFF1B\u5185\u7F6E Bash=${input.optimize.bashOn ? `\u5F00\uFF08${input.optimize.bashGate}\uFF09` : "\u5173"}`
  });
  rows.push({
    id: "runtime",
    label: "\u8FD0\u884C\u73AF\u5883",
    level: "info",
    detail: `dsh-composer-ux ${input.version}\uFF1BDSH ${input.runtime.dshVersion === "" ? "\uFF08\u62FF\u4E0D\u5230\uFF09" : input.runtime.dshVersion}\uFF1Bnode ${input.runtime.node}`
  });
  return rows;
}

// src/settings-lock.ts
import { readFile as readFile3, rm } from "node:fs/promises";
import { dirname as dirname7, join as join7 } from "node:path";
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
  return dirname7(patchPath);
}
async function recoverStaleSettingsLock(profileDir, log) {
  const path = join7(profileDir, SETTINGS_LOCK_FILENAME);
  let content;
  try {
    content = await readFile3(path, "utf8");
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
var headerOverlayState = { installed: false };
var PANEL_MIN = 560;
var PANEL_MAX = 4e3;
var LLM_DEEPSEEK_NAMESPACE = "llm-deepseek";
var DEFAULT_NAV_FOLD = { mode: "bar", collapsed: true };
function navFoldStorePath() {
  const home = typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.length > 0 ? process.env.DSH_HOME : join8(process.getBuiltinModule("node:os").homedir(), ".dsh");
  return join8(home, "composer-ux-nav-fold.json");
}
var runtimeVersionCache;
function runtimeVersionOf() {
  if (runtimeVersionCache === void 0) runtimeVersionCache = detectRuntimeVersion();
  return runtimeVersionCache;
}
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
      if (typeof settings?.get === "function") return objectOf3(settings.get(ns));
      if (ns === NAMESPACE) {
        const own = objectOf3(plainConfig(config));
        if (own !== void 0) return own;
      }
      const row = (settings?.describe?.() ?? []).find((candidate) => candidate?.ns === ns);
      return objectOf3(row?.value);
    } catch {
      return void 0;
    }
  };
}
function objectOf3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function textOf3(value) {
  return typeof value === "string" ? value : "";
}
function readOwnSetting(scope, config, field) {
  try {
    const get = scope?.get;
    if (typeof get !== "function") return "";
    const service = get.call(scope, "settings");
    return textOf3(makeReader(service, config)(NAMESPACE)?.[field]);
  } catch {
    return "";
  }
}
function sessionCwdOf(snapshot2) {
  const header = objectOf3(objectOf3(snapshot2)?.header);
  return textOf3(header?.cwd);
}
function readOwnFlag(scope, config, field, fallback) {
  try {
    const get = scope?.get;
    if (typeof get !== "function") return fallback;
    const service = get.call(scope, "settings");
    const value = makeReader(service, config)(NAMESPACE)?.[field];
    return typeof value === "boolean" ? value : fallback;
  } catch {
    return fallback;
  }
}
function readOwnNumber(scope, config, field, fallback) {
  try {
    const get = scope?.get;
    if (typeof get !== "function") return fallback;
    const service = get.call(scope, "settings");
    const value = makeReader(service, config)(NAMESPACE)?.[field];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
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
  const raw = textOf3(value).trim();
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
    return keys.filter((key) => key.startsWith(OPENCODE_ROUTE_PREFIX) || isOpencodeBaseUrl(objectOf3(providers[key])?.baseURL));
  }
  return listed.filter((key) => Object.prototype.hasOwnProperty.call(providers, key));
}
function errorText3(error) {
  if (error instanceof Error && error.message !== "") return error.message;
  return String(error);
}
function readHeaderRequest(own) {
  if (own === void 0) return { kind: "off" };
  if (own[ENABLED_FIELD] !== true || own[HEADER_ENABLED_FIELD] !== true) return { kind: "off" };
  const name2 = textOf3(own[HEADER_NAME_FIELD]);
  if (!nameIsValid(name2)) return { kind: "invalid", reason: "\u5934\u540D\u4E0D\u5408\u6CD5" };
  const value = textOf3(own[HEADER_VALUE_FIELD]);
  if (!valueIsValid(value)) return { kind: "invalid", reason: `\u5934\u503C\u4E0D\u5408\u6CD5\uFF08\u9700 1\u2013${String(HEADER_VALUE_MAX)} \u5B57\u7B26\u4E14\u5355\u884C\uFF09` };
  const routes = parseRouteList(textOf3(own[HEADER_ROUTES_FIELD]));
  return { kind: "plan", name: name2, value, routes };
}
function withHeaderOverlay(raw, request) {
  const row = objectOf3(raw);
  const providers = row === void 0 ? void 0 : objectOf3(row.providers);
  if (row === void 0 || providers === void 0) return raw;
  const targets = pickRoutes(providers, request.routes);
  if (targets.length === 0) return raw;
  const nextProviders = { ...providers };
  for (const route of targets) {
    const profile = objectOf3(providers[route]);
    if (profile === void 0) continue;
    const headers = objectOf3(profile.headers) ?? {};
    nextProviders[route] = { ...profile, headers: { ...headers, [request.name]: request.value } };
  }
  return { ...row, providers: nextProviders };
}
function installHeaderOverlay(ctx, read, onInstalled, state = headerOverlayState) {
  const inject = ctx.inject;
  if (typeof inject !== "function") return state;
  try {
    ;
    inject.call(ctx, ["loader"], (loaderCtx) => {
      const on = loaderCtx?.on;
      if (typeof on !== "function") return;
      on.call(
        loaderCtx,
        "internal/config",
        function(_raw, next) {
          const raw = next();
          const request = readHeaderRequest(read(NAMESPACE));
          if (request.kind !== "plan") return raw;
          if (nativeSessionHeader().support === "native") return raw;
          return withHeaderOverlay(raw, request);
        }
      );
      state.installed = true;
      try {
        onInstalled();
      } catch (error) {
        console.error("[composer-ux] \u8BF7\u6C42\u5934\u8986\u76D6\u6302\u4E0A\u540E\u540C\u6B65\u72B6\u6001\u5931\u8D25", error);
      }
      return () => {
        state.installed = false;
      };
    });
  } catch (error) {
    console.error("[composer-ux] \u8FD0\u884C\u671F\u8BF7\u6C42\u5934\u8986\u76D6\u6302\u4E0D\u4E0A\uFF08\u7EE7\u7EED\u6309\u672A\u751F\u6548\u8FD0\u884C\uFF09", error);
  }
  return state;
}
async function syncHeaderOverlay(settings, read, hasLoader) {
  const own = read(NAMESPACE);
  if (own === void 0) return;
  const native = nativeSessionHeader();
  if (native.support !== "native" && own[ENABLED_FIELD] === true && own[HEADER_ENABLED_FIELD] === true) {
    const name2 = textOf3(own[HEADER_NAME_FIELD]);
    if (nameIsValid(name2) && textOf3(own[HEADER_VALUE_FIELD]) === "") {
      const generated = newSessionId();
      await retryWrite(() => settings.mutate(NAMESPACE, [{ op: "set", path: [HEADER_VALUE_FIELD], value: generated }]), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS);
      own[HEADER_VALUE_FIELD] = generated;
    }
  }
  const request = readHeaderRequest(own);
  const llm = read(LLM_NAMESPACE);
  const providers = llm === void 0 ? void 0 : objectOf3(llm.providers);
  const applied = request.kind === "plan" && providers !== void 0 ? pickRoutes(providers, request.routes) : [];
  const status = native.support === "native" ? `${NATIVE_STATUS_PREFIX}\uFF08${native.evidence}\uFF09\uFF1A\u6309\u6BCF\u6BB5\u5BF9\u8BDD\u7684\u771F\u5B9E session id \u81EA\u52A8\u53D1\u9001\uFF0C\u672C\u680F\u4E0D\u518D\u6CE8\u5165` : request.kind === "off" ? "" : request.kind === "invalid" ? `${request.reason}\uFF0C\u672A\u6CE8\u5165` : !hasLoader ? "\u6CA1\u627E\u5230 loader \u670D\u52A1\uFF0C\u8FD0\u884C\u671F\u8986\u76D6\u6302\u4E0D\u4E0A\uFF0C\u672A\u6CE8\u5165" : providers === void 0 ? "\u672A\u6302\u8F7D llm-pi-ai\uFF08\u6A21\u578B\u8DEF\u7531\uFF09\u8BBE\u7F6E\uFF0C\u6682\u672A\u6CE8\u5165" : applied.length === 0 ? `\u5DF2\u542F\u7528\uFF0C\u4F46\u6CA1\u6709\u5339\u914D\u7684\u8DEF\u7531\uFF08\u76EE\u6807\uFF1A${request.routes.length === 0 ? `\u81EA\u52A8\uFF08\u540D\u5B57\u4EE5 ${OPENCODE_ROUTE_PREFIX} \u5F00\u5934\uFF0C\u6216 baseURL \u6307\u5411 opencode.ai\uFF09` : request.routes.join("\u3001")}\uFF09` : `\u8FD0\u884C\u671F\u6CE8\u5165 ${applied.join("\u3001")}\uFF08\u53EA\u5728\u672C\u63D2\u4EF6\u8FD0\u884C\u65F6\u751F\u6548\uFF0C\u4E0D\u6539\u4F60\u7684\u914D\u7F6E\uFF09`;
  const ownOps = [];
  if (textOf3(own[HEADER_STATUS_FIELD]) !== status) {
    ownOps.push({ op: "set", path: [HEADER_STATUS_FIELD], value: status });
  }
  const injected = native.support !== "native" && request.kind === "plan" && applied.length > 0;
  const nextAppliedName = injected ? request.name : "";
  const nextAppliedValue = injected ? request.value : "";
  if (textOf3(own[HEADER_APPLIED_NAME_FIELD]) !== nextAppliedName) {
    ownOps.push({ op: "set", path: [HEADER_APPLIED_NAME_FIELD], value: nextAppliedName });
  }
  if (textOf3(own[HEADER_APPLIED_VALUE_FIELD]) !== nextAppliedValue) {
    ownOps.push({ op: "set", path: [HEADER_APPLIED_VALUE_FIELD], value: nextAppliedValue });
  }
  const headerCleanup = pendingMigrations(own).find((row) => row.field === HEADER_CLEANUP_FIELD);
  if (headerCleanup !== void 0) {
    const stale = collectOursToClean(own, providers, request);
    try {
      if (stale.length > 0) await retryWrite(() => settings.mutate(LLM_NAMESPACE, stale), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS);
      ownOps.push({ op: "set", path: [headerCleanup.field], value: headerCleanup.version });
    } catch (error) {
      console.error("[composer-ux] \u65E7\u8BF7\u6C42\u5934\u6E05\u7406\u5931\u8D25", error);
    }
  }
  if (ownOps.length > 0) await retryWrite(() => settings.mutate(NAMESPACE, ownOps), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS);
}
function collectOursToClean(own, providers, request) {
  if (providers === void 0) return [];
  const previousName = textOf3(own[HEADER_APPLIED_NAME_FIELD]);
  const previousValue = textOf3(own[HEADER_APPLIED_VALUE_FIELD]);
  const ours = /* @__PURE__ */ new Set([textOf3(own[HEADER_VALUE_FIELD]), previousValue]);
  ours.delete("");
  const candidates = /* @__PURE__ */ new Set([previousName, request.kind === "plan" ? request.name : ""]);
  candidates.delete("");
  const stale = [];
  for (const candidate of candidates) {
    for (const [route, profile] of Object.entries(providers)) {
      const headers = objectOf3(objectOf3(profile)?.headers);
      const current = headers?.[candidate];
      if (typeof current !== "string" || !ours.has(current)) continue;
      stale.push({ op: "unset", path: ["providers", route, "headers", candidate] });
    }
  }
  return stale;
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
    // 迁移标记（0.22.0，本插件自己的字段）：0/未设置 = 0.21.x 写进用户配置的头还没清理。
    [HEADER_CLEANUP_FIELD]: Schema.number().required(false),
    // 快捷指令列表：结构固定为 {id,label,prompt,always}，逐条自带默认值，
    // 让旧设置文档（没有这个键）在读取时直接得到内置 9 条。
    [QUICK_PROMPTS_FIELD]: Schema.array(Schema.object({
      id: Schema.string().default(""),
      label: Schema.string().default(""),
      prompt: Schema.string().default(""),
      always: Schema.boolean().default(false)
    })).default(DEFAULT_QUICK_PROMPTS.map((item) => ({ ...item }))),
    [OPTIMIZER_TIER_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerTier),
    // 优化时是否携带当前会话的近期往来（0.12.0；默认开，见契约里的说明）。
    [OPTIMIZER_CONTEXT_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.optimizerContext),
    // 逐轮台账（0.13.0；默认开）。只记元数据，见契约里的说明。
    [OPTIMIZER_LEDGER_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.optimizerLedger),
    // 重启后保留结果框（0.13.0；默认开）。这份状态文件里**有内容**，见契约里的说明。
    [OPTIMIZE_KEEP_DOCK_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.optimizeKeepDock),
    // 只读查证工具（0.13.0；默认关）。开了解释层才会派 read/glob/grep。
    [OPTIMIZE_READ_TOOLS_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.optimizeReadTools),
    // 0.14.0 优化选项卡片：协作基调 / 权限 / 模型 / 上下文模式 / 回合数 / 内置 Bash。
    // 枚举与数字都在读取层收窄（写坏了落回默认），schema 这层只保证类型不炸。
    [OPTIMIZER_FRAMING_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerFraming),
    [OPTIMIZER_PERMISSION_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerPermission),
    [OPTIMIZER_MODEL_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerModel),
    [OPTIMIZER_HISTORY_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerHistory),
    [OPTIMIZER_TURNS_FIELD]: Schema.number().default(DEFAULT_SETTINGS.optimizerTurns),
    [OPTIMIZE_BASH_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.optimizeBash),
    // 三档的自定义系统提示词：默认空串 = 用内置那份（空串同时就是「恢复内置」写回的值）。
    [OPTIMIZER_PROMPT_FIELDS.light]: Schema.string().default(DEFAULT_SETTINGS.optimizerPromptLight),
    [OPTIMIZER_PROMPT_FIELDS.standard]: Schema.string().default(DEFAULT_SETTINGS.optimizerPromptStandard),
    [OPTIMIZER_PROMPT_FIELDS.heavy]: Schema.string().default(DEFAULT_SETTINGS.optimizerPromptHeavy),
    // 旧字段名（0.14.0 改名）：继续注册，DSH 才不会把用户旧的自定义提示词当未知字段丢掉；
    // 读取层把它当成新字段的兜底（见 settings-contract 的迁移读）。
    [LEGACY_OPTIMIZER_PROMPT_FIELDS.light]: Schema.string().default(""),
    [LEGACY_OPTIMIZER_PROMPT_FIELDS.standard]: Schema.string().default(""),
    [LEGACY_OPTIMIZER_PROMPT_FIELDS.heavy]: Schema.string().default(""),
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
    [TERMINAL_EFFECTIVE_FIELD]: Schema.string().default(DEFAULT_SETTINGS.terminalEffective),
    // 「统计行」（0.7.0）。这一项**故意用 `.default(true)`**（与上面五栏的 `.required(false)`
    // 相反）：它没有"碰过才开"的迁移需求，默认就是开，且必须能被设置页写入
    // （写不进去 = 开关点了没反应，本插件为此专门有一条回读校验）。
    [STATS_ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.statsEnabled),
    // 「金额」（0.9.1）：用户覆盖价整张表（按模型 → 档 → 三项单价）。
    //
    // **故意用 `z.any()`**：键是用户自己加的模型名，schemastery 的对象 schema 表达不了动态键。
    // 形状检查交给 `parsePriceOverrides`（逐项宽容、坏项丢掉），schema 再拦一道反而会造出
    // "设置页写不进去"这种最难解释的故障 —— 写入路径只需这一项是 volatile（整个字段一起写，
    // 不做嵌套路径写），所以逐字段标记那一套照旧成立。
    [PRICE_OVERRIDES_FIELD]: Schema.any().required(false),
    // 「金额」（0.10.0）节假日表：北京日历日的 `YYYY-MM-DD` 数组。**普通数组字段**（键固定，
    // 不是动态键），所以声明得出来；不填 = 用内置那份（`pricing.ts` 的 DEFAULT_PEAK_HOLIDAYS）。
    [PEAK_HOLIDAYS_FIELD]: Schema.array(Schema.string()).required(false),
    // 「金额」（0.10.0）峰谷提醒：逐项给默认值，坏值由 `sanitizePeakAlert` 兜（不整份丢）。
    [PEAK_ALERT_FIELD]: Schema.object({
      enabled: Schema.boolean().default(DEFAULT_PEAK_ALERT.enabled),
      aheadMinutes: Schema.number().default(DEFAULT_PEAK_ALERT.aheadMinutes),
      onPeak: Schema.boolean().default(DEFAULT_PEAK_ALERT.onPeak),
      onOffPeak: Schema.boolean().default(DEFAULT_PEAK_ALERT.onOffPeak),
      webNotify: Schema.boolean().default(DEFAULT_PEAK_ALERT.webNotify)
    }).required(false),
    // 「金额」（0.10.0）余额开关：默认开。关掉 = 界面不显示余额行、也不发出网请求
    // （用户不想让插件碰官方接口时的总闸；**不等于**"查了但不显示"）。
    [BALANCE_ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.balanceEnabled),
    // 「金额」（0.10.0）同步来的价目元信息：`eras` 的键是官方后来才出现的模型名（动态键），
    // 与 priceOverrides 同一个理由用 `z.any()`。第三方价目本体不进设置（见 price-sync.ts）。
    [SYNCED_PRICES_FIELD]: Schema.any().required(false),
    // 「金额」（0.10.0）自动同步官方价：默认关（会自动出网的开关不默认开）。
    [PRICE_AUTO_SYNC_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.priceAutoSync),
    // 微信通知（0.17.0）。⚠️ 2026-10-09 补：这 5 个字段在 0.17.0 漏了 —— 只加进了设置契约
    // 与设置页，**没加进这张 schema**。后果不是"界面少了什么"，而是宿主设置服务的写路径会
    // 直接拒绝：`settings.mutate` 对每个 path 先查 `isVolatilePath(schema, path)`，
    // 没声明就抛 `Config field "notifyEnabled" is not volatile`（见 DSH 源码
    // packages/settings/settings/src/index.ts 的 `write`），于是通知卡那几个开关根本存不住。
    // 教训写进测试：`test/client-registration.mjs` 第 16 节逐字段核对契约与这张表。
    [NOTIFY_ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.notifyEnabled),
    [NOTIFY_CHANNEL_FIELD]: Schema.string().default(DEFAULT_SETTINGS.notifyChannel),
    [NOTIFY_PUSHPLUS_FIELD]: Schema.string().default(DEFAULT_SETTINGS.notifyPushplusToken),
    [NOTIFY_WECOM_FIELD]: Schema.string().default(DEFAULT_SETTINGS.notifyWecomWebhook),
    [NOTIFY_KINDS_FIELD]: Schema.object({
      "needs-input": Schema.boolean().default(DEFAULT_SETTINGS.notifyKinds["needs-input"]),
      done: Schema.boolean().default(DEFAULT_SETTINGS.notifyKinds.done),
      error: Schema.boolean().default(DEFAULT_SETTINGS.notifyKinds.error)
    }),
    // 工作区目录选择（0.19.0）：默认关（接管官方槽位这件事必须由用户自己点）。
    [DIRECTORY_PICK_ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.directoryPickEnabled)
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
var priceCache = { loaded: false, providers: void 0 };
var PLAN_QUOTA_TTL_MS = 6e4;
var planQuotaCache = /* @__PURE__ */ new Map();
var planQuotaInflight = /* @__PURE__ */ new Set();
var PLAN_QUOTA_KEY_REFS = ["OPENCODE_GO_API_KEY", "GO_API_KEY", "OPENCODE_API_KEY"];
async function fetchPlanQuota(ctx, plan, now = Date.now(), fetcher = fetch) {
  if (planQuotaInflight.has(plan.id)) return peekPlanQuota(plan, now);
  planQuotaInflight.add(plan.id);
  const cached2 = planQuotaCache.get(plan.id);
  const keep = (status, reason) => degradeQuota(plan, cached2, status, reason);
  const credentials = ctx.get("credentials");
  let key = "";
  if (typeof credentials?.resolve === "function") {
    for (const ref of PLAN_QUOTA_KEY_REFS) {
      try {
        const resolved = await credentials.resolve(ref);
        const value = typeof resolved?.value === "string" ? resolved.value.trim() : "";
        if (value !== "") {
          key = value;
          break;
        }
      } catch {
      }
    }
  }
  if (key === "") {
    const snapshot2 = keep("not-configured", `\u6CA1\u627E\u5230 ${plan.displayName} \u7684 API Key\uFF08\u8BD5\u8FC7 ${PLAN_QUOTA_KEY_REFS.join(" / ")}\uFF09`);
    planQuotaCache.set(plan.id, snapshot2);
    planQuotaInflight.delete(plan.id);
    return snapshot2;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 8e3);
  try {
    const response = await fetcher(`${plan.quotaOrigin}${plan.quotaPath}`, {
      method: "GET",
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      const snapshot3 = keep("unavailable", `\u989D\u5EA6\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}`);
      planQuotaCache.set(plan.id, snapshot3);
      return snapshot3;
    }
    const body = await response.json();
    const windows = parseQuotaPayload(body);
    const snapshot2 = windows.length === 0 ? { provider: plan.id, displayName: plan.displayName, status: "invalid", windows, fetchedAt: now, reason: "\u989D\u5EA6\u63A5\u53E3\u7684\u54CD\u5E94\u91CC\u6CA1\u6709\u53EF\u8BFB\u7684\u7A97\u53E3\uFF08\u5F62\u72B6\u53D8\u4E86\uFF1F\uFF09" } : { provider: plan.id, displayName: plan.displayName, status: "ok", windows, fetchedAt: now, reason: "" };
    planQuotaCache.set(plan.id, snapshot2);
    return snapshot2;
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "\u989D\u5EA6\u63A5\u53E3\u8D85\u65F6\uFF088 \u79D2\uFF09" : `\u989D\u5EA6\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`;
    const snapshot2 = keep("unavailable", reason);
    planQuotaCache.set(plan.id, snapshot2);
    return snapshot2;
  } finally {
    clearTimeout(timer);
    planQuotaInflight.delete(plan.id);
  }
}
function peekPlanQuota(plan, now = Date.now()) {
  const cached2 = planQuotaCache.get(plan.id);
  if (cached2 !== void 0 && now - cached2.fetchedAt < PLAN_QUOTA_TTL_MS) return cached2;
  return {
    provider: plan.id,
    displayName: plan.displayName,
    status: cached2 === void 0 ? "pending" : cached2.status,
    windows: cached2?.windows ?? [],
    fetchedAt: cached2?.fetchedAt ?? 0,
    reason: cached2 === void 0 ? "\u6B63\u5728\u53D6\u989D\u5EA6\u2026" : cached2.reason
  };
}
function refreshPlanQuota(ctx, plan) {
  const cached2 = planQuotaCache.get(plan.id);
  if (cached2 !== void 0 && Date.now() - cached2.fetchedAt < PLAN_QUOTA_TTL_MS) return;
  void fetchPlanQuota(ctx, plan).catch(() => {
  });
}
async function ensureProviderPrices() {
  if (priceCache.loaded) return priceCache.providers;
  priceCache.loaded = true;
  try {
    const file = await readPriceFile();
    priceCache.providers = file.providers;
  } catch {
    priceCache.providers = void 0;
  }
  return priceCache.providers;
}
function invalidateProviderPrices() {
  priceCache.loaded = false;
  priceCache.providers = void 0;
}
var moneyInvalidators = /* @__PURE__ */ new Set();
function invalidateMoney() {
  for (const invalidate of moneyInvalidators) {
    try {
      invalidate();
    } catch (error) {
      console.warn("[composer-ux] \u91D1\u989D\u89C4\u5219\u5931\u6548\u56DE\u8C03\u51FA\u9519", error);
    }
  }
}
function rejectUntrustedRequest(ctx, req, res) {
  try {
    const connection = ctx.get("connection");
    const rejection = connection?.requestRejection?.(req);
    if (rejection === void 0) return false;
    res.statusCode = rejection;
    res.end();
    return true;
  } catch {
    return false;
  }
}
var Config = markVolatile(ownSchema());
function apply(ctx, config) {
  resetNativeSessionHeaderCache();
  planQuotaCache.clear();
  planQuotaInflight.clear();
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
    let resync = () => {
    };
    installHeaderOverlay(ctx, read, () => {
      resync();
    });
    let busy = false;
    let again = false;
    const sync = () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      void syncHeaderOverlay(settings, read, headerOverlayState.installed).catch((error) => {
        console.error("[composer-ux] \u8BF7\u6C42\u5934\u72B6\u6001\u540C\u6B65\u5931\u8D25", error);
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
    resync = sync;
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
    const CONTEXT_TURNS_FULL = 100;
    const sessionRoute = () => {
      try {
        const selector = optCtx.get("agentDefaultModel");
        const current = selector?.currentSelection?.();
        return { provider: textOf3(current?.provider), model: textOf3(current?.model) };
      } catch {
        return { provider: "", model: "" };
      }
    };
    const resolveRoute = (payload) => {
      const provider = textOf3(payload.provider);
      const model = textOf3(payload.model);
      if (provider !== "" && model !== "") return { provider, model };
      const configured = readOwnSetting(optCtx, config, OPTIMIZER_MODEL_FIELD).trim();
      if (configured !== "") {
        const slash = configured.indexOf("/");
        if (slash > 0) return { provider: configured.slice(0, slash), model: configured.slice(slash + 1) };
        const fallback = sessionRoute();
        return { provider: fallback.provider, model: configured };
      }
      return sessionRoute();
    };
    const EFFORT_MIN_RE = /none|minimal|low|低|off/i;
    const effortCache = /* @__PURE__ */ new Map();
    const EFFORT_CACHE_MS = 10 * 6e4;
    const lowestReasoningEffort = async (provider, model) => {
      const key = `${provider}\0${model}`;
      const hit = effortCache.get(key);
      if (hit !== void 0 && Date.now() - hit.at < EFFORT_CACHE_MS) return hit.id;
      try {
        const llm = optCtx.llm;
        const info = objectOf3(await llm.resolveModelInfo?.(provider, model));
        const reasoning = objectOf3(info?.reasoning);
        const raw = Array.isArray(reasoning?.efforts) ? reasoning.efforts : [];
        const rows = raw.map((row) => objectOf3(row)).filter((row) => row !== void 0);
        if (rows.length === 0) return "";
        const picked = rows.find((row) => EFFORT_MIN_RE.test(textOf3(row.id)) || EFFORT_MIN_RE.test(textOf3(row.name))) ?? rows[0];
        const id = textOf3(picked?.id);
        if (id === "") return "";
        effortCache.set(key, { id, at: Date.now() });
        return id;
      } catch {
        return "";
      }
    };
    const readSessionSnapshot = async (sessionId) => {
      try {
        const query = optCtx.get("sessionQuery");
        if (query?.readSession === void 0) return void 0;
        return await query.readSession(sessionId);
      } catch {
        return void 0;
      }
    };
    const handle = async (req, res) => {
      if ((req.method ?? "GET").toUpperCase() !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 POST" });
        return;
      }
      if (rejectUntrustedRequest(optCtx, req, res)) return;
      const startedAt = Date.now();
      let payload;
      try {
        payload = objectOf3(JSON.parse(await readBody(req))) ?? {};
      } catch (error) {
        sendJson(res, 400, { ok: false, error: `\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText3(error)}` });
        return;
      }
      const text = textOf3(payload.text).trim();
      if (text === "") {
        sendJson(res, 400, { ok: false, error: "\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF0C\u6CA1\u6709\u53EF\u4F18\u5316\u7684\u5185\u5BB9" });
        return;
      }
      const slash = splitSlashCommand(text);
      if (slash.prefix !== "" && slash.body === "") {
        sendJson(res, 400, { ok: false, error: `\u300C${slash.prefix}\u300D\u540E\u9762\u6CA1\u6709\u6B63\u6587\uFF0C\u6CA1\u6709\u53EF\u4F18\u5316\u7684\u5185\u5BB9` });
        return;
      }
      const body = slash.prefix === "" ? text : slash.body;
      if (body.length > TEXT_MAX) {
        sendJson(res, 400, { ok: false, error: `\u539F\u6587\u8FC7\u957F\uFF08\u4E0A\u9650 ${TEXT_MAX} \u5B57\u7B26\uFF09` });
        return;
      }
      const tier = textOf3(payload.tier) === "" ? DEFAULT_OPTIMIZER_TIER : textOf3(payload.tier);
      if (tier === "off") {
        sendJson(res, 200, { ok: false, error: "\u6863\u4F4D\u662F\u300C\u5173\u95ED\u300D\uFF1A\u4E0D\u4F18\u5316\u3002\u5230\u300C\u5FEB\u6377\u6307\u4EE4\u300D\u9762\u677F\u628A\u6863\u4F4D\u62E8\u5230\u8F7B\u5EA6\u6216\u4EE5\u4E0A\u518D\u6765\u3002" });
        return;
      }
      const route = resolveRoute(payload);
      if (route.provider === "" || route.model === "") {
        sendJson(res, 200, { ok: false, error: "\u62FF\u4E0D\u5230\u5F53\u524D\u7684\u6A21\u578B\u8DEF\u7531\uFF0C\u65E0\u6CD5\u4F18\u5316\uFF08\u8BF7\u5148\u5728\u8F93\u5165\u6846\u65C1\u7684\u6A21\u578B\u9009\u62E9\u5668\u91CC\u9009\u4E00\u4E2A\u6A21\u578B\uFF09" });
        return;
      }
      const customPrompt = readOwnSetting(optCtx, config, optimizerPromptFieldOf(tier));
      const contextOn = readOwnFlag(optCtx, config, OPTIMIZER_CONTEXT_FIELD, DEFAULT_SETTINGS.optimizerContext);
      const ledgerOn = readOwnFlag(optCtx, config, OPTIMIZER_LEDGER_FIELD, DEFAULT_SETTINGS.optimizerLedger);
      const readToolsOn = readOwnFlag(optCtx, config, OPTIMIZE_READ_TOOLS_FIELD, DEFAULT_SETTINGS.optimizeReadTools);
      const bashOn = readOwnFlag(optCtx, config, OPTIMIZE_BASH_FIELD, DEFAULT_SETTINGS.optimizeBash);
      const sessionId = textOf3(payload.sessionId);
      const historyMode = readOwnSetting(optCtx, config, OPTIMIZER_HISTORY_FIELD);
      const turnsWanted = normalizeOptimizerTurns(
        readOwnNumber(optCtx, config, OPTIMIZER_TURNS_FIELD, DEFAULT_SETTINGS.optimizerTurns)
      );
      const wantContext = contextOn && sessionId !== "" && !(historyMode !== "full" && turnsWanted === 0);
      const contextTurns = wantContext ? contextWithinBudget(recentTurns(await readSessionSnapshot(sessionId), historyMode === "full" ? CONTEXT_TURNS_FULL : turnsWanted)) : [];
      const contextText = contextBlock(contextTurns);
      const framing = readOwnSetting(optCtx, config, OPTIMIZER_FRAMING_FIELD);
      const system = buildOptimizeSystem(tier, customPrompt, { intent: contextText !== "", framing });
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, LLM_TIMEOUT_MS);
      let settled = false;
      res.on?.("close", () => {
        if (!settled) controller.abort();
      });
      const effort = await lowestReasoningEffort(route.provider, route.model);
      const wantsStream = /text\/event-stream/i.test(String(req.headers?.accept ?? ""));
      const emit = (payload2) => {
        if (!wantsStream) return;
        try {
          res.write?.(`data: ${JSON.stringify(payload2)}

`);
        } catch {
        }
      };
      if (wantsStream) {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive"
        });
      }
      let seenItems = 0;
      let seenDropped = 0;
      const onStreamDelta = (out, delta) => {
        if (!wantsStream) return;
        if (!delta.includes("}") && !delta.includes("]")) return;
        const scan = scanOptimizeStream(out, body, tier);
        for (const item of scan.items.slice(seenItems)) {
          emit({
            type: "item",
            index: seenItems + 1,
            id: item.id,
            kind: item.kind,
            text: item.text,
            quote: item.quote ?? "",
            quoteSource: item.quoteSource
          });
          seenItems += 1;
        }
        for (const row of scan.dropped.slice(seenDropped)) {
          emit({ type: "dropped", ...row });
        }
        seenDropped = scan.dropped.length;
      };
      const runOnce = async (userText, onDelta) => {
        let out = "";
        let failure = "";
        try {
          const stream = optCtx.llm.stream({
            provider: route.provider,
            model: route.model,
            system,
            temperature: buildOptimizeTemperature(tier),
            ...effort === "" ? {} : { reasoningEffort: effort },
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
              const delta = String(chunk.text ?? "");
              out += delta;
              onDelta(out, delta);
              if (out.length > OPTIMIZE_OUTPUT_MAX * 4) break;
            } else if (chunk.type === "finish") {
              const reason = objectOf3(chunk.reason);
              if (reason?.kind === "error" || reason?.kind === "aborted") {
                const detail = objectOf3(reason.failure);
                failure = textOf3(detail?.message) || (reason.kind === "aborted" ? "\u4F18\u5316\u88AB\u4E2D\u65AD" : "\u6A21\u578B\u8FD4\u56DE\u9519\u8BEF");
              }
            }
          }
        } catch (error) {
          failure = errorText3(error);
        }
        return { out, failure };
      };
      let toolInfo = null;
      let tooledResult = null;
      const bashGate = (() => {
        if (!bashOn) return { gate: { kind: "off" } };
        let mode;
        let policy;
        let sandbox;
        try {
          const session = sessionId === "" ? void 0 : optCtx.get("sessions")?.get?.(sessionId);
          const resolved = optCtx.get("sandboxPolicy")?.resolve?.({ session });
          policy = resolved;
          mode = typeof resolved?.mode === "string" ? resolved.mode : void 0;
        } catch {
          mode = void 0;
        }
        try {
          const candidate = optCtx.get("sandbox");
          if (candidate !== void 0 && typeof candidate.confine === "function") sandbox = candidate;
        } catch {
          sandbox = void 0;
        }
        const gate = resolveBashAuthority({ enabled: true, ...mode === void 0 ? {} : { mode }, hasConfine: sandbox !== void 0 });
        if (gate.kind !== "open" || !gate.confined || sandbox?.confine === void 0) return { gate };
        const confine = sandbox.confine.bind(sandbox);
        return {
          gate,
          confine: async (argv) => {
            const out = await confine(argv, policy, controller.signal);
            return { argv: out.argv, ...out.enforcement === void 0 ? {} : { enforcement: out.enforcement } };
          }
        };
      })();
      const bashOpen = bashGate.gate.kind === "open";
      const bashGateInfo = bashGate.gate.kind === "off" ? { bashGate: "off" } : bashGate.gate.kind === "denied" ? { bashGate: "denied", bashGateReason: bashGate.gate.reason } : { bashGate: bashGate.gate.confined ? "sandboxed" : "full-access" };
      const toolsOn = readToolsOn || bashOpen;
      const cwd = toolsOn ? sessionCwdOf(await readSessionSnapshot(sessionId)) : "";
      if (toolsOn && cwd !== "") {
        try {
          const looped = await runOptimizeToolLoop({
            llm: optCtx.llm,
            provider: route.provider,
            model: route.model,
            system: `${system}${readToolsOn ? READ_TOOLS_SYSTEM_NOTE : ""}${bashOpen ? BASH_TOOL_SYSTEM_NOTE : ""}`,
            userText: buildOptimizeUser(body, { context: contextText }),
            root: cwd,
            bash: bashOpen,
            ...bashGate.confine === void 0 ? {} : { bashConfine: bashGate.confine },
            signal: controller.signal,
            onDelta: onStreamDelta,
            maxChars: OPTIMIZE_OUTPUT_MAX * 4,
            temperature: buildOptimizeTemperature(tier),
            reasoningEffort: effort
          });
          const assembledByTool = runOptimizePipeline(looped.out, body, { tier });
          const accepted = looped.failure === "" && looped.out.trim() !== "" && assembledByTool.ok && assembledByTool.fallback === false;
          toolInfo = {
            toolRounds: looped.rounds,
            toolCalls: looped.calls,
            toolNames: [...new Set(looped.names)],
            toolCapped: looped.capped,
            toolRejected: looped.rejected,
            toolFallback: !accepted
          };
          if (accepted) tooledResult = { out: looped.out, failure: "" };
        } catch (error) {
          toolInfo = {
            toolRounds: 0,
            toolCalls: 0,
            toolNames: [],
            toolCapped: false,
            toolRejected: 0,
            toolFallback: true,
            toolError: errorText3(error)
          };
        }
      }
      let retried = false;
      let result;
      try {
        result = tooledResult ?? await runOnce(buildOptimizeUser(body, { context: contextText }), onStreamDelta);
        if (result.out.trim() === "" && result.failure === "") {
          retried = true;
          const second = await runOnce(buildOptimizeUser(body, { retry: true, reason: "\u5BBF\u4E3B\u6CA1\u6709\u6536\u5230\u4EFB\u4F55\u6761\u76EE", context: contextText }), onStreamDelta);
          if (second.out.trim() !== "") result = second;
          else if (result.failure === "") result = second;
        }
      } finally {
        settled = true;
        clearTimeout(timer);
      }
      let summary = { items: 0, droppedReasons: [], warnings: 0, fallback: false };
      const outcome = (() => {
        if (result.out.trim() === "") {
          return {
            ok: false,
            error: result.failure === "" ? "\u6A21\u578B\u6CA1\u6709\u4EA7\u51FA\u4EFB\u4F55\u5185\u5BB9" : `\u4F18\u5316\u5931\u8D25\uFF1A${result.failure}`,
            retried,
            ...toolInfo === null ? {} : toolInfo,
            ...bashGateInfo,
            ...bashGateInfo
          };
        }
        const assembled = runOptimizePipeline(result.out, body, { tier });
        if (!assembled.ok) {
          return {
            ok: false,
            error: `\u6A21\u578B\u8F93\u51FA\u4E0D\u662F\u53EF\u7528\u7684\u6761\u76EE JSON\uFF08${assembled.code}\uFF09\uFF1A${assembled.reason}`,
            retried
          };
        }
        const optimized = assembled.text.trim();
        if (optimized === "") return { ok: false, error: "\u88C5\u914D\u540E\u662F\u7A7A\u7684\uFF08\u6A21\u578B\u6CA1\u6709\u7ED9\u51FA\u53EF\u6838\u5B9E\u7684\u6761\u76EE\uFF09", retried };
        summary = {
          items: assembled.itemCount,
          // ⚠️ 只收我们自己写的固定短语（reason），**不收**被丢弃条目的 text（那可能是用户原话）。
          droppedReasons: assembled.dropped.map((item) => item.reason),
          warnings: assembled.warnings.length,
          fallback: assembled.fallback
        };
        return {
          ok: true,
          text: optimized,
          // 语义收窄：`truncated` 现在专指"篇幅闸门真的动过手"（装了必保节仍超预算）。
          truncated: assembled.overBudget,
          provider: route.provider,
          model: route.model,
          // ── 以下为 0.6.0 新增的**附加**字段：老客户端不读它们也不会坏。
          promptSource: optimizePromptSource(customPrompt),
          // 这一轮带了几个往来（0 = 没带上下文：关了开关 / 没有会话 / 读不到快照）。
          contextTurns: contextTurns.length,
          retried,
          fallback: assembled.fallback,
          itemCount: assembled.itemCount,
          rewrittenChars: assembled.rewrittenChars,
          dropped: assembled.dropped,
          warnings: assembled.warnings,
          budget: assembled.budget,
          chars: assembled.chars,
          // 只读查证这一路的记账（没派过工具时就一个键都没有）。
          ...toolInfo === null ? {} : toolInfo,
          ...bashGateInfo
        };
      })();
      if (ledgerOn) {
        appendLedger(buildLedgerRun({
          sessionId,
          tier,
          provider: route.provider,
          model: route.model,
          draftChars: body.length,
          contextTurns: contextTurns.length,
          contextChars: contextText.length,
          items: summary.items,
          dropped: summary.droppedReasons.length,
          droppedReasons: summary.droppedReasons,
          warnings: summary.warnings,
          fallback: summary.fallback,
          // 工具记账：回落也带上（"确实花了这些次调用又回落了"比抹平成 0 诚实）。
          ...toolInfo === null ? {} : toolInfo,
          ...bashGateInfo,
          retried,
          promptSource: optimizePromptSource(customPrompt),
          ms: Date.now() - startedAt,
          ok: outcome.ok === true,
          failure: outcome.ok === true ? void 0 : textOf3(outcome.error)
        }));
      }
      if (!wantsStream) {
        sendJson(res, 200, outcome);
        return;
      }
      emit({ type: "done", ...outcome });
      try {
        res.end();
      } catch {
      }
    };
    const handleState = async (req, res) => {
      if (rejectUntrustedRequest(optCtx, req, res)) return;
      const method = (req.method ?? "GET").toUpperCase();
      const keep = readOwnFlag(optCtx, config, OPTIMIZE_KEEP_DOCK_FIELD, DEFAULT_SETTINGS.optimizeKeepDock);
      const file = optimizeStatePath();
      if (method === "GET") {
        if (!keep) {
          sendJson(res, 200, { ok: true, state: null, hidden: false, keep: false, file });
          return;
        }
        const read = readDockState(file);
        sendJson(res, 200, {
          ok: true,
          state: read.state,
          hidden: read.hidden,
          keep: true,
          file,
          bytes: dockStateBytes(file),
          ...read.corrupt ? { corrupt: true } : {},
          ...read.quarantined === void 0 ? {} : { quarantined: read.quarantined },
          ...read.unknownVersion === void 0 ? {} : { unknownVersion: read.unknownVersion }
        });
        return;
      }
      if (method !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
        return;
      }
      let payload;
      try {
        payload = objectOf3(JSON.parse(await readBody(req))) ?? {};
      } catch (error) {
        sendJson(res, 400, { ok: false, error: `\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText3(error)}` });
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(payload, "state")) {
        sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 state \u5B57\u6BB5\uFF08null = \u6E05\u7A7A\uFF09" });
        return;
      }
      const candidate = payload.state;
      if (candidate !== null && (typeof candidate !== "object" || Array.isArray(candidate))) {
        sendJson(res, 400, { ok: false, error: "state \u5FC5\u987B\u662F\u5BF9\u8C61\u6216 null" });
        return;
      }
      if (!keep) {
        clearDockState(file);
        sendJson(res, 200, { ok: true, cleared: true, keep: false, file });
        return;
      }
      const result = writeDockState(candidate, file, payload.hidden === true);
      if (!result.written) {
        sendJson(res, 200, {
          ok: false,
          keep: true,
          file,
          ...result.tooBig === true ? { tooBig: true, bytes: result.bytes, error: `\u72B6\u6001\u8D85\u8FC7\u4E0A\u9650\uFF08${result.bytes} \u5B57\u8282\uFF09\uFF0C\u6CA1\u6709\u5199\u76D8` } : {},
          ...result.error === void 0 ? {} : { error: result.error }
        });
        return;
      }
      sendJson(res, 200, { ok: true, hidden: payload.hidden === true, keep: true, file, bytes: result.bytes ?? 0 });
    };
    const MODEL_CACHE_MS = 6e4;
    const MODEL_LIST_TIMEOUT_MS = 3e3;
    let modelsCache = null;
    optCtx.effect(() => optCtx.webServer.register({
      kind: "exact",
      path: MODELS_API_PATH,
      handler: (async (req, res) => {
        if (req.method !== "GET") {
          sendJson(res, 405, { ok: false, error: "\u53EA\u652F\u6301 GET" });
          return;
        }
        const fresh = String(req.url ?? "").includes("fresh=1");
        const now = Date.now();
        if (!fresh && modelsCache !== null && now - modelsCache.at < MODEL_CACHE_MS) {
          sendJson(res, 200, modelsCache.payload);
          return;
        }
        try {
          const llm = optCtx.get("llm");
          const providerRows = typeof llm?.listProviders === "function" ? llm.listProviders() : [];
          const current = sessionRoute();
          const groups = [];
          for (const row of providerRows) {
            const id = textOf3(row?.id);
            if (id === "") continue;
            const name2 = textOf3(row?.name) === "" ? id : textOf3(row?.name);
            let models = [];
            let error = "";
            try {
              const listed = typeof llm?.listModels === "function" ? await Promise.race([
                llm.listModels(id),
                new Promise((_resolve, reject2) => {
                  setTimeout(() => {
                    reject2(new Error(`\u8D85\u65F6 ${String(MODEL_LIST_TIMEOUT_MS)} ms`));
                  }, MODEL_LIST_TIMEOUT_MS);
                })
              ]) : [];
              models = (Array.isArray(listed) ? listed : []).map((item) => ({ id: textOf3(item?.id), name: textOf3(item?.name) === "" ? textOf3(item?.id) : textOf3(item?.name) })).filter((item) => item.id !== "");
            } catch (failure) {
              error = errorText3(failure);
            }
            groups.push({ id, name: name2, models, ...error === "" ? {} : { error } });
          }
          const payload = { ok: true, at: now, current, groups };
          modelsCache = { at: now, payload };
          sendJson(res, 200, payload);
        } catch (error) {
          sendJson(res, 500, { ok: false, error: `\u8BFB\u6A21\u578B\u6E05\u5355\u5931\u8D25\uFF1A${errorText3(error)}` });
        }
      })
    }));
    optCtx.effect(() => optCtx.webServer.register({
      kind: "exact",
      path: OPTIMIZE_STATE_API_PATH,
      handler: handleState
    }), "composer-ux: optimize dock state route");
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
      if (rejectUntrustedRequest(storeCtx, req, res)) return;
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
        payload = objectOf3(JSON.parse(await readBody(req))) ?? {};
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
  ctx.inject(["webServer", "sessions"], (usageCtx) => {
    const sendJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    const liveSessions = () => {
      try {
        const sessions = usageCtx.get("sessions");
        const list = sessions?.list?.();
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    };
    const moneyRules = { holidays: DEFAULT_PEAK_HOLIDAYS, eras: [] };
    const loadProviders = async () => {
      moneyRules.providers = await ensureProviderPrices();
    };
    const readOwn = makeReader(usageCtx.get("settings"), config);
    const readMoneySettings = () => {
      try {
        const row = readOwn(NAMESPACE);
        const synced = row?.[SYNCED_PRICES_FIELD];
        moneyRules.holidays = effectiveHolidays(row?.[PEAK_HOLIDAYS_FIELD], synced?.holidays).days;
        moneyRules.eras = parsePriceEras(synced?.eras) ?? [];
      } catch {
        moneyRules.holidays = DEFAULT_PEAK_HOLIDAYS;
        moneyRules.eras = [];
      }
    };
    const tierAt = (ms, provider, model) => {
      const at = Number.isFinite(ms) ? ms : Date.now();
      if (!isDeepSeekRoute(provider, model)) return { peak: false, era: "" };
      return { peak: isPeakAt(at, { holidays: moneyRules.holidays }), era: eraIdAt(at, moneyRules.eras) };
    };
    readMoneySettings();
    const usageCache = createUsageCache(tierAt, { maxSessions: 32 });
    usageCtx.on?.("session/event", ((session, event) => {
      try {
        const id = session?.id;
        if (typeof id !== "string" || id === "") return;
        usageCache.event(id, event);
      } catch (error) {
        console.warn("[composer-ux] \u4F1A\u8BDD\u7528\u91CF\u6298\u53E0\u5931\u8D25", error);
      }
    }));
    const onMoneySettingsUpdated = () => {
      readMoneySettings();
      invalidateProviderPrices();
      usageCache.clear();
    };
    for (const event of ["settings/updated", "settings/document-updated"]) {
      usageCtx.on?.(event, ((ns) => {
        if (ns !== NAMESPACE) return;
        onMoneySettingsUpdated();
      }));
    }
    usageCtx.effect(() => {
      moneyInvalidators.add(onMoneySettingsUpdated);
      return () => {
        moneyInvalidators.delete(onMoneySettingsUpdated);
      };
    }, "composer-ux: \u91D1\u989D\u89C4\u5219\u5931\u6548\u767B\u8BB0");
    const readOverrides = () => {
      try {
        const row = readOwn(NAMESPACE);
        return parsePriceOverrides(row?.[PRICE_OVERRIDES_FIELD]);
      } catch {
        return void 0;
      }
    };
    const readErrorOf = /* @__PURE__ */ new Map();
    const idFormOf = /* @__PURE__ */ new Map();
    const alternateId = (id) => id.startsWith("session-") ? id.slice("session-".length) : `session-${id}`;
    const readSnapshot = async (id) => {
      try {
        const query = usageCtx.get("sessionQuery");
        if (typeof query?.readSession !== "function") {
          readErrorOf.set(id, "\u5BBF\u4E3B\u6CA1\u6709 sessionQuery.readSession \u670D\u52A1");
          return void 0;
        }
        const known = idFormOf.get(id);
        const candidates = known === void 0 ? [id, alternateId(id)] : [known, alternateId(known)];
        let lastError = "";
        let empty = false;
        for (const candidate of candidates) {
          try {
            const snapshot2 = await query.readSession(candidate);
            if (snapshot2 === void 0) {
              empty = true;
              continue;
            }
            const inherited = typeof snapshot2.inheritedEventCount === "number" && Number.isFinite(snapshot2.inheritedEventCount) && snapshot2.inheritedEventCount > 0 ? snapshot2.inheritedEventCount : 0;
            idFormOf.set(id, candidate);
            readErrorOf.delete(id);
            return { events: Array.isArray(snapshot2.events) ? snapshot2.events : [], inherited };
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        readErrorOf.set(id, lastError !== "" ? lastError : empty ? "readSession \u8FD4\u56DE\u7A7A\uFF08\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u5F52\u6863\uFF09" : "\u8BFB\u4E0D\u5230\u4F1A\u8BDD");
        return void 0;
      } catch (error) {
        readErrorOf.set(id, error instanceof Error ? error.message : String(error));
        return void 0;
      }
    };
    const ownEvents = (snapshot2) => {
      if (snapshot2.inherited <= 0) return snapshot2.events;
      return snapshot2.events.filter((event) => {
        const seq = event?.seq;
        return typeof seq !== "number" || seq >= snapshot2.inherited;
      });
    };
    const priceFold = (target, overrides) => {
      const routes = target.routes.map((item) => {
        const resolved = resolvePrice(item.model, {
          provider: item.provider,
          peak: item.peak,
          era: item.era,
          overrides,
          providers: moneyRules.providers
        });
        const parts = costPartsOf(costBucketsOf(item.usage), resolved.prices);
        const quota2 = quotaCostOf(item.provider, item.model, item.peak, {
          miss: item.usage.inputTokens,
          hit: item.usage.cacheReadTokens,
          out: item.usage.outputTokens
        });
        return {
          ...item,
          cost: parts.total,
          parts,
          /** 这一条实际用的单价（界面要原样显示"按什么价算的"）。 */
          price: resolved.prices,
          priceCurrency: resolved.currency,
          priceSource: resolved.source,
          priceEra: resolved.era,
          overridden: resolved.overridden,
          unpriced: resolved.unpriced,
          /** 单价来自**内置快照**（没点过同步时的兜底）：界面会如实标明。 */
          priceBuiltin: resolved.builtin,
          /** 订阅通道的额度消耗（USD）；不是订阅通道、或该模型不在价目表里时缺失。 */
          ...quota2 === void 0 ? {} : { quota: quota2 }
        };
      });
      const cost = routes.reduce(
        (sum, item) => ({
          miss: sum.miss + item.parts.miss,
          hit: sum.hit + item.parts.hit,
          out: sum.out + item.parts.out,
          total: sum.total + item.cost
        }),
        { miss: 0, hit: 0, out: 0, total: 0 }
      );
      const quotaModels = /* @__PURE__ */ new Map();
      let quotaUsd = 0;
      for (const route of routes) {
        const quota2 = route.quota;
        if (quota2 === void 0) continue;
        quotaUsd += quota2.usd;
        const row = quotaModels.get(quota2.modelKey) ?? {
          usd: 0,
          ...quota2.monthlyLimitUsd === void 0 ? {} : { monthlyLimitUsd: quota2.monthlyLimitUsd }
        };
        row.usd += quota2.usd;
        quotaModels.set(quota2.modelKey, row);
      }
      const quota = {
        usd: quotaUsd,
        models: [...quotaModels].map(([model, row]) => ({
          model,
          usd: row.usd,
          ...row.monthlyLimitUsd === void 0 ? {} : { monthlyLimitUsd: row.monthlyLimitUsd },
          ...row.monthlyLimitUsd === void 0 || row.monthlyLimitUsd <= 0 ? {} : { percentOfLimit: row.usd / row.monthlyLimitUsd * 100 }
        }))
      };
      return { routes, cost, unpriced: routes.filter((item) => item.unpriced).length, quota };
    };
    const SUBAGENT_MAX_DEPTH = 4;
    const SUBAGENT_MAX_SESSIONS = 32;
    const CHILD_INDEX_TTL_MS = 3e4;
    let childIndexAt = 0;
    let childIndexBuilding = false;
    let childIndexByParent = /* @__PURE__ */ new Map();
    const childIndexOf = async () => {
      if (childIndexAt !== 0 && Date.now() - childIndexAt < CHILD_INDEX_TTL_MS) return childIndexByParent;
      if (childIndexBuilding) return childIndexByParent;
      childIndexBuilding = true;
      try {
        const query = usageCtx.get("sessionQuery");
        if (typeof query?.listSessions !== "function") return childIndexByParent;
        const records = await query.listSessions();
        const next = /* @__PURE__ */ new Map();
        for (const record of records) {
          const header = record?.header;
          if (header?.origin !== "subagent") continue;
          if (typeof header.id !== "string" || header.id === "") continue;
          if (typeof header.parentSession !== "string" || header.parentSession === "") continue;
          const list = next.get(header.parentSession) ?? [];
          list.push(header.id);
          next.set(header.parentSession, list);
        }
        childIndexByParent = next;
        childIndexAt = Date.now();
      } catch {
      } finally {
        childIndexBuilding = false;
      }
      return childIndexByParent;
    };
    const childrenOf = (sessionId, catalog, index) => {
      const rows = catalog.map((child) => ({ sessionId: child.sessionId, external: child.external }));
      const known = new Set(rows.map((child) => child.sessionId));
      for (const childId of index.get(sessionId) ?? []) {
        if (known.has(childId)) continue;
        known.add(childId);
        rows.push({ sessionId: childId, external: false });
      }
      return rows;
    };
    const foldSubagents = async (root, rootId, liveSeqs) => {
      const rows = [];
      const seen = /* @__PURE__ */ new Set([rootId]);
      const index = await childIndexOf();
      let missing = 0;
      let external = 0;
      let skipped = 0;
      const queue = childrenOf(rootId, root.children, index).map((child) => ({
        sessionId: child.sessionId,
        external: child.external,
        depth: 1
      }));
      while (queue.length > 0) {
        const next = queue.shift();
        if (next === void 0) break;
        if (seen.has(next.sessionId)) continue;
        seen.add(next.sessionId);
        if (next.external) {
          external += 1;
          continue;
        }
        if (next.depth > SUBAGENT_MAX_DEPTH || rows.length >= SUBAGENT_MAX_SESSIONS) {
          skipped += 1;
          continue;
        }
        let unreadable = false;
        const outcome = await usageCache.sync(next.sessionId, liveSeqs.get(next.sessionId), async () => {
          const snapshot2 = await readSnapshot(next.sessionId);
          if (snapshot2 === void 0) {
            unreadable = true;
            throw new Error(`\u5B50\u4EE3\u7406\u4F1A\u8BDD ${next.sessionId} \u7684\u65E5\u5FD7\u8BFB\u4E0D\u5230`);
          }
          return ownEvents(snapshot2);
        });
        if (unreadable && outcome.fold.events === 0) {
          missing += 1;
          continue;
        }
        rows.push({ sessionId: next.sessionId, depth: next.depth, fold: outcome.fold });
        for (const child of childrenOf(next.sessionId, outcome.fold.children, index)) {
          queue.push({ sessionId: child.sessionId, external: child.external, depth: next.depth + 1 });
        }
      }
      return { rows, missing, external, skipped };
    };
    const handle = (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
        return;
      }
      if (rejectUntrustedRequest(usageCtx, req, res)) return;
      const url = typeof req.url === "string" ? req.url : "";
      const queryAt = url.indexOf("?");
      const params = new URLSearchParams(queryAt < 0 ? "" : url.slice(queryAt + 1));
      const sessionId = params.get("sessionId") ?? "";
      if (sessionId.length === 0) {
        sendJson(res, 400, { ok: false, error: "\u7F3A sessionId" });
        return;
      }
      void (async () => {
        const liveSeqs = /* @__PURE__ */ new Map();
        for (const row of liveSessions()) {
          const id = row?.id;
          if (typeof id !== "string" || id === "") continue;
          const seq = row.seq;
          liveSeqs.set(id, typeof seq === "number" && Number.isFinite(seq) ? seq : void 0);
        }
        const liveSeq = liveSeqs.get(sessionId);
        const { fold, source } = await usageCache.sync(sessionId, liveSeq, async () => {
          const snapshot2 = await readSnapshot(sessionId);
          return snapshot2 === void 0 ? [] : snapshot2.events;
        });
        const overrides = readOverrides();
        await loadProviders();
        const selfPriced = priceFold(fold, overrides);
        const children = await foldSubagents(fold, sessionId, liveSeqs);
        let subTotal = zeroBuckets();
        let subPeak = zeroBuckets();
        let subOffPeak = zeroBuckets();
        const subCost = { miss: 0, hit: 0, out: 0, total: 0 };
        let subUnpriced = 0;
        let subLive = 0;
        const quotaModels = /* @__PURE__ */ new Map();
        for (const row of selfPriced.quota.models) {
          quotaModels.set(row.model, {
            usd: row.usd,
            ...row.monthlyLimitUsd === void 0 ? {} : { monthlyLimitUsd: row.monthlyLimitUsd }
          });
        }
        let quotaUsd = selfPriced.quota.usd;
        const mergeQuota = (priced) => {
          quotaUsd += priced.quota.usd;
          for (const row of priced.quota.models) {
            const merged = quotaModels.get(row.model) ?? {
              usd: 0,
              ...row.monthlyLimitUsd === void 0 ? {} : { monthlyLimitUsd: row.monthlyLimitUsd }
            };
            merged.usd += row.usd;
            quotaModels.set(row.model, merged);
          }
        };
        let planProvider = selfPriced.routes.find((route) => planOf(route.provider) !== void 0)?.provider;
        for (const row of children.rows) {
          subTotal = addBuckets(subTotal, row.fold.total);
          subPeak = addBuckets(subPeak, row.fold.tiers.peak);
          subOffPeak = addBuckets(subOffPeak, row.fold.tiers.offPeak);
          const priced = priceFold(row.fold, overrides);
          subCost.miss += priced.cost.miss;
          subCost.hit += priced.cost.hit;
          subCost.out += priced.cost.out;
          subCost.total += priced.cost.total;
          subUnpriced += priced.unpriced;
          mergeQuota(priced);
          planProvider ??= priced.routes.find((route) => planOf(route.provider) !== void 0)?.provider;
          if (liveSeqs.has(row.sessionId)) subLive += 1;
        }
        const planDetail = planProvider === void 0 ? void 0 : planOf(planProvider);
        if (planDetail !== void 0) refreshPlanQuota(usageCtx, planDetail);
        const plan = planDetail === void 0 ? void 0 : peekPlanQuota(planDetail);
        const quota = {
          usd: quotaUsd,
          models: [...quotaModels].map(([model, row]) => ({
            model,
            usd: row.usd,
            ...row.monthlyLimitUsd === void 0 ? {} : { monthlyLimitUsd: row.monthlyLimitUsd },
            ...row.monthlyLimitUsd === void 0 || row.monthlyLimitUsd <= 0 ? {} : { percentOfLimit: row.usd / row.monthlyLimitUsd * 100 }
          }))
        };
        sendJson(res, 200, {
          ok: true,
          sessionId,
          source,
          // 诊断字段：分列出不来时，界面靠 events/samples 区分"没事件"和"事件形状不对"。
          /** 读日志失败的原因（空 = 读到了）；界面据此说"读不到会话日志"而不是显示 ¥0。 */
          readError: readErrorOf.get(sessionId) ?? "",
          events: fold.events,
          samples: fold.samples,
          total: fold.total,
          /** 高峰 / 空闲两档的小计（界面按档显示，也是"逐笔准时"看得见的地方）。 */
          tiers: fold.tiers,
          routes: selfPriced.routes,
          cost: selfPriced.cost,
          /**
           * **订阅通道的额度口径（0.26.0）**。`cost` 是"按刊例价折算值多少钱"，这里是
           * "你实际被扣掉多少套餐额度"——两个口径并存，胶囊默认显示后者（用户 2026-10-27 选定）。
           *
           * `usd` 是本会话（含子代理）的额度消耗；`models` 按模型分组，`percentOfLimit` 是
           * **占该模型月度额度上限**的比例（上限来自官方价目表；官方没公布就没有这个字段）。
           * `plan` 是额度窗口本身（5 小时 / 周 / 月），取不到时 `status` 会说清为什么。
           */
          quota,
          ...plan === void 0 ? {} : { plan },
          /**
           * **子代理**（0.24.0）：本会话派出去的全部子代理会话（含孙代理）的合计。
           *
           * 刻意**不并进**上面的 `total` / `cost` / `routes` —— 那三个字段的口径是"本会话自己"，
           * 客户端拿它跟官方 `tokenUsage` 投影对账（`agreesWithProjection`）：投影只有本会话，
           * 一合并就永远对不上，浮层会退回估算口径（那是 0.8.0 的老毛病）。所以：
           * 本会话的钱在上面的顶层字段，子代理的钱在这里，**加起来才是这次任务真的花了多少**。
           *
           * `missing` / `external` / `skipped` / `unpriced` 是"没算进来"的四个来源，界面必须
           * 把它们说出来：读不到日志的（已归档/读失败）、外部执行的（claude-code 那类，本机
           * 没有会话）、超过递归上限的、以及用量有但认不出单价的。
           */
          subagents: {
            sessions: children.rows.length,
            live: subLive,
            missing: children.missing,
            external: children.external,
            skipped: children.skipped,
            total: subTotal,
            tiers: { peak: subPeak, offPeak: subOffPeak },
            cost: subCost,
            unpriced: subUnpriced
          },
          /**
           * 生效的节假日表（北京日期）。客户端算"下一次峰谷切换"用的是**同一份**规则
           * —— 两边各拿一份自己的表就会出现"胶囊说还有 3 分钟进峰、面板说不是"这种
           * 无法解释的分歧，所以由宿主半回给客户端。
           */
          holidays: moneyRules.holidays
        });
      })();
    };
    usageCtx.effect(() => usageCtx.webServer.register({
      kind: "exact",
      path: USAGE_API_PATH,
      handler: handle
    }), "composer-ux: usage route");
    const handleQuota = (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "GET") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET" });
        return;
      }
      if (rejectUntrustedRequest(usageCtx, req, res)) return;
      const plans = SUBSCRIPTION_PLANS.map((plan) => ({
        ...peekPlanQuota(plan),
        monthlyFeeUsd: plan.monthlyFeeUsd,
        // 引用名给界面看（"没配 key 时该配哪一个"），不含任何密钥内容。
        keyRefs: PLAN_QUOTA_KEY_REFS
      }));
      for (const plan of SUBSCRIPTION_PLANS) refreshPlanQuota(usageCtx, plan);
      sendJson(res, 200, { ok: true, plans });
    };
    usageCtx.effect(() => usageCtx.webServer.register({
      kind: "exact",
      path: QUOTA_API_PATH,
      handler: handleQuota
    }), "composer-ux: quota route");
  });
  ctx.inject(["webServer", "settings"], (syncCtx) => {
    const sendJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    const readBody = async (req) => {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        total += buffer.length;
        if (total > 64e3) break;
        chunks.push(buffer);
      }
      return Buffer.concat(chunks).toString("utf8");
    };
    const settingsService = () => syncCtx.get("settings");
    const readOwn = makeReader(syncCtx.get("settings"), config);
    const readSynced = () => {
      try {
        const synced = readOwn(NAMESPACE)?.[SYNCED_PRICES_FIELD];
        return typeof synced === "object" && synced !== null ? { ...synced } : {};
      } catch {
        return {};
      }
    };
    const writeSynced = async (next) => {
      const service = settingsService();
      if (typeof service?.mutate !== "function") return false;
      try {
        await service.mutate(NAMESPACE, [{ op: "set", path: [SYNCED_PRICES_FIELD], value: next }]);
        return true;
      } catch (error) {
        console.warn("[composer-ux] \u4EF7\u76EE\u540C\u6B65\u5143\u4FE1\u606F\u5199\u5165\u5931\u8D25", error);
        return false;
      }
    };
    const syncOfficial = async () => {
      const pages = await fetchOfficialPages();
      if (pages === void 0) {
        return { ok: false, message: "\u6293\u5B98\u65B9\u4EF7\u683C\u9875\u5931\u8D25", error: "\u6293\u53D6\u5B98\u65B9\u4EF7\u683C\u9875\u5931\u8D25\uFF08\u7F51\u7EDC\u4E0D\u53EF\u8FBE\u6216\u9875\u9762\u6539\u7248\uFF09\uFF0C\u672C\u5730\u4EF7\u76EE\u672A\u6539\u52A8" };
      }
      const fetchedAt = Date.now();
      const era = eraFromOfficial(pages.cny, pages.usd, fetchedAt, "\u4E00\u952E\u540C\u6B65\uFF1Ahttps://api-docs.deepseek.com/zh-cn/quick_start/pricing");
      if (era === void 0) {
        return { ok: false, message: "\u5B98\u65B9\u9875\u89E3\u6790\u4E0D\u51FA\u4EF7\u683C", error: "\u5B98\u65B9\u4EF7\u683C\u9875\u89E3\u6790\u4E0D\u51FA\u4EF7\u683C\uFF08\u9875\u9762\u7ED3\u6784\u53EF\u80FD\u53D8\u4E86\uFF09\uFF0C\u672C\u5730\u4EF7\u76EE\u672A\u6539\u52A8" };
      }
      const synced = readSynced();
      const existing = parsePriceEras(synced.eras) ?? [];
      const currentTable = eraAt(fetchedAt, existing).table;
      if (samePriceTable(currentTable, era.table)) {
        const saved2 = await writeSynced({ ...synced, fetchedAt });
        if (saved2) invalidateMoney();
        return { ok: true, changed: false, fetchedAt, saved: saved2, message: "\u5B98\u65B9\u4EF7\u4E0E\u5F53\u524D\u751F\u6548\u7684\u6863\u4F4D\u4E00\u81F4\uFF0C\u6CA1\u6709\u65B0\u589E\u4EF7\u683C\u6863" };
      }
      const eras = [...existing, era].slice(-20);
      const saved = await writeSynced({ ...synced, fetchedAt, eras });
      if (saved) invalidateMoney();
      if (!saved) {
        return { ok: false, message: "\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u5199", error: "\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u5199\uFF0C\u65B0\u4EF7\u683C\u6863\u6CA1\u6709\u4FDD\u5B58\uFF08\u672C\u5730\u4EF7\u76EE\u672A\u6539\u52A8\uFF09" };
      }
      return {
        ok: true,
        changed: true,
        fetchedAt,
        era: { id: era.id, label: era.label, models: Object.keys(era.table) },
        saved,
        message: `\u5B98\u65B9\u4EF7\u6709\u53D8\u5316\uFF0C\u5DF2\u65B0\u589E\u4EF7\u683C\u6863\u300C${era.label}\u300D\uFF08${Object.keys(era.table).join("\u3001")}\uFF09\uFF1B\u5386\u53F2\u7528\u91CF\u4ECD\u6309\u53D1\u751F\u65F6\u523B\u7684\u65E7\u6863\u7ED3\u7B97`
      };
    };
    const syncModelsDev = async () => {
      const providers = await fetchModelsDevPrices();
      if (providers === void 0) {
        return { ok: false, message: "\u6293\u53D6 models.dev \u5931\u8D25", error: "\u6293\u53D6 models.dev \u5931\u8D25\uFF08\u7F51\u7EDC\u4E0D\u53EF\u8FBE\u6216\u54CD\u5E94\u5F02\u5E38\uFF09\uFF0C\u672C\u5730\u7B2C\u4E09\u65B9\u4EF7\u76EE\u672A\u6539\u52A8" };
      }
      const fetchedAt = Date.now();
      let models = 0;
      for (const table of Object.values(providers)) models += Object.keys(table).length;
      try {
        await writePriceFile({ fetchedAt, providers });
      } catch (error) {
        return {
          ok: false,
          message: "\u4EF7\u76EE\u5199\u76D8\u5931\u8D25",
          error: `\u4EF7\u76EE\u5199\u76D8\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`
        };
      }
      invalidateProviderPrices();
      const saved = await writeSynced({ ...readSynced(), modelsDevAt: fetchedAt, modelsDevCount: models });
      invalidateMoney();
      return {
        ok: true,
        providers: Object.keys(providers).length,
        models,
        fetchedAt,
        saved,
        message: `\u5DF2\u540C\u6B65 ${Object.keys(providers).length} \u4E2A provider / ${models} \u4E2A\u6A21\u578B\u7684\u4EF7\u76EE${saved ? "" : "\uFF08\u8BBE\u7F6E\u91CC\u6CA1\u8BB0\u4E0B\u65F6\u95F4\u6233\uFF1A\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u5199\uFF09"}`
      };
    };
    const syncHolidays = async (options = {}) => {
      const synced = readSynced();
      const have = parseHolidayYears(synced.holidayYears) ?? [];
      const now = Date.now();
      let years;
      if (options.force === true) {
        years = holidayYearsWanted(now);
      } else {
        let enabled = false;
        try {
          enabled = readOwn(NAMESPACE)?.[PRICE_AUTO_SYNC_FIELD];
        } catch {
        }
        years = holidaySyncDue({ enabled, nowMs: now, yearsHave: have, lastAt: synced.holidaysAt });
      }
      if (years.length === 0) {
        return { ok: true, changed: false, message: "\u8282\u5047\u65E5\u8868\u521A\u83B7\u53D6\u8FC7\uFF0C\u8FD9\u6B21\u4E0D\u7528\u518D\u62C9" };
      }
      const result = await fetchHolidayYears(years);
      if (result.fetched.length === 0 && result.unpublished.length === 0) {
        return {
          ok: false,
          message: "\u6293\u53D6\u8282\u5047\u65E5\u5931\u8D25",
          error: `\u6293\u53D6 ${years.join("\u3001")} \u5E74\u7684\u8282\u5047\u65E5\u5931\u8D25\uFF08\u4E24\u4E2A\u6570\u636E\u6E90\u90FD\u6CA1\u62FF\u5230\uFF09\uFF0C\u672C\u5730\u8282\u5047\u65E5\u8868\u672A\u6539\u52A8`
        };
      }
      const merged = mergeHolidayDays(synced.holidays, result.days);
      const yearsNext = [.../* @__PURE__ */ new Set([...have, ...result.fetched])].sort((left, right) => left - right).slice(-12);
      const fetchedAt = Date.now();
      const saved = await writeSynced({
        ...synced,
        ...merged === void 0 ? {} : { holidays: merged },
        holidaysAt: fetchedAt,
        holidayYears: yearsNext
      });
      if (!saved) {
        return {
          ok: false,
          message: "\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u5199",
          error: "\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u5199\uFF0C\u8282\u5047\u65E5\u8868\u6CA1\u6709\u4FDD\u5B58\uFF08\u672C\u5730\u8282\u5047\u65E5\u8868\u672A\u6539\u52A8\uFF09"
        };
      }
      invalidateMoney();
      const parts = [];
      if (result.fetched.length > 0) {
        parts.push(`\u5DF2\u83B7\u53D6 ${result.fetched.join("\u3001")} \u5E74\u7684\u6CD5\u5B9A\u8282\u5047\u65E5\uFF08\u5F53\u524D\u751F\u6548 ${merged?.length ?? 0} \u4E2A\u65E5\u671F\uFF0C\u6765\u6E90 ${HOLIDAY_SOURCE_LABEL}\uFF09`);
      }
      if (result.unpublished.length > 0) {
        parts.push(`${result.unpublished.join("\u3001")} \u5E74\u7684\u5B89\u6392\u8FD8\u6CA1\u516C\u5E03\uFF08\u56FD\u52A1\u9662\u5E74\u5E95\u624D\u53D1\uFF0C\u4E4B\u540E\u4F1A\u81EA\u52A8\u518D\u53D6\uFF09`);
      }
      if (result.failed.length > 0) {
        parts.push(`${result.failed.join("\u3001")} \u5E74\u6CA1\u53D6\u5230\uFF08\u7F51\u7EDC\u6216\u6570\u636E\u6E90\u95EE\u9898\uFF0C\u4E0B\u6B21\u590D\u6838\u518D\u8BD5\uFF09`);
      }
      return {
        ok: true,
        changed: result.fetched.length > 0,
        days: merged?.length ?? 0,
        years: yearsNext,
        fetchedAt,
        saved,
        message: parts.join("\uFF1B")
      };
    };
    const AUTO_SYNC_CHECK_MS = 30 * 6e4;
    const autoSyncIfDue = async () => {
      try {
        const own = readOwn(NAMESPACE) ?? {};
        const due = autoSyncDue({
          enabled: own[PRICE_AUTO_SYNC_FIELD],
          fetchedAt: readSynced().fetchedAt,
          nowMs: Date.now(),
          staleMs: AUTO_SYNC_STALE_MS
        });
        if (due) {
          const result = await syncOfficial();
          console.log(`[composer-ux] \u81EA\u52A8\u540C\u6B65\u5B98\u65B9\u4EF7${result.ok ? "\u6210\u529F" : "\u5931\u8D25"}\uFF1A${result.message}`);
        }
      } catch (error) {
        console.warn("[composer-ux] \u81EA\u52A8\u540C\u6B65\u5B98\u65B9\u4EF7\u5F02\u5E38", error);
      }
      try {
        const holiday = await syncHolidays();
        if (holiday.changed === true) console.log(`[composer-ux] \u81EA\u52A8\u83B7\u53D6\u8282\u5047\u65E5\uFF1A${holiday.message}`);
      } catch (error) {
        console.warn("[composer-ux] \u81EA\u52A8\u83B7\u53D6\u8282\u5047\u65E5\u5F02\u5E38", error);
      }
    };
    syncCtx.effect(() => {
      const timer = setInterval(() => {
        void autoSyncIfDue();
      }, AUTO_SYNC_CHECK_MS);
      void autoSyncIfDue();
      return () => {
        clearInterval(timer);
      };
    }, "composer-ux: \u5B98\u65B9\u4EF7\u4E0E\u8282\u5047\u65E5\u81EA\u52A8\u540C\u6B65\uFF08\u9ED8\u8BA4\u5173\uFF09");
    const handle = (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "POST" && method !== "GET") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
        return;
      }
      if (rejectUntrustedRequest(syncCtx, req, res)) return;
      void (async () => {
        let target = "";
        try {
          const url = typeof req.url === "string" ? req.url : "";
          const queryAt = url.indexOf("?");
          const params = new URLSearchParams(queryAt < 0 ? "" : url.slice(queryAt + 1));
          target = params.get("target") ?? "";
          if (method === "POST") {
            const body = await readBody(req);
            if (body.length > 0) {
              const parsed = JSON.parse(body);
              const wanted = parsed?.target;
              if (typeof wanted === "string" && wanted.length > 0) target = wanted;
            }
          }
        } catch {
        }
        if (target !== "official" && target !== "modelsDev" && target !== "holidays") {
          sendJson(res, 400, { ok: false, error: "target \u5FC5\u987B\u662F official\u3001modelsDev \u6216 holidays" });
          return;
        }
        const result = target === "modelsDev" ? await syncModelsDev() : target === "holidays" ? await syncHolidays({ force: true }) : await syncOfficial();
        sendJson(res, 200, { target, ...result });
      })();
    };
    syncCtx.effect(() => syncCtx.webServer.register({
      kind: "exact",
      path: SYNC_API_PATH,
      handler: handle
    }), "composer-ux: price sync route");
  });
  ctx.inject(["webServer", "settings"], (balanceCtx) => {
    const sendJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    const read = makeReader(balanceCtx.get("settings"), config);
    const resolveKey = async () => {
      const row = read(LLM_DEEPSEEK_NAMESPACE) ?? {};
      const baseUrl = typeof row.baseURL === "string" && row.baseURL.length > 0 ? row.baseURL : DEEPSEEK_BALANCE_URL;
      if (!balanceEndpointAllowed(baseUrl)) {
        let hostname = "(\u89E3\u6790\u4E0D\u51FA\u4E3B\u673A\u540D)";
        try {
          hostname = new URL(baseUrl).hostname;
        } catch {
        }
        return { error: `llm-deepseek \u7684 baseURL \u4E3B\u673A\u662F ${hostname}\uFF0C\u4E0D\u662F\u5B98\u65B9 api.deepseek.com\uFF0C\u62D2\u7EDD\u628A API Key \u53D1\u51FA\u53BB\uFF1B\u8BF7\u6539\u56DE\u5B98\u65B9\u7AEF\u70B9\u518D\u67E5\u4F59\u989D` };
      }
      const ref = typeof row.apiKeyEnv === "string" && row.apiKeyEnv.length > 0 ? row.apiKeyEnv : "DEEPSEEK_API_KEY";
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) {
        return { error: `llm-deepseek \u7684 apiKeyEnv\u300C${ref}\u300D\u4E0D\u662F\u5408\u6CD5\u7684\u73AF\u5883\u53D8\u91CF\u540D\uFF0C\u6539\u6210\u4E00\u4E2A\u5408\u6CD5\u540D\u5B57\uFF08\u4F8B\u5982 DEEPSEEK_API_KEY\uFF09` };
      }
      const credentials = balanceCtx.get("credentials");
      if (typeof credentials?.resolve !== "function") {
        return { error: "\u5BBF\u4E3B\u6CA1\u6709\u51ED\u636E\u670D\u52A1\uFF0C\u8BFB\u4E0D\u5230 API Key\uFF08\u628A DEEPSEEK_API_KEY \u653E\u8FDB\u73AF\u5883\u53D8\u91CF\u4E5F\u4E0D\u884C\uFF1A\u6CA1\u6709\u670D\u52A1\u5C31\u6CA1\u4EBA\u53BB\u8BFB\u5B83\uFF09" };
      }
      try {
        const resolved = await credentials.resolve(ref);
        const key = typeof resolved?.value === "string" ? resolved.value : "";
        if (key === "") return { error: `\u51ED\u636E ${ref} \u6CA1\u6709\u914D\u7F6E\uFF0C\u5148\u5728\u8BBE\u7F6E\u9875\u628A DeepSeek \u7684 API Key \u586B\u4E0A` };
        return { key };
      } catch (error) {
        return { error: `\u89E3\u6790\u51ED\u636E ${ref} \u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}` };
      }
    };
    const handle = (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
        return;
      }
      if (rejectUntrustedRequest(balanceCtx, req, res)) return;
      void (async () => {
        const own = read(NAMESPACE) ?? {};
        if (own[BALANCE_ENABLED_FIELD] === false) {
          sendJson(res, 200, { ok: false, error: "\u4F59\u989D\u67E5\u8BE2\u5DF2\u5728\u8BBE\u7F6E\u91CC\u5173\u95ED" });
          return;
        }
        const key = await resolveKey();
        if ("error" in key) {
          sendJson(res, 200, { ok: false, error: key.error });
          return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1e4);
        try {
          const response = await fetch(DEEPSEEK_BALANCE_URL, {
            headers: { accept: "application/json", authorization: `Bearer ${key.key}` },
            signal: controller.signal
          });
          if (response.ok !== true) {
            sendJson(res, 200, { ok: false, error: `\u5B98\u65B9\u4F59\u989D\u63A5\u53E3\u8FD4\u56DE ${response.status}` });
            return;
          }
          const payload = await response.json();
          const snapshot2 = parseBalancePayload(payload);
          if (snapshot2 === void 0) {
            sendJson(res, 200, { ok: false, error: "\u5B98\u65B9\u4F59\u989D\u54CD\u5E94\u5F62\u72B6\u4E0D\u5BF9\uFF08\u89E3\u6790\u4E0D\u51FA\u4F59\u989D\uFF0C\u7EDD\u4E0D\u7528 0 \u5192\u5145\uFF09" });
            return;
          }
          sendJson(res, 200, { ok: true, available: snapshot2.available, entries: snapshot2.entries });
        } catch (error) {
          console.warn("[composer-ux] \u67E5\u4F59\u989D\u5931\u8D25", error);
          sendJson(res, 200, { ok: false, error: "\u67E5\u4F59\u989D\u5931\u8D25\uFF08\u7F51\u7EDC\u4E0D\u53EF\u8FBE\u6216\u8D85\u65F6\uFF09\uFF1B\u8BE6\u60C5\u89C1 DSH \u65E5\u5FD7" });
        } finally {
          clearTimeout(timer);
        }
      })();
    };
    balanceCtx.effect(() => balanceCtx.webServer.register({
      kind: "exact",
      path: BALANCE_API_PATH,
      handler: handle
    }), "composer-ux: balance route");
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
        await retryWrite(
          () => service.mutate(NAMESPACE, [{ op: "set", path: [QUICK_ENABLED_FIELD], value: true }]),
          STARTUP_WRITE_ATTEMPTS,
          STARTUP_WRITE_RETRY_MS
        );
      } catch (error) {
        console.error("[composer-ux] quick section migration skipped", error);
      }
    })();
  });
  ctx.inject(["webServer"], (navCtx) => {
    const sendJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    const readBody = async (req) => {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        total += buf.length;
        if (total > 64e3) throw new Error("\u8BF7\u6C42\u4F53\u8FC7\u5927");
        chunks.push(buf);
      }
      return Buffer.concat(chunks).toString("utf8");
    };
    const readNavFold = () => {
      const fallback = { mode: DEFAULT_NAV_FOLD.mode, collapsed: DEFAULT_NAV_FOLD.collapsed };
      try {
        const parsed = JSON.parse(readFileSync5(navFoldStorePath(), "utf8"));
        const mode = parsed.mode === "off" || parsed.mode === "icons" || parsed.mode === "bar" ? parsed.mode : fallback.mode;
        return { mode, collapsed: typeof parsed.collapsed === "boolean" ? parsed.collapsed : fallback.collapsed };
      } catch {
        return fallback;
      }
    };
    const handleNavFold = async (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") {
        sendJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
        return;
      }
      if (rejectUntrustedRequest(navCtx, req, res)) return;
      if (method === "GET") {
        sendJson(res, 200, { ok: true, ...readNavFold() });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(await readBody(req));
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "\u6B63\u6587\u4E0D\u662F JSON" });
        return;
      }
      const current = readNavFold();
      const next = { ...current };
      if (payload.mode !== void 0) {
        if (payload.mode !== "off" && payload.mode !== "bar" && payload.mode !== "icons") {
          sendJson(res, 400, { ok: false, error: "mode \u53EA\u80FD\u662F off / bar / icons" });
          return;
        }
        next.mode = payload.mode;
      }
      if (payload.collapsed !== void 0) {
        if (typeof payload.collapsed !== "boolean") {
          sendJson(res, 400, { ok: false, error: "collapsed \u5FC5\u987B\u662F\u5E03\u5C14" });
          return;
        }
        next.collapsed = payload.collapsed;
      }
      try {
        const target = navFoldStorePath();
        mkdirSync3(dirname8(target), { recursive: true });
        writeFileSync3(target, JSON.stringify(next, null, 2) + String.fromCharCode(10), "utf8");
      } catch (error) {
        sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
        return;
      }
      sendJson(res, 200, { ok: true, ...next });
    };
    void navCtx.effect(() => navCtx.webServer.register({
      kind: "exact",
      path: NAV_FOLD_API_PATH,
      handler: handleNavFold
    }), "composer-ux: nav fold route");
  });
  ctx.inject(["webServer"], (doctorCtx) => {
    const doctorRead = makeReader(doctorCtx.get("settings"), config);
    const sendDoctorJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    const pluginVersion = (() => {
      try {
        const require_ = process.getBuiltinModule("node:module").createRequire(import.meta.url);
        return String(require_("../package.json").version ?? "");
      } catch {
        return "";
      }
    })();
    const collectDoctor = async () => {
      const own = doctorRead(NAMESPACE) ?? {};
      const has = (name2) => {
        try {
          return doctorCtx.get(name2) !== void 0;
        } catch {
          return false;
        }
      };
      const bool = (field) => own[field] === true;
      const text = (field) => textOf3(own[field]);
      const persistentTerminals = (() => {
        const profileDir = (() => {
          try {
            const value = doctorCtx.get("profileContext");
            return typeof value?.dir === "string" ? value.dir : "";
          } catch {
            return "";
          }
        })();
        const manifestOf = (name2) => {
          if (profileDir === "") return void 0;
          try {
            const file = join8(profileDir, "node_modules", ...name2.split("/"), "package.json");
            return objectOf3(JSON.parse(readFileSync5(file, "utf8")));
          } catch {
            return void 0;
          }
        };
        const tool = manifestOf("@deepseek-ai/dsh-tool-terminal");
        const peers = objectOf3(tool?.peerDependencies);
        const peerName = Object.keys(peers ?? {}).find((key) => key.startsWith("@deepseek-ai/dsh-")) ?? "";
        const peerRequired = peerName === "" ? "" : textOf3(peers?.[peerName]);
        const runtimeVersion = (() => {
          try {
            let dir = process.argv[1] === void 0 ? "" : dirname8(process.argv[1]);
            for (let depth = 0; depth < 6 && dir !== ""; depth += 1) {
              const file = join8(dir, "package.json");
              if (existsSync6(file)) return textOf3(JSON.parse(readFileSync5(file, "utf8")).version);
              const parent = dirname8(dir);
              if (parent === dir) break;
              dir = parent;
            }
            return "";
          } catch {
            return "";
          }
        })();
        const peerInstalled = peerName === "" ? "" : textOf3(manifestOf(peerName)?.version);
        const marker = runtimeVersion !== "" ? runtimeVersion : peerInstalled;
        return {
          servicePresent: has("terminals"),
          toolVersion: textOf3(tool?.version),
          peerRequired,
          peerInstalled: marker,
          // 两边都读到了才敢判"不匹配"；读不到就当不知道（自检不许编）。
          mismatch: peerRequired !== "" && marker !== "" && peerRequired !== marker
        };
      })();
      const quickOutcome = await readQuickBook(quickStorePath()).catch(() => ({ kind: "error" }));
      return {
        version: pluginVersion,
        enabled: bool(ENABLED_FIELD),
        sections: {
          \u952E\u4F4D: bool(KEYS_ENABLED_FIELD),
          \u53F3\u952E\u83DC\u5355: bool(MENU_ENABLED_FIELD),
          \u5FEB\u6377\u6307\u4EE4: bool(QUICK_ENABLED_FIELD),
          \u8BBE\u7F6E\u9762\u677F: bool(PANEL_ENABLED_FIELD),
          \u9ED8\u8BA4\u7EC8\u7AEF: bool(TERMINAL_ENABLED_FIELD),
          \u5FAE\u4FE1\u901A\u77E5: bool(NOTIFY_ENABLED_FIELD),
          "OpenCode \u8BF7\u6C42\u5934": bool(HEADER_ENABLED_FIELD),
          \u53EA\u8BFB\u67E5\u8BC1: bool(OPTIMIZE_READ_TOOLS_FIELD)
        },
        fieldConstants: ALL_SETTINGS_FIELDS,
        schemaKeys: Object.keys(ownSchema().dict ?? {}),
        terminal: {
          platform: process.platform,
          rowInstalled: has("terminals"),
          bashPath: text(TERMINAL_BASH_PATH_FIELD),
          status: text(TERMINAL_STATUS_FIELD),
          mode: (() => {
            try {
              const policy = doctorCtx.get("sandboxPolicy");
              const mode = policy?.resolve?.().mode;
              return typeof mode === "string" ? mode : "\u62FF\u4E0D\u5230";
            } catch {
              return "\u62FF\u4E0D\u5230";
            }
          })(),
          hasSandbox: has("sandbox")
        },
        persistentTerminals,
        header: {
          overlayInstalled: headerOverlayState.installed,
          hasLoader: has("loader"),
          migrated: pendingMigrations(own).length === 0,
          status: text(HEADER_STATUS_FIELD),
          // 0.22.0 起这条链不再写用户配置；真写了就是回归，自检要红。
          writesUserConfig: false,
          // 0.25.0：宿主自己会发这个头时，上面那些"挂没挂上"都不再重要（见 src/opencode-header.ts）。
          native: nativeSessionHeader().support === "native",
          nativeEvidence: nativeSessionHeader().evidence
        },
        quick: {
          file: quickStorePath(),
          readable: quickOutcome.kind === "ok",
          custom: quickOutcome.kind === "ok" ? bookLooksCustom(quickOutcome.book) : false,
          error: quickOutcome.kind === "ok" ? "" : String(quickOutcome.kind)
        },
        notify: {
          enabled: bool(NOTIFY_ENABLED_FIELD),
          channel: text(NOTIFY_CHANNEL_FIELD),
          credentialSet: text(NOTIFY_PUSHPLUS_FIELD) !== "" || text(NOTIFY_WECOM_FIELD) !== ""
        },
        optimize: {
          tier: text(OPTIMIZER_TIER_FIELD),
          readTools: bool(OPTIMIZE_READ_TOOLS_FIELD),
          bashOn: bool(OPTIMIZE_BASH_FIELD),
          bashGate: "\u6309\u4F1A\u8BDD\u6743\u9650\u5224\u5B9A\uFF08\u5B8C\u5168\u6743\u9650\u76F4\u8DD1\uFF1B\u5426\u5219\u5FC5\u987B\u8FC7\u6C99\u7BB1\uFF0C\u8BC1\u660E\u4E0D\u4E86\u5C31\u4E0D\u7ED9\uFF09"
        },
        runtime: { node: process.version, dshVersion: runtimeVersionOf() }
      };
    };
    const handleDoctor = async (req, res) => {
      if ((req.method ?? "GET").toUpperCase() !== "GET") {
        sendDoctorJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET" });
        return;
      }
      try {
        sendDoctorJson(res, 200, { ok: true, rows: buildDoctorReport(await collectDoctor()) });
      } catch (error) {
        sendDoctorJson(res, 500, { ok: false, error: errorText3(error) });
      }
    };
    doctorCtx.effect(() => doctorCtx.webServer.register({
      kind: "exact",
      path: DOCTOR_API_PATH,
      handler: handleDoctor
    }), "composer-ux: doctor route");
  });
  ctx.inject(["webServer"], (autoCtx) => {
    const sendAutoJson = (res, code, payload) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    const readAutoBody = async (req) => {
      const chunks = [];
      let total = 0;
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        total += buf.length;
        if (total > 64e3) throw new Error("\u8BF7\u6C42\u4F53\u8FC7\u5927");
        chunks.push(buf);
      }
      return Buffer.concat(chunks).toString("utf8");
    };
    const runtime = () => runtimeOf(process.argv[1]);
    const profileNameOf = () => {
      try {
        const value = autoCtx.get("profileContext");
        return typeof value?.name === "string" ? value.name : "";
      } catch {
        return "";
      }
    };
    const desktopExeOf = () => {
      if (process.platform !== "win32") return "";
      try {
        const out = execFileSync("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-Process -Id ${String(process.ppid)} -ErrorAction SilentlyContinue).Path`
        ], { encoding: "utf8", windowsHide: true, timeout: 8e3 });
        const line = String(out).split(/\r?\n/u).map((item) => item.trim()).find((item) => item !== "");
        return line !== void 0 && /\.exe$/iu.test(line) ? line : "";
      } catch {
        return "";
      }
    };
    const stateDirOf = () => join8(dirname8(quickStorePath()), "composer-ux");
    const planOf2 = () => {
      const kind = runtime();
      const profile = profileNameOf();
      const launch = launchCommand({
        node: nodeExecutableOf({ argv0: process.argv0, execPath: process.execPath, exists: existsSync6 }),
        argv1: process.argv[1],
        execArgv: process.execArgv,
        rest: process.argv.slice(2),
        cwd: process.cwd(),
        platform: process.platform,
        resolve: resolve4,
        dirname: dirname8
      });
      const facts = {
        platform: process.platform,
        runtime: kind,
        profile,
        stateDir: stateDirOf(),
        desktopExe: kind === "desktop" ? desktopExeOf() : "",
        launch
      };
      return planAutostart(facts);
    };
    const readEntry = (entryName) => {
      if (process.platform !== "win32") return { value: void 0, error: "" };
      try {
        const out = execFileSync("reg.exe", [...listArgs()], { encoding: "utf8", windowsHide: true, timeout: 8e3 });
        return { value: parseQueryValue(entryName, out), error: "" };
      } catch (error) {
        const status = error.status;
        if (status === 1) return { value: void 0, error: "" };
        return {
          value: void 0,
          error: status === void 0 ? "\u8BFB\u6CE8\u518C\u8868\u5931\u8D25\uFF08reg.exe \u6CA1\u8D77\u6765\uFF09" : "\u8BFB\u6CE8\u518C\u8868\u5931\u8D25\uFF08reg.exe \u9000\u51FA\u7801 " + String(status) + "\uFF09"
        };
      }
    };
    const writeLauncher = (plan) => {
      if (plan.launcher === void 0) return;
      mkdirSync3(dirname8(plan.launcher.path), { recursive: true });
      writeFileSync3(plan.launcher.path, plan.launcher.content, "utf8");
    };
    const removeLauncher = (plan) => {
      if (plan.launcher === void 0) return;
      try {
        rmSync2(plan.launcher.path, { force: true });
      } catch {
      }
    };
    const stateOf = () => {
      const plan = planOf2();
      const read = readEntry(plan.entryName);
      return describeAutostart({
        platform: process.platform,
        plan,
        registered: read.value,
        readError: read.error
      });
    };
    const applyEnabled = (enabled) => {
      const unsupported = unsupportedReason(process.platform);
      if (unsupported !== "") return { ok: false, error: unsupported };
      const plan = planOf2();
      if (enabled && runtime() === "desktop" && plan.value.trim() === '""') {
        return { ok: false, error: "\u62FF\u4E0D\u5230\u684C\u9762\u5E94\u7528\u7684 exe \u8DEF\u5F84\uFF08\u7236\u8FDB\u7A0B\u8DEF\u5F84\u8BFB\u4E0D\u5230\uFF09\uFF0C\u6CA1\u6CD5\u6CE8\u518C\u81EA\u542F\u52A8" };
      }
      try {
        if (enabled) {
          writeLauncher(plan);
          execFileSync("reg.exe", [...addArgs(plan.entryName, plan.value)], { encoding: "utf8", windowsHide: true, timeout: 8e3 });
        } else {
          try {
            execFileSync("reg.exe", [...deleteArgs(plan.entryName)], { encoding: "utf8", windowsHide: true, timeout: 8e3 });
          } catch (error) {
            const text = errorText3(error);
            if (!/找不到|cannot find|unable to find/iu.test(text)) throw error;
          }
          removeLauncher(plan);
        }
        return { ok: true, error: "" };
      } catch (error) {
        const text = errorText3(error);
        return {
          ok: false,
          error: /拒绝访问|Access is denied/iu.test(text) ? "\u6CA1\u6709\u6743\u9650\u5199\u5F53\u524D\u7528\u6237\u7684\u542F\u52A8\u9879\uFF08\u88AB\u5B89\u5168\u8F6F\u4EF6\u6216\u7EC4\u7B56\u7565\u62E6\u4E86\uFF1F\uFF09" : `${enabled ? "\u6CE8\u518C" : "\u64A4\u9500"}\u5931\u8D25\uFF1A${text === "" ? "\u6CA1\u6709\u539F\u56E0" : text}`
        };
      }
    };
    const tryOnce = () => {
      const unsupported = unsupportedReason(process.platform);
      if (unsupported !== "") return { ok: false, message: unsupported };
      const plan = planOf2();
      if (runtime() === "web") {
        const port = (() => {
          try {
            return autoCtx.get("webServer")?.port;
          } catch {
            return void 0;
          }
        })();
        if (typeof port === "number" && port > 0) {
          return { ok: true, message: `\u8FD9\u4E2A profile \u5DF2\u7ECF\u5728\u670D\u52A1\uFF08\u7AEF\u53E3 ${String(port)}\uFF09\uFF0C\u6CA1\u6709\u91CD\u590D\u542F\u52A8\uFF1B\u60F3\u770B\u81EA\u542F\u52A8\u7684\u7A97\u53E3\u6548\u679C\u5C31\u624B\u52A8\u8DD1\uFF1A${plan.describe}` };
        }
      }
      try {
        if (plan.launcher !== void 0) {
          writeLauncher(plan);
          const child2 = spawn2("wscript.exe", [plan.launcher.path], { detached: true, stdio: "ignore", windowsHide: true });
          child2.unref();
          return { ok: true, message: `\u5DF2\u6309\u81EA\u542F\u52A8\u90A3\u6761\u547D\u4EE4\u62C9\u8D77\uFF08\u6700\u5C0F\u5316\u5230\u4EFB\u52A1\u680F\uFF09\uFF1A${plan.describe}` };
        }
        const exe = plan.value.replace(/^"|"$/gu, "");
        const child = spawn2(exe, [], { detached: true, stdio: "ignore" });
        child.unref();
        return { ok: true, message: `\u5DF2\u62C9\u8D77\u684C\u9762\u5E94\u7528\uFF08\u6709\u5355\u5B9E\u4F8B\u9501\uFF0C\u91CD\u590D\u542F\u52A8\u53EA\u4F1A\u805A\u7126\u5DF2\u6709\u7A97\u53E3\uFF09` };
      } catch (error) {
        return { ok: false, message: `\u8BD5\u4E00\u6B21\u5931\u8D25\uFF1A${errorText3(error)}` };
      }
    };
    const handleAutostart = async (req, res) => {
      const method = (req.method ?? "GET").toUpperCase();
      try {
        if (method === "GET") {
          sendAutoJson(res, 200, { ok: true, state: stateOf() });
          return;
        }
        if (method !== "POST") {
          sendAutoJson(res, 405, { ok: false, error: "\u53EA\u63A5\u53D7 GET / POST" });
          return;
        }
        const raw = await readAutoBody(req);
        let body = {};
        if (raw.trim() !== "") {
          try {
            body = objectOf3(JSON.parse(raw)) ?? {};
          } catch {
            sendAutoJson(res, 400, { ok: false, error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" });
            return;
          }
        }
        if (body.action === "try") {
          const result = tryOnce();
          sendAutoJson(res, result.ok ? 200 : 500, { ...result, state: stateOf(), action: "try" });
          return;
        }
        if (typeof body.enabled !== "boolean") {
          sendAutoJson(res, 400, { ok: false, error: '\u8981\u5E26 enabled: true/false\uFF08\u6216 action: "try"\uFF09' });
          return;
        }
        const applied = applyEnabled(body.enabled);
        sendAutoJson(res, applied.ok ? 200 : 500, {
          ok: applied.ok,
          error: applied.error,
          state: stateOf(),
          action: body.enabled ? "on" : "off"
        });
      } catch (error) {
        sendAutoJson(res, 500, { ok: false, error: errorText3(error) });
      }
    };
    autoCtx.effect(() => autoCtx.webServer.register({
      kind: "exact",
      path: AUTOSTART_API_PATH,
      handler: handleAutostart
    }), "composer-ux: autostart route");
  });
  ctx.inject(["webServer"], (restartCtx) => {
    const BOOT_ID = bootId(process.pid, Date.now());
    const blockedBy = () => {
      const supervisor = detectedSupervisor({
        env: process.env,
        ppid: process.ppid,
        parentComm: (pid) => {
          try {
            return readFileSync5(`/proc/${String(pid)}/comm`, "utf8").trim();
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
      ppid: process.ppid,
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
      exists: (path) => existsSync6(path),
      resolve: (path) => resolve4(path),
      dirname: (path) => dirname8(path),
      join: (...parts) => join8(...parts),
      spawn: (command, args, options) => spawn2(command, [...args], {
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
        logHint: join8(io.tmpdir, `${RESTART_LOG_PREFIX}*.err.log`)
      };
    };
    const readNotifySettings = () => {
      const service = restartCtx.get("settings");
      const raw = typeof service?.get === "function" ? service.get(NAMESPACE) : void 0;
      if (raw === void 0) throw new Error("\u8BFB\u4E0D\u5230\u672C\u63D2\u4EF6\u7684\u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\uFF08\u8FD9\u4E5F\u8BF4\u660E reader \u6CA1\u63A5\u5BF9\uFF09");
      const all = sanitizeSettings(raw);
      return {
        enabled: all.notifyEnabled,
        channel: all.notifyChannel,
        pushplusToken: all.notifyPushplusToken,
        wecomWebhook: all.notifyWecomWebhook,
        kinds: all.notifyKinds
      };
    };
    const notifyFetchText = async (url, init) => {
      const response = await fetch(url, { method: init.method, headers: { ...init.headers }, body: init.body });
      return { status: response.status, body: await response.text() };
    };
    restartCtx.effect(() => restartCtx.webServer.register({
      kind: "exact",
      path: NOTIFY_TEST_API_PATH,
      handler: createNotifyTestHandler({ readSettings: readNotifySettings, fetchText: notifyFetchText })
    }));
    restartCtx.effect(() => {
      const bus = restartCtx;
      if (typeof bus.on !== "function") {
        console.warn("[composer-ux] \u8FD9\u4E2A\u5BBF\u4E3B\u6CA1\u6709\u4E8B\u4EF6\u603B\u7EBF\uFF08ctx.on\uFF09\uFF0C\u5FAE\u4FE1\u901A\u77E5\u7684\u4E8B\u4EF6\u94A9\u5B50\u6CA1\u6302\u4E0A");
        return;
      }
      const lastSent = {};
      const dispose = registerNotifyHooks({
        on: (name2, handler) => bus.on?.(name2, handler),
        deliver: (event) => {
          void sendNotification(readNotifySettings(), event, { fetchText: notifyFetchText, lastSent }).then((outcome) => {
            if (!outcome.sent && outcome.reason !== "") console.warn(`[composer-ux] \u5FAE\u4FE1\u901A\u77E5\u672A\u53D1\u51FA\uFF1A${outcome.reason}`);
          }).catch((error) => {
            console.warn("[composer-ux] \u5FAE\u4FE1\u901A\u77E5\u5F02\u5E38", error);
          });
        },
        // TODO(0.17.x)：宿主里没有现成的"会话 id → 标题"查表，先给空串（消息省掉「会话：」那行）。
        titleOf: () => "",
        warn: (message) => {
          console.warn(`[composer-ux] ${message}`);
        }
      });
      return dispose;
    });
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
        if (firstHeaderValue(req.headers?.[RESTART_CSRF_HEADER]) !== RESTART_CSRF_VALUE) {
          send(403, {
            ok: false,
            error: `\u7F3A\u5C11 ${RESTART_CSRF_HEADER}: ${RESTART_CSRF_VALUE} \u5934\uFF08\u8DE8\u7AD9\u9875\u9762\u52A0\u4E0D\u4E86\u8FD9\u4E2A\u5934\uFF09`
          });
          return;
        }
        if (firstHeaderValue(req.headers?.[RESTART_CSRF_HEADER]) !== RESTART_CSRF_VALUE) {
          send(403, {
            ok: false,
            error: `\u7F3A\u5C11 ${RESTART_CSRF_HEADER}: ${RESTART_CSRF_VALUE} \u5934\uFF08\u8DE8\u7AD9\u9875\u9762\u52A0\u4E0D\u4E86\u8FD9\u4E2A\u5934\uFF09`
          });
          return;
        }
        const trust = explainRestartTrust({
          remoteAddress: req.socket?.remoteAddress,
          headers: req.headers ?? {}
        });
        if (trust.reason !== "ok") {
          send(403, {
            ok: false,
            error: "restart is limited to same-origin loopback requests \u2014\u2014 " + restartTrustText(trust)
          });
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
          send(202, { boot: BOOT_ID, running, ...scheduled });
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
  STARTUP_WRITE_ATTEMPTS,
  STARTUP_WRITE_RETRY_MS,
  apply,
  name,
  readHeaderRequest,
  retryWrite
};
//# sourceMappingURL=index.js.map
