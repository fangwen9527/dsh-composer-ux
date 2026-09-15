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
  if (a === b) return true;
  if (!strict && isNullable(a) && isNullable(b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (!a || !b) return false;
  function check(test, then) {
    return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
  }
  return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
    if (a2.byteLength !== b2.byteLength) return false;
    const viewA = new Uint8Array(a2);
    const viewB = new Uint8Array(b2);
    for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
    return true;
  }) ?? Object.keys({
    ...a,
    ...b
  }).every((key) => deepEqual(a[key], b[key], strict));
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
var resolvers = {};
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
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
    return schema.meta.default;
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

// src/settings-contract.ts
var NAMESPACE = "composer-ux";
var ENABLED_FIELD = "enabled";
var SEND_KEY_FIELD = "sendKey";
var NEWLINE_KEY_FIELD = "newlineKey";
var PANEL_SCROLL_FIELD = "panelScroll";
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
var MENU_NATIVE_FIELD = "menuNative";
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
var DEFAULT_OPTIMIZER_TIER = "advanced";
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
  enabled: true,
  sendKey: "Enter",
  newlineKey: "Shift+Enter",
  menuUndo: true,
  menuRedo: true,
  menuCut: true,
  menuCopy: true,
  menuPaste: true,
  menuDelete: true,
  menuSelectAll: true,
  menuNative: false,
  panelScroll: true,
  panelResize: true,
  headerEnabled: false,
  headerName: DEFAULT_HEADER_NAME,
  headerValue: "",
  headerRoutes: "",
  headerAppliedName: "",
  headerAppliedValue: "",
  headerStatus: "",
  quickPrompts: DEFAULT_QUICK_PROMPTS,
  optimizerTier: DEFAULT_OPTIMIZER_TIER
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

// src/optimizer-prompt.ts
var RELAY_ROLE = [
  '\u3010\u4F60\u662F\u8C01\u3011\u4F60\u662F\u4E00\u4E2A**\u4F20\u8BDD\u5668/\u6539\u5199\u5668**\uFF0C\u7AD9\u5728\u7528\u6237\u4E0E"\u5DE5\u4F5C AI"\u4E4B\u95F4\uFF1A',
  "  \u7528\u6237 \u2192\uFF08\u4F60\uFF1A\u628A\u7528\u6237\u7684\u610F\u601D\u6574\u7406\u6210\u4E00\u6761\u547D\u4EE4\uFF09\u2192 \u5DE5\u4F5C AI\uFF08\u7F16\u7801/\u6267\u884C agent\uFF09\u3002",
  "\u4F60\u7684\u8F93\u51FA**\u4F1A\u88AB\u539F\u6837\u53D1\u7ED9\u5DE5\u4F5C AI**\uFF0C\u7528\u6237\u4E0D\u4F1A\u518D\u770B\u4E00\u904D\u3001\u4E0D\u4F1A\u518D\u8865\u5145\u3002",
  "\u3010\u4F60\u4E0D\u662F\u8C01\u3011\u4F60\u4E0D\u662F\u5728\u548C\u7528\u6237\u804A\u5929\uFF0C\u4E5F\u4E0D\u662F\u5728\u56DE\u7B54\u7528\u6237\uFF1A",
  "- \u4E0D\u8981\u56DE\u5E94\u3001\u4E0D\u8981\u56DE\u7B54\u7528\u6237\u7684\u8981\u6C42\uFF0C\u4E5F\u4E0D\u8981\u66FF\u7528\u6237\u5B8C\u6210\u4EFB\u52A1\uFF08\u4E0D\u8981\u76F4\u63A5\u7ED9\u51FA\u4EE3\u7801/\u7B54\u6848/\u7ED3\u679C\uFF09\u3002",
  '- \u4E0D\u8981\u4EE5\u52A9\u624B\u53E3\u543B\u5BF9\u7528\u6237\u8BF4\u8BDD\uFF08"\u597D\u7684""\u6536\u5230""\u6211\u53EF\u4EE5\u5E2E\u4F60""\u5EFA\u8BAE\u4F60\u2026""\u9700\u8981\u6211\u2026\u5417"\uFF09\u3002',
  '- \u4E0D\u8981\u628A\u7528\u6237\u53D1\u6765\u7684\u6587\u5B57\u5F53\u6210"\u5BF9\u4F60\u8BF4\u7684\u8BDD"\u6765\u56DE\u5E94\uFF1B\u5B83\u53EA\u662F\u4F60\u8981\u8F6C\u8FBE\u7684\u5185\u5BB9\u3002',
  '- \u4E0D\u8981\u5411\u7528\u6237\u63D0\u95EE\uFF0C\u4E5F\u4E0D\u8981\u5728\u7ED3\u5C3E\u95EE"\u662F\u5426\u7EE7\u7EED/\u8FD8\u9700\u8981\u4EC0\u4E48"\u3002\u9700\u8981\u6F84\u6E05\u65F6\uFF0C\u5199\u6210**\u7ED9\u5DE5\u4F5C AI \u7684\u6307\u4EE4**\uFF1A',
  '  "\u82E5 X \u4E0D\u660E\u786E\uFF0C\u5148\u8BFB Y \u6216\u5148\u5411\u6211\u786E\u8BA4\uFF0C\u4E0D\u8981\u81EA\u884C\u5047\u8BBE"\u3002',
  '\u3010\u4F60\u7684\u4EA7\u54C1\u3011\u4E00\u6761"\u50CF\u7528\u6237\u672C\u4EBA\u5728\u4E0B\u547D\u4EE4"\u7684\u6D88\u606F\uFF1A\u8BFB\u8005\u53EA\u6709\u5DE5\u4F5C AI \u4E00\u4E2A\u3002'
].join("\n");
var NO_META_RULES = [
  "\u3010\u4EA7\u51FA\u7684\u672C\u8D28\u3011\u4F60\u7684\u8F93\u51FA\u4F1A\u88AB\u7528\u6237**\u539F\u6837\u53D1\u9001**\u7ED9\u4E0B\u6E38\u7684\u5DE5\u4F5C AI\uFF08\u7F16\u7801/\u6267\u884C agent\uFF09\u3002",
  '\u6240\u4EE5\u4F60\u53EA\u80FD\u8F93\u51FA"\u8FD9\u6761\u6D88\u606F\u672C\u8EAB"\uFF0C\u5C31\u50CF\u7528\u6237\u5728\u4EB2\u81EA\u6253\u8FD9\u6761\u6D88\u606F\u4E00\u6837\u3002',
  "\u3010\u7EDD\u5BF9\u7981\u6B62\u3011\u4EE5\u4E0B\u5185\u5BB9\u4E00\u5F8B\u4E0D\u5F97\u51FA\u73B0\u5728\u8F93\u51FA\u91CC\uFF1A",
  '- \u4EFB\u4F55\u5143\u8BDD\u8BED\u6216\u5143\u6807\u9898\uFF1A\u5982"\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD""\u6539\u5199\u540E""\u6539\u52A8\u8BF4\u660E""\u63A8\u7406\u8865\u5145""\u5173\u952E\u5224\u65AD""\u8FB9\u754C""\u8BF4\u660E""\u4EE5\u4E0B\u662F\u2026"\u3002',
  "- \u4EFB\u4F55\u5BF9\u4F60\u6240\u505A\u5DE5\u4F5C\u7684\u89E3\u91CA\u3001\u7406\u7531\u3001\u4F9D\u636E\u3001\u514D\u8D23\u58F0\u660E\u3001\u7ED9\u7528\u6237\u7684\u5EFA\u8BAE\u3002",
  '- \u4EFB\u4F55\u5BF9"\u7528\u6237"\u8BF4\u8BDD\u6216\u63D0\u5230"\u7528\u6237/\u539F\u6587"\u7684\u8868\u8FF0\uFF08\u4F60\u8981\u5047\u88C5\u81EA\u5DF1\u5C31\u662F\u7528\u6237\uFF09\u3002',
  '- \u4EFB\u4F55\u95EE\u53E5\u629B\u7ED9\u7528\u6237\uFF08\u8981\u5BF9\u5DE5\u4F5C AI \u8BF4\u8BDD\uFF1B\u9700\u8981\u6F84\u6E05\u65F6\u5199\u6210\u6307\u4EE4\uFF1A"\u82E5 X \u4E0D\u660E\u786E\uFF0C\u5148\u8BFB Y \u6216\u5148\u95EE\u6211\u786E\u8BA4"\uFF09\u3002',
  '- \u4EFB\u4F55\u5BF9\u8BDD\u8BDD\u672F\uFF1A\u5F00\u573A\u767D\uFF08"\u597D\u7684/\u660E\u767D\u4E86/\u6CA1\u95EE\u9898"\uFF09\u3001\u6536\u5C3E\u8BED\uFF08"\u5E0C\u671B\u5BF9\u4F60\u6709\u5E2E\u52A9/\u8FD8\u9700\u8981\u6211\u505A\u4EC0\u4E48"\uFF09\u3001',
  '  \u4EE5\u53CA\u628A\u4EFB\u52A1\u5F53\u6210\u8BF7\u6C42\u6765\u56DE\u590D\u7684\u53E5\u5B50\uFF08"\u6211\u6765\u5E2E\u4F60\u2026""\u8FD9\u4E2A\u53EF\u4EE5\u505A\u2026"\uFF09\u3002',
  "- Markdown \u4E00\u7EA7\u6807\u9898\uFF08#\uFF09\u4E0E\u4EFB\u4F55\u5305\u88F9\u6574\u7BC7\u7684\u6807\u9898\u3002",
  '\u3010\u5141\u8BB8\u7684\u7ED3\u6784\u3011\u53EA\u5141\u8BB8"\u4F5C\u4E3A\u6307\u4EE4\u6B63\u6587\u7684\u4E00\u90E8\u5206"\u5B58\u5728\u7684\u7ED3\u6784\uFF1A\u7F16\u53F7\u6B65\u9AA4\u3001\u5C0F\u6807\u9898\uFF08\u5982"\u9A8C\u6536\u6807\u51C6""\u4E0D\u8981\u505A"\uFF09\u3001\u6E05\u5355\u3001\u4EE3\u7801\u5757\u3002',
  '\u3010\u98CE\u683C\u3011\u7948\u4F7F\u53E5\u3001\u76F4\u7ED9\u8981\u6C42\u3001\u53EF\u6267\u884C\uFF1B\u4E2D\u6587\u8FDB\u4E2D\u6587\u51FA\uFF1B\u4E0D\u786E\u5B9A\u7684\u9879\u76EE\u4E8B\u5B9E\u5199\u6210"\u5148\u8BFB\u53D6/\u5148\u786E\u8BA4"\u7684\u52A8\u4F5C\uFF0C\u7EDD\u4E0D\u7F16\u9020\u3002',
  '\u3010\u81EA\u68C0\u3011\u843D\u7B14\u524D\u95EE\u81EA\u5DF1\u4E24\u53E5\uFF1A\u2460 \u8FD9\u6BB5\u8BDD\u662F\u4E0D\u662F"\u7528\u6237\u5728\u547D\u4EE4\u5DE5\u4F5C AI"\uFF1F\u2461 \u5DE5\u4F5C AI \u62FF\u5230\u5B83\u80FD\u4E0D\u80FD\u76F4\u63A5\u5F00\u59CB\u5E72\uFF1F',
  '\u4E24\u4E2A\u7B54\u6848\u90FD\u4E3A"\u662F"\u624D\u8F93\u51FA\u3002\u73B0\u5728\u76F4\u63A5\u8F93\u51FA\u8FD9\u6761\u6D88\u606F\uFF0C\u4E0D\u8981\u4EFB\u4F55\u5F00\u573A\u767D\u4E0E\u6536\u5C3E\u8BED\u3002'
].join("\n");
var OPTIMIZER_SPECS = {
  basic: {
    temperature: 0.2,
    system: [
      RELAY_ROLE,
      "\u4E0B\u9762\u8FD9\u6BB5\u662F\u7528\u6237\u8981\u53D1\u7ED9\u5DE5\u4F5C AI \u7684\u6307\u4EE4\uFF0C\u53EF\u80FD\u6709\u75C5\u53E5\u3001\u6307\u4EE3\u4E0D\u660E\u3001\u7528\u8BCD\u542B\u7CCA\u3002",
      "\u4F60\u7684\u552F\u4E00\u4EFB\u52A1\uFF1A\u628A\u5B83\u6539\u5199\u6210\u901A\u987A\u3001\u7CBE\u786E\u3001\u65E0\u6B67\u4E49\u7684**\u540C\u4E00\u6761\u6307\u4EE4**\uFF0C\u6539\u5B8C\u5C31\u80FD\u76F4\u63A5\u53D1\u51FA\u53BB\u3002",
      "\u94C1\u5F8B\uFF1A",
      '- \u53EA\u505A\u8BED\u8A00\u5C42\u4FEE\u590D\uFF1A\u75C5\u53E5\u3001\u9519\u522B\u5B57\u3001\u6807\u70B9\u3001\u6307\u4EE3\u6D88\u89E3\uFF08"\u90A3\u4E2A\u9875\u9762"\u2192\u4FDD\u7559\u4F46\u660E\u786E\u6307\u5411\u540C\u4E00\u5BF9\u8C61\uFF09\u3001\u542B\u7CCA\u8BCD\u6536\u655B\u5230"\u53EF\u6267\u884C\u4F46\u4E0D\u65B0\u589E\u9700\u6C42"\u3002',
      "- \u4E25\u7981\u65B0\u589E\u539F\u6587\u6CA1\u6709\u7684\u9700\u6C42\u3001\u529F\u80FD\u3001\u7EA6\u675F\u3001\u6280\u672F\u9009\u578B\u3001\u4EA4\u4ED8\u7269\uFF1B\u4E25\u7981\u6269\u5927\u6216\u7F29\u5C0F\u8303\u56F4\u3002",
      '- \u539F\u6587\u6CA1\u8BF4\u7684\u5C31\u4E0D\u8981\u66FF\u7528\u6237\u51B3\u5B9A\uFF1A\u65E0\u6CD5\u786E\u5B9A\u5904\u5199\u6210\u7ED9\u5DE5\u4F5C AI \u7684\u67E5\u8BC1\u6307\u4EE4\uFF08\u4F8B\u5982"\u5148\u786E\u8BA4\u6307\u7684\u662F\u54EA\u4E2A\u9875\u9762\uFF0C\u518D\u52A8\u624B"\uFF09\uFF0C\u800C\u4E0D\u662F\u81EA\u5DF1\u62CD\u677F\u3002',
      "- \u7BC7\u5E45\u4E0E\u539F\u6587\u76F8\u5F53\uFF0C\u4E0D\u8981\u81A8\u80C0\u3002",
      NO_META_RULES
    ].join("\n")
  },
  advanced: {
    temperature: 0.3,
    system: [
      RELAY_ROLE,
      "\u7528\u6237\u7684\u539F\u8BDD\u542B\u7CCA\u3001\u7F3A\u5173\u952E\u7EA6\u675F\uFF1B\u4F60\u8981**\u4EE5\u7528\u6237\u7684\u540D\u4E49**\u628A\u8FD9\u6761\u547D\u4EE4\u8BF4\u6E05\u695A\uFF0C\u8F6C\u8FBE\u7ED9\u5DE5\u4F5C AI\u3002",
      '\u4F60\u7684\u4EFB\u52A1\uFF1A\u5728\u5B8C\u5168\u4E0D\u6539\u53D8\u7528\u6237\u76EE\u6807\u7684\u524D\u63D0\u4E0B\uFF0C\u7528\u4F60\u81EA\u5DF1\u7684\u63A8\u7406\uFF0C\u628A"\u7528\u6237\u663E\u7136\u60F3\u8981\u3001\u4F46\u6CA1\u8BF4\u51FA\u53E3"\u7684\u5FC5\u8981\u4FE1\u606F**\u5199\u6210\u5BF9\u5DE5\u4F5C AI \u7684\u8981\u6C42**\uFF0C\u8BA9\u5B83\u4E00\u6B21\u505A\u5BF9\u3002',
      "\u5141\u8BB8\u4F60\u505A\uFF08\u4E14\u4EC5\u9650\u8FD9\u4E9B\uFF09\uFF1A",
      '- \u8865\u5168\u4ECE\u76EE\u6807\u53EF\u76F4\u63A5\u63A8\u51FA\u7684\u6700\u4F4E\u4EA4\u4ED8\u8981\u6C42\u4E0E\u9A8C\u6536\u6807\u51C6\uFF08\u4F8B\u5982"\u80FD\u8DD1\u8D77\u6765""\u754C\u9762\u80FD\u7528"\uFF09\uFF0C\u5F62\u5F0F\u662F\u8981\u6C42\u800C\u975E\u8BC4\u8BBA\u3002',
      "- \u628A\u542B\u7CCA\u8BCD\u6536\u655B\u4E3A\u53EF\u89C2\u5BDF\u3001\u53EF\u6267\u884C\u7684\u8981\u6C42\u3002",
      '- \u5B58\u5728\u4E24\u79CD\u5408\u7406\u89E3\u8BFB\u65F6\uFF1A\u6309\u66F4\u5E38\u89C1\u7684\u4E00\u79CD\u5199\u6210\u4E3B\u8981\u6C42\uFF0C\u53E6\u4E00\u79CD\u5199\u6210"\u5982\u679C\u5B9E\u9645\u662F X\uFF0C\u5219\u2026"\u7684\u6307\u4EE4\u3002',
      "\u94C1\u5F8B\uFF1A\u4E0D\u5F97\u589E\u52A0\u65B0\u529F\u80FD/\u65B0\u76EE\u6807/\u65B0\u4F9D\u8D56\uFF1B\u4E0D\u5F97\u865A\u6784\u7528\u6237\u6CA1\u63D0\u7684\u73AF\u5883\u3001\u6570\u636E\u3001\u6280\u672F\u6808\uFF1B\u6BCF\u6761\u8865\u5145\u90FD\u5FC5\u987B\u80FD\u56DE\u6EAF\u5230\u539F\u8BDD\u91CC\u7684\u67D0\u53E5\u3002",
      NO_META_RULES
    ].join("\n")
  },
  extreme: {
    temperature: 0.3,
    system: [
      RELAY_ROLE,
      "\u8FD9\u6B21\u662F\u4E00\u4E2A\u9700\u8981\u591A\u6B65\u6267\u884C\u7684\u590D\u6742\u4EFB\u52A1\u3002\u4F60\u8981\u8F6C\u8FBE\u7684\u662F**\u4E00\u6761\u53EF\u76F4\u63A5\u53D1\u9001\u7684\u547D\u4EE4**\uFF1A\u7528\u6237\u4E0D\u4F1A\u518D\u7F16\u8F91\u6216\u8F6C\u8FF0\uFF0C\u5DE5\u4F5C AI \u4F1A\u7167\u5B83\u6267\u884C\u3002",
      '\u8981\u6C42\uFF08\u5168\u90E8\u4EE5"\u7528\u6237\u5728\u7ED9\u5DE5\u4F5C AI \u4E0B\u547D\u4EE4"\u7684\u53E3\u543B\u5199\uFF09\uFF1A',
      "- \u5148\u628A\u8BC9\u6C42\u56FA\u5316\u4E3A\u547D\u4EE4\u7ED3\u6784\uFF1A\u8981\u505A\u4EC0\u4E48 / \u505A\u5B8C\u7684\u6807\u5FD7\uFF08\u53EF\u89C2\u6D4B\u9A8C\u6536\u6807\u51C6\uFF09/ \u786C\u7EA6\u675F / \u4E0D\u8BB8\u505A\u4EC0\u4E48\u3002",
      "- \u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212\uFF1A\u6BCF\u9636\u6BB5\u5199\u6E05\u52A8\u4F5C\u4E0E\u4EA7\u51FA\uFF0C\u5E76\u5199\u660E\u7EAA\u5F8B\u8981\u6C42\uFF08\u5148\u9A8C\u8BC1\u518D\u6539\u3001\u5931\u8D25\u5373\u56DE\u9000\u3001\u4E0D\u64C5\u81EA\u6269\u5927\u8303\u56F4\u3001\u6539\u5B8C\u7ED9\u51FA\u8BC1\u636E\uFF09\u3002",
      '- \u591A\u60C5\u51B5\u9884\u6848\uFF1A\u7ED9\u51FA\u6700\u53EF\u80FD\u51FA\u5C94\u5B50\u7684 2\u20134 \u79CD\u60C5\u51B5\uFF0C\u6BCF\u79CD\u5199\u6210"\u5982\u679C\u51FA\u73B0 <\u89E6\u53D1\u4FE1\u53F7>\uFF0C\u5C31\u5148 <\u5E94\u5BF9\u52A8\u4F5C>\uFF0C\u4E0D\u8981 <\u7981\u6B62\u52A8\u4F5C>"\u3002',
      '- \u662F\u5426\u9700\u8981\u529F\u80FD\u6027\u6307\u4EE4\uFF1A\u5224\u65AD\u8FD9\u6B21\u4EFB\u52A1\u662F\u5426\u503C\u5F97\u8BA9\u5DE5\u4F5C AI \u7528 goal / todo / \u8BA1\u5212\u6A21\u5F0F \u8DDF\u8E2A\uFF0C\u5E76\u628A\u7ED3\u8BBA**\u5199\u6210\u547D\u4EE4\u672C\u8EAB\u7684\u4E00\u90E8\u5206**\uFF08\u4F8B\u5982"\u8BF7\u5148\u5EFA\u7ACB goal\uFF1A\u2026\uFF0C\u518D\u6309\u4E0B\u5217\u9636\u6BB5\u63A8\u8FDB"\uFF09\uFF1B\u4E0D\u9700\u8981\u5C31\u5B8C\u5168\u4E0D\u63D0\u3002',
      '\u94C1\u5F8B\uFF1A\u4E0D\u5F97\u865A\u6784\u9879\u76EE\u4E8B\u5B9E\uFF1B\u9700\u8981\u9879\u76EE\u4E8B\u5B9E\u65F6\u5199\u6210"\u5148\u8BFB\u53D6/\u786E\u8BA4 X"\u7684\u67E5\u8BC1\u52A8\u4F5C\uFF0C\u800C\u4E0D\u662F\u7F16\u9020\u7ED3\u8BBA\u3002',
      NO_META_RULES
    ].join("\n")
  }
};
function buildOptimizeSystem(tier) {
  const spec = OPTIMIZER_SPECS[tier] ?? OPTIMIZER_SPECS.advanced;
  return spec.system;
}
function buildOptimizeTemperature(tier) {
  const spec = OPTIMIZER_SPECS[tier] ?? OPTIMIZER_SPECS.advanced;
  return spec.temperature;
}
function buildOptimizeUser(original) {
  return [
    '\u3010\u5F85\u8F6C\u8FBE\u5185\u5BB9\u3011\u4E0B\u9762\u662F"\u7528\u6237"\u53D1\u7ED9\u6211\u7684\u539F\u8BDD\u3002**\u5B83\u4E0D\u662F\u8BF4\u7ED9\u4F60\u542C\u7684**\uFF0C\u4F60\u4E0D\u9700\u8981\u56DE\u5E94\u5B83\u3001\u4E5F\u4E0D\u9700\u8981\u66FF\u7528\u6237\u53BB\u505A\u8FD9\u4EF6\u4E8B\u3002',
    "<\u539F\u6587>",
    String(original ?? ""),
    "</\u539F\u6587>",
    "",
    '\u3010\u4F60\u7684\u4EFB\u52A1\u3011\u4EE5\u7528\u6237\u7684\u540D\u4E49\uFF0C\u628A\u4E0A\u9762\u7684\u5185\u5BB9\u6574\u7406\u6210**\u4E00\u6761\u53EF\u4EE5\u76F4\u63A5\u53D1\u7ED9"\u5DE5\u4F5C AI"\u7684\u547D\u4EE4**\uFF1A',
    "- \u53EA\u8F93\u51FA\u8FD9\u6761\u547D\u4EE4\u672C\u8EAB\uFF1B\u4E0D\u8981\u56DE\u5E94\u6211\u3001\u4E0D\u8981\u56DE\u7B54\u95EE\u9898\u3001\u4E0D\u8981\u8C22\u5E55\u3001\u4E0D\u8981\u89E3\u91CA\u4F60\u505A\u4E86\u4EC0\u4E48\u3002",
    '- \u8BFB\u4F60\u8FD9\u6761\u547D\u4EE4\u7684\u4EBA\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\u3002'
  ].join("\n");
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
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function hasCode(error, code) {
  return typeof error === "object" && error !== null && error.code === code;
}
function delay(ms) {
  return new Promise((resolve2) => {
    setTimeout(resolve2, ms);
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
    return { kind: "broken", error: `\u8BFB\u53D6\u5931\u8D25\uFF1A${errorText(error)}` };
  }
  if (raw.trim() === "") return { kind: "broken", error: "\u6587\u4EF6\u662F\u7A7A\u7684", quarantined: await quarantine(file) };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { kind: "broken", error: `\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText(error)}`, quarantined: await quarantine(file) };
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

// src/host.ts
var name = "composer-ux";
var PANEL_MIN = 560;
var PANEL_MAX = 4e3;
function objectOf(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function textOf(value) {
  return typeof value === "string" ? value : "";
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
  const raw = textOf(value).trim();
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
    return keys.filter((key) => key.startsWith(OPENCODE_ROUTE_PREFIX) || isOpencodeBaseUrl(objectOf(providers[key])?.baseURL));
  }
  return listed.filter((key) => Object.prototype.hasOwnProperty.call(providers, key));
}
function errorText2(error) {
  if (error instanceof Error && error.message !== "") return error.message;
  return String(error);
}
async function mirrorHeader(settings) {
  const own = objectOf(settings.get(NAMESPACE));
  if (own === void 0) return;
  const enabled = own[ENABLED_FIELD] === true && own[HEADER_ENABLED_FIELD] === true;
  const name2 = textOf(own[HEADER_NAME_FIELD]);
  const nameOk = nameIsValid(name2);
  const routesText = parseRouteList(textOf(own[HEADER_ROUTES_FIELD]));
  let value = textOf(own[HEADER_VALUE_FIELD]);
  if (enabled && nameOk && value === "") {
    value = newSessionId();
    await settings.mutate(NAMESPACE, [{ op: "set", path: [HEADER_VALUE_FIELD], value }]);
  }
  const llm = objectOf(settings.get(LLM_NAMESPACE));
  const providers = llm === void 0 ? void 0 : objectOf(llm.providers);
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
      const headers = objectOf(objectOf(providers[route])?.headers);
      if (headers?.[name2] !== value) {
        writes.push({ op: "set", path: ["providers", route, "headers", name2], value });
      }
      applied.push(route);
    }
    status = applied.length === 0 ? `\u5DF2\u542F\u7528\uFF0C\u4F46\u6CA1\u6709\u53EF\u5199\u5165\u7684\u8DEF\u7531\uFF08\u76EE\u6807\uFF1A${routesText.length === 0 ? `\u81EA\u52A8\uFF08\u540D\u5B57\u4EE5 ${OPENCODE_ROUTE_PREFIX} \u5F00\u5934\uFF0C\u6216 baseURL \u6307\u5411 opencode.ai\uFF09` : routesText.join("\u3001")}\uFF09` : `\u5DF2\u5199\u5165 ${applied.join("\u3001")}`;
  }
  const stale = [];
  if (providers !== void 0) {
    const previousName = textOf(own[HEADER_APPLIED_NAME_FIELD]);
    const previousValue = textOf(own[HEADER_APPLIED_VALUE_FIELD]);
    const ours = /* @__PURE__ */ new Set([textOf(own[HEADER_VALUE_FIELD]), previousValue]);
    ours.delete("");
    const targets = new Set(applied.map((route) => `${route}\0${name2}`));
    const candidates = /* @__PURE__ */ new Set([previousName, nameOk ? name2 : ""]);
    candidates.delete("");
    for (const candidate of candidates) {
      for (const [route, profile] of Object.entries(providers)) {
        if (targets.has(`${route}\0${candidate}`)) continue;
        const headers = objectOf(objectOf(profile)?.headers);
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
      status = `\u5199\u5165\u5931\u8D25\uFF1A${errorText2(error)}`;
    }
  }
  const nextAppliedName = !failed && applied.length > 0 ? name2 : "";
  const nextAppliedValue = !failed && applied.length > 0 ? value : "";
  const ownOps = [];
  if (textOf(own[HEADER_APPLIED_NAME_FIELD]) !== nextAppliedName) {
    ownOps.push({ op: "set", path: [HEADER_APPLIED_NAME_FIELD], value: nextAppliedName });
  }
  if (textOf(own[HEADER_APPLIED_VALUE_FIELD]) !== nextAppliedValue) {
    ownOps.push({ op: "set", path: [HEADER_APPLIED_VALUE_FIELD], value: nextAppliedValue });
  }
  if (textOf(own[HEADER_STATUS_FIELD]) !== status) {
    ownOps.push({ op: "set", path: [HEADER_STATUS_FIELD], value: status });
  }
  if (ownOps.length > 0) await settings.mutate(NAMESPACE, ownOps);
}
function apply(ctx) {
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.register(
      NAMESPACE,
      Schema.object({
        [ENABLED_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.enabled),
        [SEND_KEY_FIELD]: Schema.string().default(DEFAULT_SETTINGS.sendKey),
        [NEWLINE_KEY_FIELD]: Schema.string().default(DEFAULT_SETTINGS.newlineKey),
        ...Object.fromEntries(MENU_FIELDS.map((field) => [
          field,
          Schema.boolean().default(DEFAULT_SETTINGS[field])
        ])),
        [MENU_NATIVE_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.menuNative),
        [PANEL_SCROLL_FIELD]: Schema.boolean().default(DEFAULT_SETTINGS.panelScroll),
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
        [OPTIMIZER_TIER_FIELD]: Schema.string().default(DEFAULT_SETTINGS.optimizerTier)
      })
    );
    const settings = settingsCtx.settings;
    let busy = false;
    let again = false;
    const sync = () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      void mirrorHeader(settings).catch((error) => {
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
    ctx.on("settings/updated", onSettingsUpdated);
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
      const provider = textOf(payload.provider);
      const model = textOf(payload.model);
      if (provider !== "" && model !== "") return { provider, model };
      try {
        const selector = optCtx.get("agentDefaultModel");
        const current = selector?.currentSelection?.();
        return { provider: textOf(current?.provider), model: textOf(current?.model) };
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
        payload = objectOf(JSON.parse(await readBody(req))) ?? {};
      } catch (error) {
        sendJson(res, 400, { ok: false, error: `\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText2(error)}` });
        return;
      }
      const text = textOf(payload.text).trim();
      if (text === "") {
        sendJson(res, 400, { ok: false, error: "\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF0C\u6CA1\u6709\u53EF\u4F18\u5316\u7684\u5185\u5BB9" });
        return;
      }
      if (text.length > TEXT_MAX) {
        sendJson(res, 400, { ok: false, error: `\u539F\u6587\u8FC7\u957F\uFF08\u4E0A\u9650 ${TEXT_MAX} \u5B57\u7B26\uFF09` });
        return;
      }
      const tier = textOf(payload.tier) === "" ? DEFAULT_OPTIMIZER_TIER : textOf(payload.tier);
      const route = resolveRoute(payload);
      if (route.provider === "" || route.model === "") {
        sendJson(res, 200, { ok: false, error: "\u62FF\u4E0D\u5230\u5F53\u524D\u7684\u6A21\u578B\u8DEF\u7531\uFF0C\u65E0\u6CD5\u4F18\u5316\uFF08\u8BF7\u5148\u5728\u8F93\u5165\u6846\u65C1\u7684\u6A21\u578B\u9009\u62E9\u5668\u91CC\u9009\u4E00\u4E2A\u6A21\u578B\uFF09" });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, LLM_TIMEOUT_MS);
      let out = "";
      let failure = "";
      try {
        const stream = optCtx.llm.stream({
          provider: route.provider,
          model: route.model,
          system: buildOptimizeSystem(tier),
          temperature: buildOptimizeTemperature(tier),
          signal: controller.signal,
          messages: [{
            id: `optimize-${Date.now().toString(36)}`,
            role: "user",
            content: [{ type: "text", text: buildOptimizeUser(text) }],
            source: { kind: "user" }
          }]
        });
        for await (const chunk of stream) {
          if (chunk.type === "text-delta") {
            out += String(chunk.text ?? "");
            if (out.length > OPTIMIZE_OUTPUT_MAX) break;
          } else if (chunk.type === "finish") {
            const reason = objectOf(chunk.reason);
            if (reason?.kind === "error" || reason?.kind === "aborted") {
              const detail = objectOf(reason.failure);
              failure = textOf(detail?.message) || (reason.kind === "aborted" ? "\u4F18\u5316\u88AB\u4E2D\u65AD" : "\u6A21\u578B\u8FD4\u56DE\u9519\u8BEF");
            }
          }
        }
      } catch (error) {
        failure = errorText2(error);
      } finally {
        clearTimeout(timer);
      }
      const optimized = out.trim();
      if (optimized === "") {
        sendJson(res, 200, {
          ok: false,
          error: failure === "" ? "\u6A21\u578B\u6CA1\u6709\u4EA7\u51FA\u4EFB\u4F55\u5185\u5BB9" : `\u4F18\u5316\u5931\u8D25\uFF1A${failure}`
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        text: optimized.slice(0, OPTIMIZE_OUTPUT_MAX),
        truncated: out.length > OPTIMIZE_OUTPUT_MAX,
        provider: route.provider,
        model: route.model
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
        const row = objectOf(settings?.get(NAMESPACE));
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
        payload = objectOf(JSON.parse(await readBody(req))) ?? {};
      } catch (error) {
        sendJson(res, 400, { ok: false, error: `\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${errorText2(error)}` });
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
        sendJson(res, 500, { ok: false, error: `\u5199\u5165\u5931\u8D25\uFF1A${errorText2(error)}` });
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
}
export {
  apply,
  name
};
//# sourceMappingURL=index.js.map
