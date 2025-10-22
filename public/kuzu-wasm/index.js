var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/threads/dist/serializers.js
var require_serializers = __commonJS({
  "node_modules/threads/dist/serializers.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DefaultSerializer = exports.extendSerializer = void 0;
    function extendSerializer(extend, implementation) {
      const fallbackDeserializer = extend.deserialize.bind(extend);
      const fallbackSerializer = extend.serialize.bind(extend);
      return {
        deserialize(message) {
          return implementation.deserialize(message, fallbackDeserializer);
        },
        serialize(input) {
          return implementation.serialize(input, fallbackSerializer);
        }
      };
    }
    exports.extendSerializer = extendSerializer;
    var DefaultErrorSerializer = {
      deserialize(message) {
        return Object.assign(Error(message.message), {
          name: message.name,
          stack: message.stack
        });
      },
      serialize(error) {
        return {
          __error_marker: "$$error",
          message: error.message,
          name: error.name,
          stack: error.stack
        };
      }
    };
    var isSerializedError = (thing) => thing && typeof thing === "object" && "__error_marker" in thing && thing.__error_marker === "$$error";
    exports.DefaultSerializer = {
      deserialize(message) {
        if (isSerializedError(message)) {
          return DefaultErrorSerializer.deserialize(message);
        } else {
          return message;
        }
      },
      serialize(input) {
        if (input instanceof Error) {
          return DefaultErrorSerializer.serialize(input);
        } else {
          return input;
        }
      }
    };
  }
});

// node_modules/threads/dist/common.js
var require_common = __commonJS({
  "node_modules/threads/dist/common.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serialize = exports.deserialize = exports.registerSerializer = void 0;
    var serializers_1 = require_serializers();
    var registeredSerializer = serializers_1.DefaultSerializer;
    function registerSerializer(serializer) {
      registeredSerializer = serializers_1.extendSerializer(registeredSerializer, serializer);
    }
    exports.registerSerializer = registerSerializer;
    function deserialize(message) {
      return registeredSerializer.deserialize(message);
    }
    exports.deserialize = deserialize;
    function serialize(input) {
      return registeredSerializer.serialize(input);
    }
    exports.serialize = serialize;
  }
});

// node_modules/threads/dist/master/get-bundle-url.browser.js
var require_get_bundle_url_browser = __commonJS({
  "node_modules/threads/dist/master/get-bundle-url.browser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getBundleURL = exports.getBaseURL = void 0;
    var bundleURL;
    function getBundleURLCached() {
      if (!bundleURL) {
        bundleURL = getBundleURL();
      }
      return bundleURL;
    }
    exports.getBundleURL = getBundleURLCached;
    function getBundleURL() {
      try {
        throw new Error();
      } catch (err) {
        const matches = ("" + err.stack).match(/(https?|file|ftp|chrome-extension|moz-extension):\/\/[^)\n]+/g);
        if (matches) {
          return getBaseURL(matches[0]);
        }
      }
      return "/";
    }
    function getBaseURL(url) {
      return ("" + url).replace(/^((?:https?|file|ftp|chrome-extension|moz-extension):\/\/.+)?\/[^/]+(?:\?.*)?$/, "$1") + "/";
    }
    exports.getBaseURL = getBaseURL;
  }
});

// node_modules/threads/dist/master/implementation.browser.js
var require_implementation_browser = __commonJS({
  "node_modules/threads/dist/master/implementation.browser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isWorkerRuntime = exports.getWorkerImplementation = exports.defaultPoolSize = void 0;
    var get_bundle_url_browser_1 = require_get_bundle_url_browser();
    exports.defaultPoolSize = typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
    var isAbsoluteURL = (value) => /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
    function createSourceBlobURL(code) {
      const blob = new Blob([code], { type: "application/javascript" });
      return URL.createObjectURL(blob);
    }
    function selectWorkerImplementation() {
      if (typeof Worker === "undefined") {
        return class NoWebWorker {
          constructor() {
            throw Error("No web worker implementation available. You might have tried to spawn a worker within a worker in a browser that doesn't support workers in workers.");
          }
        };
      }
      class WebWorker extends Worker {
        constructor(url, options) {
          var _a, _b;
          if (typeof url === "string" && options && options._baseURL) {
            url = new URL(url, options._baseURL);
          } else if (typeof url === "string" && !isAbsoluteURL(url) && get_bundle_url_browser_1.getBundleURL().match(/^file:\/\//i)) {
            url = new URL(url, get_bundle_url_browser_1.getBundleURL().replace(/\/[^\/]+$/, "/"));
            if ((_a = options === null || options === void 0 ? void 0 : options.CORSWorkaround) !== null && _a !== void 0 ? _a : true) {
              url = createSourceBlobURL(`importScripts(${JSON.stringify(url)});`);
            }
          }
          if (typeof url === "string" && isAbsoluteURL(url)) {
            if ((_b = options === null || options === void 0 ? void 0 : options.CORSWorkaround) !== null && _b !== void 0 ? _b : true) {
              url = createSourceBlobURL(`importScripts(${JSON.stringify(url)});`);
            }
          }
          super(url, options);
        }
      }
      class BlobWorker extends WebWorker {
        constructor(blob, options) {
          const url = window.URL.createObjectURL(blob);
          super(url, options);
        }
        static fromText(source, options) {
          const blob = new window.Blob([source], { type: "text/javascript" });
          return new BlobWorker(blob, options);
        }
      }
      return {
        blob: BlobWorker,
        default: WebWorker
      };
    }
    var implementation;
    function getWorkerImplementation() {
      if (!implementation) {
        implementation = selectWorkerImplementation();
      }
      return implementation;
    }
    exports.getWorkerImplementation = getWorkerImplementation;
    function isWorkerRuntime() {
      const isWindowContext = typeof self !== "undefined" && typeof Window !== "undefined" && self instanceof Window;
      return typeof self !== "undefined" && self.postMessage && !isWindowContext ? true : false;
    }
    exports.isWorkerRuntime = isWorkerRuntime;
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common2 = __commonJS({
  "node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self2 = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self2.diff = ms;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(" ", ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common2()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/observable-fns/dist/_scheduler.js
var require_scheduler = __commonJS({
  "node_modules/observable-fns/dist/_scheduler.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AsyncSerialScheduler = void 0;
    var AsyncSerialScheduler = class {
      constructor(observer) {
        this._baseObserver = observer;
        this._pendingPromises = /* @__PURE__ */ new Set();
      }
      complete() {
        Promise.all(this._pendingPromises).then(() => this._baseObserver.complete()).catch((error) => this._baseObserver.error(error));
      }
      error(error) {
        this._baseObserver.error(error);
      }
      schedule(task) {
        const prevPromisesCompletion = Promise.all(this._pendingPromises);
        const values = [];
        const next = (value) => values.push(value);
        const promise = Promise.resolve().then(() => __awaiter(this, void 0, void 0, function* () {
          yield prevPromisesCompletion;
          yield task(next);
          this._pendingPromises.delete(promise);
          for (const value of values) {
            this._baseObserver.next(value);
          }
        })).catch((error) => {
          this._pendingPromises.delete(promise);
          this._baseObserver.error(error);
        });
        this._pendingPromises.add(promise);
      }
    };
    exports.AsyncSerialScheduler = AsyncSerialScheduler;
  }
});

// node_modules/observable-fns/dist/symbols.js
var require_symbols = __commonJS({
  "node_modules/observable-fns/dist/symbols.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/observable-fns/dist/_symbols.js
var require_symbols2 = __commonJS({
  "node_modules/observable-fns/dist/_symbols.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.registerObservableSymbol = exports.getSymbol = exports.hasSymbol = exports.hasSymbols = void 0;
    var hasSymbols = () => typeof Symbol === "function";
    exports.hasSymbols = hasSymbols;
    var hasSymbol = (name) => exports.hasSymbols() && Boolean(Symbol[name]);
    exports.hasSymbol = hasSymbol;
    var getSymbol = (name) => exports.hasSymbol(name) ? Symbol[name] : "@@" + name;
    exports.getSymbol = getSymbol;
    function registerObservableSymbol() {
      if (exports.hasSymbols() && !exports.hasSymbol("observable")) {
        Symbol.observable = Symbol("observable");
      }
    }
    exports.registerObservableSymbol = registerObservableSymbol;
    if (!exports.hasSymbol("asyncIterator")) {
      Symbol.asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");
    }
  }
});

// node_modules/observable-fns/dist/observable.js
var require_observable = __commonJS({
  "node_modules/observable-fns/dist/observable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Observable = exports.SubscriptionObserver = exports.Subscription = void 0;
    require_symbols();
    var _symbols_1 = require_symbols2();
    var SymbolIterator = _symbols_1.getSymbol("iterator");
    var SymbolObservable = _symbols_1.getSymbol("observable");
    var SymbolSpecies = _symbols_1.getSymbol("species");
    function getMethod(obj, key) {
      const value = obj[key];
      if (value == null) {
        return void 0;
      }
      if (typeof value !== "function") {
        throw new TypeError(value + " is not a function");
      }
      return value;
    }
    function getSpecies(obj) {
      let ctor = obj.constructor;
      if (ctor !== void 0) {
        ctor = ctor[SymbolSpecies];
        if (ctor === null) {
          ctor = void 0;
        }
      }
      return ctor !== void 0 ? ctor : Observable;
    }
    function isObservable(x) {
      return x instanceof Observable;
    }
    function hostReportError(error) {
      if (hostReportError.log) {
        hostReportError.log(error);
      } else {
        setTimeout(() => {
          throw error;
        }, 0);
      }
    }
    function enqueue(fn) {
      Promise.resolve().then(() => {
        try {
          fn();
        } catch (e) {
          hostReportError(e);
        }
      });
    }
    function cleanupSubscription(subscription) {
      const cleanup = subscription._cleanup;
      if (cleanup === void 0) {
        return;
      }
      subscription._cleanup = void 0;
      if (!cleanup) {
        return;
      }
      try {
        if (typeof cleanup === "function") {
          cleanup();
        } else {
          const unsubscribe = getMethod(cleanup, "unsubscribe");
          if (unsubscribe) {
            unsubscribe.call(cleanup);
          }
        }
      } catch (e) {
        hostReportError(e);
      }
    }
    function closeSubscription(subscription) {
      subscription._observer = void 0;
      subscription._queue = void 0;
      subscription._state = "closed";
    }
    function flushSubscription(subscription) {
      const queue = subscription._queue;
      if (!queue) {
        return;
      }
      subscription._queue = void 0;
      subscription._state = "ready";
      for (const item of queue) {
        notifySubscription(subscription, item.type, item.value);
        if (subscription._state === "closed") {
          break;
        }
      }
    }
    function notifySubscription(subscription, type, value) {
      subscription._state = "running";
      const observer = subscription._observer;
      try {
        const m = observer ? getMethod(observer, type) : void 0;
        switch (type) {
          case "next":
            if (m)
              m.call(observer, value);
            break;
          case "error":
            closeSubscription(subscription);
            if (m)
              m.call(observer, value);
            else
              throw value;
            break;
          case "complete":
            closeSubscription(subscription);
            if (m)
              m.call(observer);
            break;
        }
      } catch (e) {
        hostReportError(e);
      }
      if (subscription._state === "closed") {
        cleanupSubscription(subscription);
      } else if (subscription._state === "running") {
        subscription._state = "ready";
      }
    }
    function onNotify(subscription, type, value) {
      if (subscription._state === "closed") {
        return;
      }
      if (subscription._state === "buffering") {
        subscription._queue = subscription._queue || [];
        subscription._queue.push({ type, value });
        return;
      }
      if (subscription._state !== "ready") {
        subscription._state = "buffering";
        subscription._queue = [{ type, value }];
        enqueue(() => flushSubscription(subscription));
        return;
      }
      notifySubscription(subscription, type, value);
    }
    var Subscription = class {
      constructor(observer, subscriber) {
        this._cleanup = void 0;
        this._observer = observer;
        this._queue = void 0;
        this._state = "initializing";
        const subscriptionObserver = new SubscriptionObserver(this);
        try {
          this._cleanup = subscriber.call(void 0, subscriptionObserver);
        } catch (e) {
          subscriptionObserver.error(e);
        }
        if (this._state === "initializing") {
          this._state = "ready";
        }
      }
      get closed() {
        return this._state === "closed";
      }
      unsubscribe() {
        if (this._state !== "closed") {
          closeSubscription(this);
          cleanupSubscription(this);
        }
      }
    };
    exports.Subscription = Subscription;
    var SubscriptionObserver = class {
      constructor(subscription) {
        this._subscription = subscription;
      }
      get closed() {
        return this._subscription._state === "closed";
      }
      next(value) {
        onNotify(this._subscription, "next", value);
      }
      error(value) {
        onNotify(this._subscription, "error", value);
      }
      complete() {
        onNotify(this._subscription, "complete");
      }
    };
    exports.SubscriptionObserver = SubscriptionObserver;
    var Observable = class _Observable {
      constructor(subscriber) {
        if (!(this instanceof _Observable)) {
          throw new TypeError("Observable cannot be called as a function");
        }
        if (typeof subscriber !== "function") {
          throw new TypeError("Observable initializer must be a function");
        }
        this._subscriber = subscriber;
      }
      subscribe(nextOrObserver, onError, onComplete) {
        if (typeof nextOrObserver !== "object" || nextOrObserver === null) {
          nextOrObserver = {
            next: nextOrObserver,
            error: onError,
            complete: onComplete
          };
        }
        return new Subscription(nextOrObserver, this._subscriber);
      }
      pipe(first, ...mappers) {
        let intermediate = this;
        for (const mapper of [first, ...mappers]) {
          intermediate = mapper(intermediate);
        }
        return intermediate;
      }
      tap(nextOrObserver, onError, onComplete) {
        const tapObserver = typeof nextOrObserver !== "object" || nextOrObserver === null ? {
          next: nextOrObserver,
          error: onError,
          complete: onComplete
        } : nextOrObserver;
        return new _Observable((observer) => {
          return this.subscribe({
            next(value) {
              tapObserver.next && tapObserver.next(value);
              observer.next(value);
            },
            error(error) {
              tapObserver.error && tapObserver.error(error);
              observer.error(error);
            },
            complete() {
              tapObserver.complete && tapObserver.complete();
              observer.complete();
            },
            start(subscription) {
              tapObserver.start && tapObserver.start(subscription);
            }
          });
        });
      }
      forEach(fn) {
        return new Promise((resolve, reject) => {
          if (typeof fn !== "function") {
            reject(new TypeError(fn + " is not a function"));
            return;
          }
          function done() {
            subscription.unsubscribe();
            resolve(void 0);
          }
          const subscription = this.subscribe({
            next(value) {
              try {
                fn(value, done);
              } catch (e) {
                reject(e);
                subscription.unsubscribe();
              }
            },
            error(error) {
              reject(error);
            },
            complete() {
              resolve(void 0);
            }
          });
        });
      }
      map(fn) {
        if (typeof fn !== "function") {
          throw new TypeError(fn + " is not a function");
        }
        const C = getSpecies(this);
        return new C((observer) => this.subscribe({
          next(value) {
            let propagatedValue = value;
            try {
              propagatedValue = fn(value);
            } catch (e) {
              return observer.error(e);
            }
            observer.next(propagatedValue);
          },
          error(e) {
            observer.error(e);
          },
          complete() {
            observer.complete();
          }
        }));
      }
      filter(fn) {
        if (typeof fn !== "function") {
          throw new TypeError(fn + " is not a function");
        }
        const C = getSpecies(this);
        return new C((observer) => this.subscribe({
          next(value) {
            try {
              if (!fn(value))
                return;
            } catch (e) {
              return observer.error(e);
            }
            observer.next(value);
          },
          error(e) {
            observer.error(e);
          },
          complete() {
            observer.complete();
          }
        }));
      }
      reduce(fn, seed) {
        if (typeof fn !== "function") {
          throw new TypeError(fn + " is not a function");
        }
        const C = getSpecies(this);
        const hasSeed = arguments.length > 1;
        let hasValue = false;
        let acc = seed;
        return new C((observer) => this.subscribe({
          next(value) {
            const first = !hasValue;
            hasValue = true;
            if (!first || hasSeed) {
              try {
                acc = fn(acc, value);
              } catch (e) {
                return observer.error(e);
              }
            } else {
              acc = value;
            }
          },
          error(e) {
            observer.error(e);
          },
          complete() {
            if (!hasValue && !hasSeed) {
              return observer.error(new TypeError("Cannot reduce an empty sequence"));
            }
            observer.next(acc);
            observer.complete();
          }
        }));
      }
      concat(...sources) {
        const C = getSpecies(this);
        return new C((observer) => {
          let subscription;
          let index = 0;
          function startNext(next) {
            subscription = next.subscribe({
              next(v) {
                observer.next(v);
              },
              error(e) {
                observer.error(e);
              },
              complete() {
                if (index === sources.length) {
                  subscription = void 0;
                  observer.complete();
                } else {
                  startNext(C.from(sources[index++]));
                }
              }
            });
          }
          startNext(this);
          return () => {
            if (subscription) {
              subscription.unsubscribe();
              subscription = void 0;
            }
          };
        });
      }
      flatMap(fn) {
        if (typeof fn !== "function") {
          throw new TypeError(fn + " is not a function");
        }
        const C = getSpecies(this);
        return new C((observer) => {
          const subscriptions = [];
          const outer = this.subscribe({
            next(value) {
              let normalizedValue;
              if (fn) {
                try {
                  normalizedValue = fn(value);
                } catch (e) {
                  return observer.error(e);
                }
              } else {
                normalizedValue = value;
              }
              const inner = C.from(normalizedValue).subscribe({
                next(innerValue) {
                  observer.next(innerValue);
                },
                error(e) {
                  observer.error(e);
                },
                complete() {
                  const i = subscriptions.indexOf(inner);
                  if (i >= 0)
                    subscriptions.splice(i, 1);
                  completeIfDone();
                }
              });
              subscriptions.push(inner);
            },
            error(e) {
              observer.error(e);
            },
            complete() {
              completeIfDone();
            }
          });
          function completeIfDone() {
            if (outer.closed && subscriptions.length === 0) {
              observer.complete();
            }
          }
          return () => {
            subscriptions.forEach((s) => s.unsubscribe());
            outer.unsubscribe();
          };
        });
      }
      [(Symbol.observable, SymbolObservable)]() {
        return this;
      }
      static from(x) {
        const C = typeof this === "function" ? this : _Observable;
        if (x == null) {
          throw new TypeError(x + " is not an object");
        }
        const observableMethod = getMethod(x, SymbolObservable);
        if (observableMethod) {
          const observable = observableMethod.call(x);
          if (Object(observable) !== observable) {
            throw new TypeError(observable + " is not an object");
          }
          if (isObservable(observable) && observable.constructor === C) {
            return observable;
          }
          return new C((observer) => observable.subscribe(observer));
        }
        if (_symbols_1.hasSymbol("iterator")) {
          const iteratorMethod = getMethod(x, SymbolIterator);
          if (iteratorMethod) {
            return new C((observer) => {
              enqueue(() => {
                if (observer.closed)
                  return;
                for (const item of iteratorMethod.call(x)) {
                  observer.next(item);
                  if (observer.closed)
                    return;
                }
                observer.complete();
              });
            });
          }
        }
        if (Array.isArray(x)) {
          return new C((observer) => {
            enqueue(() => {
              if (observer.closed)
                return;
              for (const item of x) {
                observer.next(item);
                if (observer.closed)
                  return;
              }
              observer.complete();
            });
          });
        }
        throw new TypeError(x + " is not observable");
      }
      static of(...items) {
        const C = typeof this === "function" ? this : _Observable;
        return new C((observer) => {
          enqueue(() => {
            if (observer.closed)
              return;
            for (const item of items) {
              observer.next(item);
              if (observer.closed)
                return;
            }
            observer.complete();
          });
        });
      }
      static get [SymbolSpecies]() {
        return this;
      }
    };
    exports.Observable = Observable;
    if (_symbols_1.hasSymbols()) {
      Object.defineProperty(Observable, Symbol("extensions"), {
        value: {
          symbol: SymbolObservable,
          hostReportError
        },
        configurable: true
      });
    }
    exports.default = Observable;
  }
});

// node_modules/observable-fns/dist/unsubscribe.js
var require_unsubscribe = __commonJS({
  "node_modules/observable-fns/dist/unsubscribe.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function unsubscribe(subscription) {
      if (typeof subscription === "function") {
        subscription();
      } else if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
    }
    exports.default = unsubscribe;
  }
});

// node_modules/observable-fns/dist/filter.js
var require_filter = __commonJS({
  "node_modules/observable-fns/dist/filter.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var _scheduler_1 = require_scheduler();
    var observable_1 = require_observable();
    var unsubscribe_1 = require_unsubscribe();
    function filter(test) {
      return (observable) => {
        return new observable_1.default((observer) => {
          const scheduler = new _scheduler_1.AsyncSerialScheduler(observer);
          const subscription = observable.subscribe({
            complete() {
              scheduler.complete();
            },
            error(error) {
              scheduler.error(error);
            },
            next(input) {
              scheduler.schedule((next) => __awaiter(this, void 0, void 0, function* () {
                if (yield test(input)) {
                  next(input);
                }
              }));
            }
          });
          return () => unsubscribe_1.default(subscription);
        });
      };
    }
    exports.default = filter;
  }
});

// node_modules/observable-fns/dist/_util.js
var require_util = __commonJS({
  "node_modules/observable-fns/dist/_util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isIterator = exports.isAsyncIterator = void 0;
    var _symbols_1 = require_symbols2();
    function isAsyncIterator(thing) {
      return thing && _symbols_1.hasSymbol("asyncIterator") && thing[Symbol.asyncIterator];
    }
    exports.isAsyncIterator = isAsyncIterator;
    function isIterator(thing) {
      return thing && _symbols_1.hasSymbol("iterator") && thing[Symbol.iterator];
    }
    exports.isIterator = isIterator;
  }
});

// node_modules/observable-fns/dist/flatMap.js
var require_flatMap = __commonJS({
  "node_modules/observable-fns/dist/flatMap.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __asyncValues = exports && exports.__asyncValues || function(o) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var m = o[Symbol.asyncIterator], i;
      return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
        return this;
      }, i);
      function verb(n) {
        i[n] = o[n] && function(v) {
          return new Promise(function(resolve, reject) {
            v = o[n](v), settle(resolve, reject, v.done, v.value);
          });
        };
      }
      function settle(resolve, reject, d, v) {
        Promise.resolve(v).then(function(v2) {
          resolve({ value: v2, done: d });
        }, reject);
      }
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var _scheduler_1 = require_scheduler();
    var _util_1 = require_util();
    var observable_1 = require_observable();
    var unsubscribe_1 = require_unsubscribe();
    function flatMap(mapper) {
      return (observable) => {
        return new observable_1.default((observer) => {
          const scheduler = new _scheduler_1.AsyncSerialScheduler(observer);
          const subscription = observable.subscribe({
            complete() {
              scheduler.complete();
            },
            error(error) {
              scheduler.error(error);
            },
            next(input) {
              scheduler.schedule((next) => __awaiter(this, void 0, void 0, function* () {
                var e_1, _a;
                const mapped = yield mapper(input);
                if (_util_1.isIterator(mapped) || _util_1.isAsyncIterator(mapped)) {
                  try {
                    for (var mapped_1 = __asyncValues(mapped), mapped_1_1; mapped_1_1 = yield mapped_1.next(), !mapped_1_1.done; ) {
                      const element = mapped_1_1.value;
                      next(element);
                    }
                  } catch (e_1_1) {
                    e_1 = { error: e_1_1 };
                  } finally {
                    try {
                      if (mapped_1_1 && !mapped_1_1.done && (_a = mapped_1.return)) yield _a.call(mapped_1);
                    } finally {
                      if (e_1) throw e_1.error;
                    }
                  }
                } else {
                  mapped.map((output) => next(output));
                }
              }));
            }
          });
          return () => unsubscribe_1.default(subscription);
        });
      };
    }
    exports.default = flatMap;
  }
});

// node_modules/observable-fns/dist/interval.js
var require_interval = __commonJS({
  "node_modules/observable-fns/dist/interval.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var observable_1 = require_observable();
    function interval(period) {
      return new observable_1.Observable((observer) => {
        let counter = 0;
        const handle = setInterval(() => {
          observer.next(counter++);
        }, period);
        return () => clearInterval(handle);
      });
    }
    exports.default = interval;
  }
});

// node_modules/observable-fns/dist/map.js
var require_map = __commonJS({
  "node_modules/observable-fns/dist/map.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var _scheduler_1 = require_scheduler();
    var observable_1 = require_observable();
    var unsubscribe_1 = require_unsubscribe();
    function map(mapper) {
      return (observable) => {
        return new observable_1.default((observer) => {
          const scheduler = new _scheduler_1.AsyncSerialScheduler(observer);
          const subscription = observable.subscribe({
            complete() {
              scheduler.complete();
            },
            error(error) {
              scheduler.error(error);
            },
            next(input) {
              scheduler.schedule((next) => __awaiter(this, void 0, void 0, function* () {
                const mapped = yield mapper(input);
                next(mapped);
              }));
            }
          });
          return () => unsubscribe_1.default(subscription);
        });
      };
    }
    exports.default = map;
  }
});

// node_modules/observable-fns/dist/merge.js
var require_merge = __commonJS({
  "node_modules/observable-fns/dist/merge.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var observable_1 = require_observable();
    var unsubscribe_1 = require_unsubscribe();
    function merge(...observables) {
      if (observables.length === 0) {
        return observable_1.Observable.from([]);
      }
      return new observable_1.Observable((observer) => {
        let completed = 0;
        const subscriptions = observables.map((input) => {
          return input.subscribe({
            error(error) {
              observer.error(error);
              unsubscribeAll();
            },
            next(value) {
              observer.next(value);
            },
            complete() {
              if (++completed === observables.length) {
                observer.complete();
                unsubscribeAll();
              }
            }
          });
        });
        const unsubscribeAll = () => {
          subscriptions.forEach((subscription) => unsubscribe_1.default(subscription));
        };
        return unsubscribeAll;
      });
    }
    exports.default = merge;
  }
});

// node_modules/observable-fns/dist/subject.js
var require_subject = __commonJS({
  "node_modules/observable-fns/dist/subject.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var observable_1 = require_observable();
    var MulticastSubject = class extends observable_1.default {
      constructor() {
        super((observer) => {
          this._observers.add(observer);
          return () => this._observers.delete(observer);
        });
        this._observers = /* @__PURE__ */ new Set();
      }
      next(value) {
        for (const observer of this._observers) {
          observer.next(value);
        }
      }
      error(error) {
        for (const observer of this._observers) {
          observer.error(error);
        }
      }
      complete() {
        for (const observer of this._observers) {
          observer.complete();
        }
      }
    };
    exports.default = MulticastSubject;
  }
});

// node_modules/observable-fns/dist/multicast.js
var require_multicast = __commonJS({
  "node_modules/observable-fns/dist/multicast.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var observable_1 = require_observable();
    var subject_1 = require_subject();
    var unsubscribe_1 = require_unsubscribe();
    function multicast(coldObservable) {
      const subject = new subject_1.default();
      let sourceSubscription;
      let subscriberCount = 0;
      return new observable_1.default((observer) => {
        if (!sourceSubscription) {
          sourceSubscription = coldObservable.subscribe(subject);
        }
        const subscription = subject.subscribe(observer);
        subscriberCount++;
        return () => {
          subscriberCount--;
          subscription.unsubscribe();
          if (subscriberCount === 0) {
            unsubscribe_1.default(sourceSubscription);
            sourceSubscription = void 0;
          }
        };
      });
    }
    exports.default = multicast;
  }
});

// node_modules/observable-fns/dist/scan.js
var require_scan = __commonJS({
  "node_modules/observable-fns/dist/scan.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var _scheduler_1 = require_scheduler();
    var observable_1 = require_observable();
    var unsubscribe_1 = require_unsubscribe();
    function scan(accumulator, seed) {
      return (observable) => {
        return new observable_1.default((observer) => {
          let accumulated;
          let index = 0;
          const scheduler = new _scheduler_1.AsyncSerialScheduler(observer);
          const subscription = observable.subscribe({
            complete() {
              scheduler.complete();
            },
            error(error) {
              scheduler.error(error);
            },
            next(value) {
              scheduler.schedule((next) => __awaiter(this, void 0, void 0, function* () {
                const prevAcc = index === 0 ? typeof seed === "undefined" ? value : seed : accumulated;
                accumulated = yield accumulator(prevAcc, value, index++);
                next(accumulated);
              }));
            }
          });
          return () => unsubscribe_1.default(subscription);
        });
      };
    }
    exports.default = scan;
  }
});

// node_modules/observable-fns/dist/index.js
var require_dist = __commonJS({
  "node_modules/observable-fns/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.unsubscribe = exports.Subject = exports.scan = exports.Observable = exports.multicast = exports.merge = exports.map = exports.interval = exports.flatMap = exports.filter = void 0;
    var filter_1 = require_filter();
    Object.defineProperty(exports, "filter", { enumerable: true, get: function() {
      return filter_1.default;
    } });
    var flatMap_1 = require_flatMap();
    Object.defineProperty(exports, "flatMap", { enumerable: true, get: function() {
      return flatMap_1.default;
    } });
    var interval_1 = require_interval();
    Object.defineProperty(exports, "interval", { enumerable: true, get: function() {
      return interval_1.default;
    } });
    var map_1 = require_map();
    Object.defineProperty(exports, "map", { enumerable: true, get: function() {
      return map_1.default;
    } });
    var merge_1 = require_merge();
    Object.defineProperty(exports, "merge", { enumerable: true, get: function() {
      return merge_1.default;
    } });
    var multicast_1 = require_multicast();
    Object.defineProperty(exports, "multicast", { enumerable: true, get: function() {
      return multicast_1.default;
    } });
    var observable_1 = require_observable();
    Object.defineProperty(exports, "Observable", { enumerable: true, get: function() {
      return observable_1.default;
    } });
    var scan_1 = require_scan();
    Object.defineProperty(exports, "scan", { enumerable: true, get: function() {
      return scan_1.default;
    } });
    var subject_1 = require_subject();
    Object.defineProperty(exports, "Subject", { enumerable: true, get: function() {
      return subject_1.default;
    } });
    var unsubscribe_1 = require_unsubscribe();
    Object.defineProperty(exports, "unsubscribe", { enumerable: true, get: function() {
      return unsubscribe_1.default;
    } });
  }
});

// node_modules/observable-fns/index.js
var require_observable_fns = __commonJS({
  "node_modules/observable-fns/index.js"(exports, module) {
    module.exports = require_dist();
  }
});

// node_modules/threads/dist/ponyfills.js
var require_ponyfills = __commonJS({
  "node_modules/threads/dist/ponyfills.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.allSettled = void 0;
    function allSettled(values) {
      return Promise.all(values.map((item) => {
        const onFulfill = (value) => {
          return { status: "fulfilled", value };
        };
        const onReject = (reason) => {
          return { status: "rejected", reason };
        };
        const itemPromise = Promise.resolve(item);
        try {
          return itemPromise.then(onFulfill, onReject);
        } catch (error) {
          return Promise.reject(error);
        }
      }));
    }
    exports.allSettled = allSettled;
  }
});

// node_modules/threads/dist/master/pool-types.js
var require_pool_types = __commonJS({
  "node_modules/threads/dist/master/pool-types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PoolEventType = void 0;
    var PoolEventType;
    (function(PoolEventType2) {
      PoolEventType2["initialized"] = "initialized";
      PoolEventType2["taskCanceled"] = "taskCanceled";
      PoolEventType2["taskCompleted"] = "taskCompleted";
      PoolEventType2["taskFailed"] = "taskFailed";
      PoolEventType2["taskQueued"] = "taskQueued";
      PoolEventType2["taskQueueDrained"] = "taskQueueDrained";
      PoolEventType2["taskStart"] = "taskStart";
      PoolEventType2["terminated"] = "terminated";
    })(PoolEventType = exports.PoolEventType || (exports.PoolEventType = {}));
  }
});

// node_modules/threads/dist/symbols.js
var require_symbols3 = __commonJS({
  "node_modules/threads/dist/symbols.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.$worker = exports.$transferable = exports.$terminate = exports.$events = exports.$errors = void 0;
    exports.$errors = Symbol("thread.errors");
    exports.$events = Symbol("thread.events");
    exports.$terminate = Symbol("thread.terminate");
    exports.$transferable = Symbol("thread.transferable");
    exports.$worker = Symbol("thread.worker");
  }
});

// node_modules/threads/dist/master/thread.js
var require_thread = __commonJS({
  "node_modules/threads/dist/master/thread.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Thread = void 0;
    var symbols_1 = require_symbols3();
    function fail(message) {
      throw Error(message);
    }
    exports.Thread = {
      /** Return an observable that can be used to subscribe to all errors happening in the thread. */
      errors(thread) {
        return thread[symbols_1.$errors] || fail("Error observable not found. Make sure to pass a thread instance as returned by the spawn() promise.");
      },
      /** Return an observable that can be used to subscribe to internal events happening in the thread. Useful for debugging. */
      events(thread) {
        return thread[symbols_1.$events] || fail("Events observable not found. Make sure to pass a thread instance as returned by the spawn() promise.");
      },
      /** Terminate a thread. Remember to terminate every thread when you are done using it. */
      terminate(thread) {
        return thread[symbols_1.$terminate]();
      }
    };
  }
});

// node_modules/threads/dist/master/pool.js
var require_pool = __commonJS({
  "node_modules/threads/dist/master/pool.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Pool = exports.Thread = exports.PoolEventType = void 0;
    var debug_1 = __importDefault(require_browser());
    var observable_fns_1 = require_observable_fns();
    var ponyfills_1 = require_ponyfills();
    var implementation_1 = require_implementation_browser();
    var pool_types_1 = require_pool_types();
    Object.defineProperty(exports, "PoolEventType", { enumerable: true, get: function() {
      return pool_types_1.PoolEventType;
    } });
    var thread_1 = require_thread();
    Object.defineProperty(exports, "Thread", { enumerable: true, get: function() {
      return thread_1.Thread;
    } });
    var nextPoolID = 1;
    function createArray(size) {
      const array = [];
      for (let index = 0; index < size; index++) {
        array.push(index);
      }
      return array;
    }
    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function flatMap(array, mapper) {
      return array.reduce((flattened, element) => [...flattened, ...mapper(element)], []);
    }
    function slugify(text) {
      return text.replace(/\W/g, " ").trim().replace(/\s+/g, "-");
    }
    function spawnWorkers(spawnWorker, count) {
      return createArray(count).map(() => ({
        init: spawnWorker(),
        runningTasks: []
      }));
    }
    var WorkerPool = class {
      constructor(spawnWorker, optionsOrSize) {
        this.eventSubject = new observable_fns_1.Subject();
        this.initErrors = [];
        this.isClosing = false;
        this.nextTaskID = 1;
        this.taskQueue = [];
        const options = typeof optionsOrSize === "number" ? { size: optionsOrSize } : optionsOrSize || {};
        const { size = implementation_1.defaultPoolSize } = options;
        this.debug = debug_1.default(`threads:pool:${slugify(options.name || String(nextPoolID++))}`);
        this.options = options;
        this.workers = spawnWorkers(spawnWorker, size);
        this.eventObservable = observable_fns_1.multicast(observable_fns_1.Observable.from(this.eventSubject));
        Promise.all(this.workers.map((worker) => worker.init)).then(() => this.eventSubject.next({
          type: pool_types_1.PoolEventType.initialized,
          size: this.workers.length
        }), (error) => {
          this.debug("Error while initializing pool worker:", error);
          this.eventSubject.error(error);
          this.initErrors.push(error);
        });
      }
      findIdlingWorker() {
        const { concurrency = 1 } = this.options;
        return this.workers.find((worker) => worker.runningTasks.length < concurrency);
      }
      runPoolTask(worker, task) {
        return __awaiter(this, void 0, void 0, function* () {
          const workerID = this.workers.indexOf(worker) + 1;
          this.debug(`Running task #${task.id} on worker #${workerID}...`);
          this.eventSubject.next({
            type: pool_types_1.PoolEventType.taskStart,
            taskID: task.id,
            workerID
          });
          try {
            const returnValue = yield task.run(yield worker.init);
            this.debug(`Task #${task.id} completed successfully`);
            this.eventSubject.next({
              type: pool_types_1.PoolEventType.taskCompleted,
              returnValue,
              taskID: task.id,
              workerID
            });
          } catch (error) {
            this.debug(`Task #${task.id} failed`);
            this.eventSubject.next({
              type: pool_types_1.PoolEventType.taskFailed,
              taskID: task.id,
              error,
              workerID
            });
          }
        });
      }
      run(worker, task) {
        return __awaiter(this, void 0, void 0, function* () {
          const runPromise = (() => __awaiter(this, void 0, void 0, function* () {
            const removeTaskFromWorkersRunningTasks = () => {
              worker.runningTasks = worker.runningTasks.filter((someRunPromise) => someRunPromise !== runPromise);
            };
            yield delay(0);
            try {
              yield this.runPoolTask(worker, task);
            } finally {
              removeTaskFromWorkersRunningTasks();
              if (!this.isClosing) {
                this.scheduleWork();
              }
            }
          }))();
          worker.runningTasks.push(runPromise);
        });
      }
      scheduleWork() {
        this.debug(`Attempt de-queueing a task in order to run it...`);
        const availableWorker = this.findIdlingWorker();
        if (!availableWorker)
          return;
        const nextTask = this.taskQueue.shift();
        if (!nextTask) {
          this.debug(`Task queue is empty`);
          this.eventSubject.next({ type: pool_types_1.PoolEventType.taskQueueDrained });
          return;
        }
        this.run(availableWorker, nextTask);
      }
      taskCompletion(taskID) {
        return new Promise((resolve, reject) => {
          const eventSubscription = this.events().subscribe((event) => {
            if (event.type === pool_types_1.PoolEventType.taskCompleted && event.taskID === taskID) {
              eventSubscription.unsubscribe();
              resolve(event.returnValue);
            } else if (event.type === pool_types_1.PoolEventType.taskFailed && event.taskID === taskID) {
              eventSubscription.unsubscribe();
              reject(event.error);
            } else if (event.type === pool_types_1.PoolEventType.terminated) {
              eventSubscription.unsubscribe();
              reject(Error("Pool has been terminated before task was run."));
            }
          });
        });
      }
      settled(allowResolvingImmediately = false) {
        return __awaiter(this, void 0, void 0, function* () {
          const getCurrentlyRunningTasks = () => flatMap(this.workers, (worker) => worker.runningTasks);
          const taskFailures = [];
          const failureSubscription = this.eventObservable.subscribe((event) => {
            if (event.type === pool_types_1.PoolEventType.taskFailed) {
              taskFailures.push(event.error);
            }
          });
          if (this.initErrors.length > 0) {
            return Promise.reject(this.initErrors[0]);
          }
          if (allowResolvingImmediately && this.taskQueue.length === 0) {
            yield ponyfills_1.allSettled(getCurrentlyRunningTasks());
            return taskFailures;
          }
          yield new Promise((resolve, reject) => {
            const subscription = this.eventObservable.subscribe({
              next(event) {
                if (event.type === pool_types_1.PoolEventType.taskQueueDrained) {
                  subscription.unsubscribe();
                  resolve(void 0);
                }
              },
              error: reject
              // make a pool-wide error reject the completed() result promise
            });
          });
          yield ponyfills_1.allSettled(getCurrentlyRunningTasks());
          failureSubscription.unsubscribe();
          return taskFailures;
        });
      }
      completed(allowResolvingImmediately = false) {
        return __awaiter(this, void 0, void 0, function* () {
          const settlementPromise = this.settled(allowResolvingImmediately);
          const earlyExitPromise = new Promise((resolve, reject) => {
            const subscription = this.eventObservable.subscribe({
              next(event) {
                if (event.type === pool_types_1.PoolEventType.taskQueueDrained) {
                  subscription.unsubscribe();
                  resolve(settlementPromise);
                } else if (event.type === pool_types_1.PoolEventType.taskFailed) {
                  subscription.unsubscribe();
                  reject(event.error);
                }
              },
              error: reject
              // make a pool-wide error reject the completed() result promise
            });
          });
          const errors = yield Promise.race([
            settlementPromise,
            earlyExitPromise
          ]);
          if (errors.length > 0) {
            throw errors[0];
          }
        });
      }
      events() {
        return this.eventObservable;
      }
      queue(taskFunction) {
        const { maxQueuedJobs = Infinity } = this.options;
        if (this.isClosing) {
          throw Error(`Cannot schedule pool tasks after terminate() has been called.`);
        }
        if (this.initErrors.length > 0) {
          throw this.initErrors[0];
        }
        const taskID = this.nextTaskID++;
        const taskCompletion = this.taskCompletion(taskID);
        taskCompletion.catch((error) => {
          this.debug(`Task #${taskID} errored:`, error);
        });
        const task = {
          id: taskID,
          run: taskFunction,
          cancel: () => {
            if (this.taskQueue.indexOf(task) === -1)
              return;
            this.taskQueue = this.taskQueue.filter((someTask) => someTask !== task);
            this.eventSubject.next({
              type: pool_types_1.PoolEventType.taskCanceled,
              taskID: task.id
            });
          },
          then: taskCompletion.then.bind(taskCompletion)
        };
        if (this.taskQueue.length >= maxQueuedJobs) {
          throw Error("Maximum number of pool tasks queued. Refusing to queue another one.\nThis usually happens for one of two reasons: We are either at peak workload right now or some tasks just won't finish, thus blocking the pool.");
        }
        this.debug(`Queueing task #${task.id}...`);
        this.taskQueue.push(task);
        this.eventSubject.next({
          type: pool_types_1.PoolEventType.taskQueued,
          taskID: task.id
        });
        this.scheduleWork();
        return task;
      }
      terminate(force) {
        return __awaiter(this, void 0, void 0, function* () {
          this.isClosing = true;
          if (!force) {
            yield this.completed(true);
          }
          this.eventSubject.next({
            type: pool_types_1.PoolEventType.terminated,
            remainingQueue: [...this.taskQueue]
          });
          this.eventSubject.complete();
          yield Promise.all(this.workers.map((worker) => __awaiter(this, void 0, void 0, function* () {
            return thread_1.Thread.terminate(yield worker.init);
          })));
        });
      }
    };
    WorkerPool.EventType = pool_types_1.PoolEventType;
    function PoolConstructor(spawnWorker, optionsOrSize) {
      return new WorkerPool(spawnWorker, optionsOrSize);
    }
    PoolConstructor.EventType = pool_types_1.PoolEventType;
    exports.Pool = PoolConstructor;
  }
});

// node_modules/threads/dist/promise.js
var require_promise = __commonJS({
  "node_modules/threads/dist/promise.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createPromiseWithResolver = void 0;
    var doNothing = () => void 0;
    function createPromiseWithResolver() {
      let alreadyResolved = false;
      let resolvedTo;
      let resolver = doNothing;
      const promise = new Promise((resolve) => {
        if (alreadyResolved) {
          resolve(resolvedTo);
        } else {
          resolver = resolve;
        }
      });
      const exposedResolver = (value) => {
        alreadyResolved = true;
        resolvedTo = value;
        resolver(resolvedTo);
      };
      return [promise, exposedResolver];
    }
    exports.createPromiseWithResolver = createPromiseWithResolver;
  }
});

// node_modules/threads/dist/types/master.js
var require_master = __commonJS({
  "node_modules/threads/dist/types/master.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WorkerEventType = void 0;
    var symbols_1 = require_symbols3();
    var WorkerEventType;
    (function(WorkerEventType2) {
      WorkerEventType2["internalError"] = "internalError";
      WorkerEventType2["message"] = "message";
      WorkerEventType2["termination"] = "termination";
    })(WorkerEventType = exports.WorkerEventType || (exports.WorkerEventType = {}));
  }
});

// node_modules/threads/dist/observable-promise.js
var require_observable_promise = __commonJS({
  "node_modules/threads/dist/observable-promise.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ObservablePromise = void 0;
    var observable_fns_1 = require_observable_fns();
    var doNothing = () => void 0;
    var returnInput = (input) => input;
    var runDeferred = (fn) => Promise.resolve().then(fn);
    function fail(error) {
      throw error;
    }
    function isThenable(thing) {
      return thing && typeof thing.then === "function";
    }
    var ObservablePromise = class _ObservablePromise extends observable_fns_1.Observable {
      constructor(init) {
        super((originalObserver) => {
          const self2 = this;
          const observer = Object.assign(Object.assign({}, originalObserver), {
            complete() {
              originalObserver.complete();
              self2.onCompletion();
            },
            error(error) {
              originalObserver.error(error);
              self2.onError(error);
            },
            next(value) {
              originalObserver.next(value);
              self2.onNext(value);
            }
          });
          try {
            this.initHasRun = true;
            return init(observer);
          } catch (error) {
            observer.error(error);
          }
        });
        this.initHasRun = false;
        this.fulfillmentCallbacks = [];
        this.rejectionCallbacks = [];
        this.firstValueSet = false;
        this.state = "pending";
      }
      onNext(value) {
        if (!this.firstValueSet) {
          this.firstValue = value;
          this.firstValueSet = true;
        }
      }
      onError(error) {
        this.state = "rejected";
        this.rejection = error;
        for (const onRejected of this.rejectionCallbacks) {
          runDeferred(() => onRejected(error));
        }
      }
      onCompletion() {
        this.state = "fulfilled";
        for (const onFulfilled of this.fulfillmentCallbacks) {
          runDeferred(() => onFulfilled(this.firstValue));
        }
      }
      then(onFulfilledRaw, onRejectedRaw) {
        const onFulfilled = onFulfilledRaw || returnInput;
        const onRejected = onRejectedRaw || fail;
        let onRejectedCalled = false;
        return new Promise((resolve, reject) => {
          const rejectionCallback = (error) => {
            if (onRejectedCalled)
              return;
            onRejectedCalled = true;
            try {
              resolve(onRejected(error));
            } catch (anotherError) {
              reject(anotherError);
            }
          };
          const fulfillmentCallback = (value) => {
            try {
              resolve(onFulfilled(value));
            } catch (error) {
              rejectionCallback(error);
            }
          };
          if (!this.initHasRun) {
            this.subscribe({ error: rejectionCallback });
          }
          if (this.state === "fulfilled") {
            return resolve(onFulfilled(this.firstValue));
          }
          if (this.state === "rejected") {
            onRejectedCalled = true;
            return resolve(onRejected(this.rejection));
          }
          this.fulfillmentCallbacks.push(fulfillmentCallback);
          this.rejectionCallbacks.push(rejectionCallback);
        });
      }
      catch(onRejected) {
        return this.then(void 0, onRejected);
      }
      finally(onCompleted) {
        const handler = onCompleted || doNothing;
        return this.then((value) => {
          handler();
          return value;
        }, () => handler());
      }
      static from(thing) {
        if (isThenable(thing)) {
          return new _ObservablePromise((observer) => {
            const onFulfilled = (value) => {
              observer.next(value);
              observer.complete();
            };
            const onRejected = (error) => {
              observer.error(error);
            };
            thing.then(onFulfilled, onRejected);
          });
        } else {
          return super.from(thing);
        }
      }
    };
    exports.ObservablePromise = ObservablePromise;
  }
});

// node_modules/threads/dist/transferable.js
var require_transferable = __commonJS({
  "node_modules/threads/dist/transferable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Transfer = exports.isTransferDescriptor = void 0;
    var symbols_1 = require_symbols3();
    function isTransferable(thing) {
      if (!thing || typeof thing !== "object")
        return false;
      return true;
    }
    function isTransferDescriptor(thing) {
      return thing && typeof thing === "object" && thing[symbols_1.$transferable];
    }
    exports.isTransferDescriptor = isTransferDescriptor;
    function Transfer(payload, transferables) {
      if (!transferables) {
        if (!isTransferable(payload))
          throw Error();
        transferables = [payload];
      }
      return {
        [symbols_1.$transferable]: true,
        send: payload,
        transferables
      };
    }
    exports.Transfer = Transfer;
  }
});

// node_modules/threads/dist/types/messages.js
var require_messages = __commonJS({
  "node_modules/threads/dist/types/messages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WorkerMessageType = exports.MasterMessageType = void 0;
    var MasterMessageType;
    (function(MasterMessageType2) {
      MasterMessageType2["cancel"] = "cancel";
      MasterMessageType2["run"] = "run";
    })(MasterMessageType = exports.MasterMessageType || (exports.MasterMessageType = {}));
    var WorkerMessageType;
    (function(WorkerMessageType2) {
      WorkerMessageType2["error"] = "error";
      WorkerMessageType2["init"] = "init";
      WorkerMessageType2["result"] = "result";
      WorkerMessageType2["running"] = "running";
      WorkerMessageType2["uncaughtError"] = "uncaughtError";
    })(WorkerMessageType = exports.WorkerMessageType || (exports.WorkerMessageType = {}));
  }
});

// node_modules/threads/dist/master/invocation-proxy.js
var require_invocation_proxy = __commonJS({
  "node_modules/threads/dist/master/invocation-proxy.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createProxyModule = exports.createProxyFunction = void 0;
    var debug_1 = __importDefault(require_browser());
    var observable_fns_1 = require_observable_fns();
    var common_1 = require_common();
    var observable_promise_1 = require_observable_promise();
    var transferable_1 = require_transferable();
    var messages_1 = require_messages();
    var debugMessages = debug_1.default("threads:master:messages");
    var nextJobUID = 1;
    var dedupe = (array) => Array.from(new Set(array));
    var isJobErrorMessage = (data) => data && data.type === messages_1.WorkerMessageType.error;
    var isJobResultMessage = (data) => data && data.type === messages_1.WorkerMessageType.result;
    var isJobStartMessage = (data) => data && data.type === messages_1.WorkerMessageType.running;
    function createObservableForJob(worker, jobUID) {
      return new observable_fns_1.Observable((observer) => {
        let asyncType;
        const messageHandler = (event) => {
          debugMessages("Message from worker:", event.data);
          if (!event.data || event.data.uid !== jobUID)
            return;
          if (isJobStartMessage(event.data)) {
            asyncType = event.data.resultType;
          } else if (isJobResultMessage(event.data)) {
            if (asyncType === "promise") {
              if (typeof event.data.payload !== "undefined") {
                observer.next(common_1.deserialize(event.data.payload));
              }
              observer.complete();
              worker.removeEventListener("message", messageHandler);
            } else {
              if (event.data.payload) {
                observer.next(common_1.deserialize(event.data.payload));
              }
              if (event.data.complete) {
                observer.complete();
                worker.removeEventListener("message", messageHandler);
              }
            }
          } else if (isJobErrorMessage(event.data)) {
            const error = common_1.deserialize(event.data.error);
            if (asyncType === "promise" || !asyncType) {
              observer.error(error);
            } else {
              observer.error(error);
            }
            worker.removeEventListener("message", messageHandler);
          }
        };
        worker.addEventListener("message", messageHandler);
        return () => {
          if (asyncType === "observable" || !asyncType) {
            const cancelMessage = {
              type: messages_1.MasterMessageType.cancel,
              uid: jobUID
            };
            worker.postMessage(cancelMessage);
          }
          worker.removeEventListener("message", messageHandler);
        };
      });
    }
    function prepareArguments(rawArgs) {
      if (rawArgs.length === 0) {
        return {
          args: [],
          transferables: []
        };
      }
      const args = [];
      const transferables = [];
      for (const arg of rawArgs) {
        if (transferable_1.isTransferDescriptor(arg)) {
          args.push(common_1.serialize(arg.send));
          transferables.push(...arg.transferables);
        } else {
          args.push(common_1.serialize(arg));
        }
      }
      return {
        args,
        transferables: transferables.length === 0 ? transferables : dedupe(transferables)
      };
    }
    function createProxyFunction(worker, method) {
      return (...rawArgs) => {
        const uid = nextJobUID++;
        const { args, transferables } = prepareArguments(rawArgs);
        const runMessage = {
          type: messages_1.MasterMessageType.run,
          uid,
          method,
          args
        };
        debugMessages("Sending command to run function to worker:", runMessage);
        try {
          worker.postMessage(runMessage, transferables);
        } catch (error) {
          return observable_promise_1.ObservablePromise.from(Promise.reject(error));
        }
        return observable_promise_1.ObservablePromise.from(observable_fns_1.multicast(createObservableForJob(worker, uid)));
      };
    }
    exports.createProxyFunction = createProxyFunction;
    function createProxyModule(worker, methodNames) {
      const proxy = {};
      for (const methodName of methodNames) {
        proxy[methodName] = createProxyFunction(worker, methodName);
      }
      return proxy;
    }
    exports.createProxyModule = createProxyModule;
  }
});

// node_modules/threads/dist/master/spawn.js
var require_spawn = __commonJS({
  "node_modules/threads/dist/master/spawn.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.spawn = void 0;
    var debug_1 = __importDefault(require_browser());
    var observable_fns_1 = require_observable_fns();
    var common_1 = require_common();
    var promise_1 = require_promise();
    var symbols_1 = require_symbols3();
    var master_1 = require_master();
    var invocation_proxy_1 = require_invocation_proxy();
    var debugMessages = debug_1.default("threads:master:messages");
    var debugSpawn = debug_1.default("threads:master:spawn");
    var debugThreadUtils = debug_1.default("threads:master:thread-utils");
    var isInitMessage = (data) => data && data.type === "init";
    var isUncaughtErrorMessage = (data) => data && data.type === "uncaughtError";
    var initMessageTimeout = typeof process !== "undefined" && process.env.THREADS_WORKER_INIT_TIMEOUT ? Number.parseInt(process.env.THREADS_WORKER_INIT_TIMEOUT, 10) : 1e4;
    function withTimeout(promise, timeoutInMs, errorMessage) {
      return __awaiter(this, void 0, void 0, function* () {
        let timeoutHandle;
        const timeout = new Promise((resolve, reject) => {
          timeoutHandle = setTimeout(() => reject(Error(errorMessage)), timeoutInMs);
        });
        const result = yield Promise.race([
          promise,
          timeout
        ]);
        clearTimeout(timeoutHandle);
        return result;
      });
    }
    function receiveInitMessage(worker) {
      return new Promise((resolve, reject) => {
        const messageHandler = (event) => {
          debugMessages("Message from worker before finishing initialization:", event.data);
          if (isInitMessage(event.data)) {
            worker.removeEventListener("message", messageHandler);
            resolve(event.data);
          } else if (isUncaughtErrorMessage(event.data)) {
            worker.removeEventListener("message", messageHandler);
            reject(common_1.deserialize(event.data.error));
          }
        };
        worker.addEventListener("message", messageHandler);
      });
    }
    function createEventObservable(worker, workerTermination) {
      return new observable_fns_1.Observable((observer) => {
        const messageHandler = (messageEvent) => {
          const workerEvent = {
            type: master_1.WorkerEventType.message,
            data: messageEvent.data
          };
          observer.next(workerEvent);
        };
        const rejectionHandler = (errorEvent) => {
          debugThreadUtils("Unhandled promise rejection event in thread:", errorEvent);
          const workerEvent = {
            type: master_1.WorkerEventType.internalError,
            error: Error(errorEvent.reason)
          };
          observer.next(workerEvent);
        };
        worker.addEventListener("message", messageHandler);
        worker.addEventListener("unhandledrejection", rejectionHandler);
        workerTermination.then(() => {
          const terminationEvent = {
            type: master_1.WorkerEventType.termination
          };
          worker.removeEventListener("message", messageHandler);
          worker.removeEventListener("unhandledrejection", rejectionHandler);
          observer.next(terminationEvent);
          observer.complete();
        });
      });
    }
    function createTerminator(worker) {
      const [termination, resolver] = promise_1.createPromiseWithResolver();
      const terminate = () => __awaiter(this, void 0, void 0, function* () {
        debugThreadUtils("Terminating worker");
        yield worker.terminate();
        resolver();
      });
      return { terminate, termination };
    }
    function setPrivateThreadProps(raw, worker, workerEvents, terminate) {
      const workerErrors = workerEvents.filter((event) => event.type === master_1.WorkerEventType.internalError).map((errorEvent) => errorEvent.error);
      return Object.assign(raw, {
        [symbols_1.$errors]: workerErrors,
        [symbols_1.$events]: workerEvents,
        [symbols_1.$terminate]: terminate,
        [symbols_1.$worker]: worker
      });
    }
    function spawn(worker, options) {
      return __awaiter(this, void 0, void 0, function* () {
        debugSpawn("Initializing new thread");
        const timeout = options && options.timeout ? options.timeout : initMessageTimeout;
        const initMessage = yield withTimeout(receiveInitMessage(worker), timeout, `Timeout: Did not receive an init message from worker after ${timeout}ms. Make sure the worker calls expose().`);
        const exposed = initMessage.exposed;
        const { termination, terminate } = createTerminator(worker);
        const events = createEventObservable(worker, termination);
        if (exposed.type === "function") {
          const proxy = invocation_proxy_1.createProxyFunction(worker);
          return setPrivateThreadProps(proxy, worker, events, terminate);
        } else if (exposed.type === "module") {
          const proxy = invocation_proxy_1.createProxyModule(worker, exposed.methods);
          return setPrivateThreadProps(proxy, worker, events, terminate);
        } else {
          const type = exposed.type;
          throw Error(`Worker init message states unexpected type of expose(): ${type}`);
        }
      });
    }
    exports.spawn = spawn;
  }
});

// node_modules/threads/dist/master/index.js
var require_master2 = __commonJS({
  "node_modules/threads/dist/master/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Worker = exports.BlobWorker = exports.isWorkerRuntime = exports.Thread = exports.spawn = exports.Pool = void 0;
    var implementation_1 = require_implementation_browser();
    Object.defineProperty(exports, "isWorkerRuntime", { enumerable: true, get: function() {
      return implementation_1.isWorkerRuntime;
    } });
    var pool_1 = require_pool();
    Object.defineProperty(exports, "Pool", { enumerable: true, get: function() {
      return pool_1.Pool;
    } });
    var spawn_1 = require_spawn();
    Object.defineProperty(exports, "spawn", { enumerable: true, get: function() {
      return spawn_1.spawn;
    } });
    var thread_1 = require_thread();
    Object.defineProperty(exports, "Thread", { enumerable: true, get: function() {
      return thread_1.Thread;
    } });
    exports.BlobWorker = implementation_1.getWorkerImplementation().blob;
    exports.Worker = implementation_1.getWorkerImplementation().default;
  }
});

// node_modules/is-observable/index.js
var require_is_observable = __commonJS({
  "node_modules/is-observable/index.js"(exports, module) {
    "use strict";
    module.exports = (value) => {
      if (!value) {
        return false;
      }
      if (typeof Symbol.observable === "symbol" && typeof value[Symbol.observable] === "function") {
        return value === value[Symbol.observable]();
      }
      if (typeof value["@@observable"] === "function") {
        return value === value["@@observable"]();
      }
      return false;
    };
  }
});

// node_modules/threads/dist/worker/implementation.browser.js
var require_implementation_browser2 = __commonJS({
  "node_modules/threads/dist/worker/implementation.browser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var isWorkerRuntime = function isWorkerRuntime2() {
      const isWindowContext = typeof self !== "undefined" && typeof Window !== "undefined" && self instanceof Window;
      return typeof self !== "undefined" && self.postMessage && !isWindowContext ? true : false;
    };
    var postMessageToMaster = function postMessageToMaster2(data, transferList) {
      self.postMessage(data, transferList);
    };
    var subscribeToMasterMessages = function subscribeToMasterMessages2(onMessage) {
      const messageHandler = (messageEvent) => {
        onMessage(messageEvent.data);
      };
      const unsubscribe = () => {
        self.removeEventListener("message", messageHandler);
      };
      self.addEventListener("message", messageHandler);
      return unsubscribe;
    };
    exports.default = {
      isWorkerRuntime,
      postMessageToMaster,
      subscribeToMasterMessages
    };
  }
});

// node_modules/threads/dist/worker/index.js
var require_worker = __commonJS({
  "node_modules/threads/dist/worker/index.js"(exports) {
    "use strict";
    var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.expose = exports.isWorkerRuntime = exports.Transfer = exports.registerSerializer = void 0;
    var is_observable_1 = __importDefault(require_is_observable());
    var common_1 = require_common();
    var transferable_1 = require_transferable();
    var messages_1 = require_messages();
    var implementation_1 = __importDefault(require_implementation_browser2());
    var common_2 = require_common();
    Object.defineProperty(exports, "registerSerializer", { enumerable: true, get: function() {
      return common_2.registerSerializer;
    } });
    var transferable_2 = require_transferable();
    Object.defineProperty(exports, "Transfer", { enumerable: true, get: function() {
      return transferable_2.Transfer;
    } });
    exports.isWorkerRuntime = implementation_1.default.isWorkerRuntime;
    var exposeCalled = false;
    var activeSubscriptions = /* @__PURE__ */ new Map();
    var isMasterJobCancelMessage = (thing) => thing && thing.type === messages_1.MasterMessageType.cancel;
    var isMasterJobRunMessage = (thing) => thing && thing.type === messages_1.MasterMessageType.run;
    var isObservable = (thing) => is_observable_1.default(thing) || isZenObservable(thing);
    function isZenObservable(thing) {
      return thing && typeof thing === "object" && typeof thing.subscribe === "function";
    }
    function deconstructTransfer(thing) {
      return transferable_1.isTransferDescriptor(thing) ? { payload: thing.send, transferables: thing.transferables } : { payload: thing, transferables: void 0 };
    }
    function postFunctionInitMessage() {
      const initMessage = {
        type: messages_1.WorkerMessageType.init,
        exposed: {
          type: "function"
        }
      };
      implementation_1.default.postMessageToMaster(initMessage);
    }
    function postModuleInitMessage(methodNames) {
      const initMessage = {
        type: messages_1.WorkerMessageType.init,
        exposed: {
          type: "module",
          methods: methodNames
        }
      };
      implementation_1.default.postMessageToMaster(initMessage);
    }
    function postJobErrorMessage(uid, rawError) {
      const { payload: error, transferables } = deconstructTransfer(rawError);
      const errorMessage = {
        type: messages_1.WorkerMessageType.error,
        uid,
        error: common_1.serialize(error)
      };
      implementation_1.default.postMessageToMaster(errorMessage, transferables);
    }
    function postJobResultMessage(uid, completed, resultValue) {
      const { payload, transferables } = deconstructTransfer(resultValue);
      const resultMessage = {
        type: messages_1.WorkerMessageType.result,
        uid,
        complete: completed ? true : void 0,
        payload
      };
      implementation_1.default.postMessageToMaster(resultMessage, transferables);
    }
    function postJobStartMessage(uid, resultType) {
      const startMessage = {
        type: messages_1.WorkerMessageType.running,
        uid,
        resultType
      };
      implementation_1.default.postMessageToMaster(startMessage);
    }
    function postUncaughtErrorMessage(error) {
      try {
        const errorMessage = {
          type: messages_1.WorkerMessageType.uncaughtError,
          error: common_1.serialize(error)
        };
        implementation_1.default.postMessageToMaster(errorMessage);
      } catch (subError) {
        console.error("Not reporting uncaught error back to master thread as it occured while reporting an uncaught error already.\nLatest error:", subError, "\nOriginal error:", error);
      }
    }
    function runFunction(jobUID, fn, args) {
      return __awaiter(this, void 0, void 0, function* () {
        let syncResult;
        try {
          syncResult = fn(...args);
        } catch (error) {
          return postJobErrorMessage(jobUID, error);
        }
        const resultType = isObservable(syncResult) ? "observable" : "promise";
        postJobStartMessage(jobUID, resultType);
        if (isObservable(syncResult)) {
          const subscription = syncResult.subscribe((value) => postJobResultMessage(jobUID, false, common_1.serialize(value)), (error) => {
            postJobErrorMessage(jobUID, common_1.serialize(error));
            activeSubscriptions.delete(jobUID);
          }, () => {
            postJobResultMessage(jobUID, true);
            activeSubscriptions.delete(jobUID);
          });
          activeSubscriptions.set(jobUID, subscription);
        } else {
          try {
            const result = yield syncResult;
            postJobResultMessage(jobUID, true, common_1.serialize(result));
          } catch (error) {
            postJobErrorMessage(jobUID, common_1.serialize(error));
          }
        }
      });
    }
    function expose(exposed) {
      if (!implementation_1.default.isWorkerRuntime()) {
        throw Error("expose() called in the master thread.");
      }
      if (exposeCalled) {
        throw Error("expose() called more than once. This is not possible. Pass an object to expose() if you want to expose multiple functions.");
      }
      exposeCalled = true;
      if (typeof exposed === "function") {
        implementation_1.default.subscribeToMasterMessages((messageData) => {
          if (isMasterJobRunMessage(messageData) && !messageData.method) {
            runFunction(messageData.uid, exposed, messageData.args.map(common_1.deserialize));
          }
        });
        postFunctionInitMessage();
      } else if (typeof exposed === "object" && exposed) {
        implementation_1.default.subscribeToMasterMessages((messageData) => {
          if (isMasterJobRunMessage(messageData) && messageData.method) {
            runFunction(messageData.uid, exposed[messageData.method], messageData.args.map(common_1.deserialize));
          }
        });
        const methodNames = Object.keys(exposed).filter((key) => typeof exposed[key] === "function");
        postModuleInitMessage(methodNames);
      } else {
        throw Error(`Invalid argument passed to expose(). Expected a function or an object, got: ${exposed}`);
      }
      implementation_1.default.subscribeToMasterMessages((messageData) => {
        if (isMasterJobCancelMessage(messageData)) {
          const jobUID = messageData.uid;
          const subscription = activeSubscriptions.get(jobUID);
          if (subscription) {
            subscription.unsubscribe();
            activeSubscriptions.delete(jobUID);
          }
        }
      });
    }
    exports.expose = expose;
    if (typeof self !== "undefined" && typeof self.addEventListener === "function" && implementation_1.default.isWorkerRuntime()) {
      self.addEventListener("error", (event) => {
        setTimeout(() => postUncaughtErrorMessage(event.error || event), 250);
      });
      self.addEventListener("unhandledrejection", (event) => {
        const error = event.reason;
        if (error && typeof error.message === "string") {
          setTimeout(() => postUncaughtErrorMessage(error), 250);
        }
      });
    }
    if (typeof process !== "undefined" && typeof process.on === "function" && implementation_1.default.isWorkerRuntime()) {
      process.on("uncaughtException", (error) => {
        setTimeout(() => postUncaughtErrorMessage(error), 250);
      });
      process.on("unhandledRejection", (error) => {
        if (error && typeof error.message === "string") {
          setTimeout(() => postUncaughtErrorMessage(error), 250);
        }
      });
    }
  }
});

// node_modules/threads/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/threads/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Transfer = exports.DefaultSerializer = exports.expose = exports.registerSerializer = void 0;
    var common_1 = require_common();
    Object.defineProperty(exports, "registerSerializer", { enumerable: true, get: function() {
      return common_1.registerSerializer;
    } });
    __exportStar(require_master2(), exports);
    var index_1 = require_worker();
    Object.defineProperty(exports, "expose", { enumerable: true, get: function() {
      return index_1.expose;
    } });
    var serializers_1 = require_serializers();
    Object.defineProperty(exports, "DefaultSerializer", { enumerable: true, get: function() {
      return serializers_1.DefaultSerializer;
    } });
    var transferable_1 = require_transferable();
    Object.defineProperty(exports, "Transfer", { enumerable: true, get: function() {
      return transferable_1.Transfer;
    } });
  }
});

// build/dispatcher.js
var require_dispatcher = __commonJS({
  "build/dispatcher.js"(exports, module) {
    "use strict";
    var { spawn, Thread, Worker: Worker2 } = require_dist2();
    var isNodeJs = typeof process === "object" && process + "" === "[object process]";
    var Dispatcher = class {
      constructor() {
        this.worker = null;
        this.workerPath = null;
      }
      setWorkerPath(workerPath) {
        this.workerPath = workerPath;
      }
      getWorkerPath() {
        if (this.workerPath) {
          return this.workerPath;
        }
        if (isNodeJs) {
          return "./kuzu_wasm_worker.js";
        }
        const scriptPath = import.meta.url;
        const basePath = scriptPath.substring(0, scriptPath.lastIndexOf("/"));
        return `${basePath}/kuzu_wasm_worker.js`;
      }
      async init() {
        const workerUrl = this.getWorkerPath();
        this.worker = await spawn(new Worker2(workerUrl), { timeout: 6e4 });
        const res = await this.worker.init();
        if (res.isSuccess) {
          return res;
        } else {
          throw new Error(res.error);
        }
      }
      async close() {
        if (this.worker) {
          await Thread.terminate(this.worker);
        }
      }
      async getWorker() {
        if (!this.worker) {
          if (!this.workerInitPromise) {
            this.workerInitPromise = this.init();
          }
          await this.workerInitPromise;
          delete this.workerInitPromise;
        }
        return this.worker;
      }
    };
    var dispatcher = new Dispatcher();
    module.exports = dispatcher;
  }
});

// build/database.js
var require_database = __commonJS({
  "build/database.js"(exports, module) {
    "use strict";
    var dispatcher = require_dispatcher();
    var Database = class {
      /**
       * Initialize a new Database object. Note that the initialization is done
       * lazily, so the database file is not opened until the first query is
       * executed. To initialize the database immediately, call the `init()`
       * function on the returned object.
       *
       * @param {String} databasePath path to the database file. If the path is not 
       * specified, or empty, or equal to `:memory:`, the database will be created 
       * in memory.
       * @param {Number} bufferManagerSize size of the buffer manager in bytes.
       * @param {Boolean} enableCompression whether to enable compression.
       * @param {Boolean} readOnly if true, database will be opened in read-only 
       * mode.
       * @param {Boolean} autoCheckpoint if true, automatic checkpointing will be 
       * enabled.
       * @param {Number} checkpointThreshold threshold for automatic checkpointing 
       * in bytes. Default is 16MB.
       */
      constructor(databasePath, bufferPoolSize = 0, maxNumThreads = 0, enableCompression = true, readOnly = false, autoCheckpoint = true, checkpointThreshold = 16777216) {
        this._isInitialized = false;
        this._initPromise = null;
        this._id = null;
        this._isClosed = false;
        this.databasePath = databasePath;
        this.bufferPoolSize = bufferPoolSize;
        this.maxNumThreads = maxNumThreads;
        this.enableCompression = enableCompression;
        this.readOnly = readOnly;
        this.autoCheckpoint = autoCheckpoint;
        this.checkpointThreshold = checkpointThreshold;
      }
      /**
       * Initialize the database. Calling this function is optional, as the
       * database is initialized automatically when the first query is executed.
       */
      async init() {
        if (!this._isInitialized) {
          if (!this._initPromise) {
            this._initPromise = (async () => {
              const worker = await dispatcher.getWorker();
              const res = await worker.databaseConstruct(
                this.databasePath,
                this.bufferPoolSize,
                this.maxNumThreads,
                this.enableCompression,
                this.readOnly,
                this.autoCheckpoint,
                this.checkpointThreshold
              );
              if (res.isSuccess) {
                this._id = res.id;
                this._isInitialized = true;
              } else {
                throw new Error(res.error);
              }
            })();
          }
        }
        await this._initPromise;
        this._initPromise = null;
      }
      /**
       * Internal function to get the database object ID.
       * @private
       * @throws {Error} if the database is closed.
       */
      async _getDatabaseObjectId() {
        if (this._isClosed) {
          throw new Error("Database is closed.");
        }
        if (!this._isInitialized) {
          await this.init();
        }
        return this._id;
      }
      /**
       * Close the database.
       */
      async close() {
        if (!this._isClosed) {
          const worker = await dispatcher.getWorker();
          await worker.databaseClose(this._id);
          this._isClosed = true;
        }
      }
    };
    module.exports = Database;
  }
});

// build/query_result.js
var require_query_result = __commonJS({
  "build/query_result.js"(exports, module) {
    "use strict";
    var dispatcher = require_dispatcher();
    var QueryResult = class _QueryResult {
      /**
       * Internal constructor. Use `Connection.query` or `Connection.execute`
       * to get a `QueryResult` object.
       * @param {String} id the internal ID of the query result object.
       */
      constructor(id) {
        this._id = id;
        this._isClosed = false;
        this._hasNext = void 0;
        this._hasNextQueryResult = void 0;
        this._isSuccess = void 0;
      }
      /**
       * Internal function to update the local fields with the values from the
       * worker.
       * @private
       * @throws {Error} if the query result is closed.
       */
      async _syncValues() {
        if (this._isClosed) {
          return;
        }
        const worker = await dispatcher.getWorker();
        let res = await worker.queryResultHasNext(this._id);
        if (res.isSuccess) {
          this._hasNext = res.result;
        } else {
          throw new Error(res.error);
        }
        res = await worker.queryResultHasNextQueryResult(this._id);
        if (res.isSuccess) {
          this._hasNextQueryResult = res.result;
        } else {
          throw new Error(res.error);
        }
        res = await worker.queryResultIsSuccess(this._id);
        if (res.isSuccess) {
          this._isSuccess = res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Check if the query result is successfully executed.
       * @returns {Boolean} true if the query result is successfully executed.
       */
      isSuccess() {
        return this._isSuccess;
      }
      /**
       * Get the error message if the query result is not successfully executed.
       * @returns {String} the error message.
       */
      async getErrorMessage() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetErrorMessage(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Reset the iterator of the query result to the beginning.
       * This function is useful if the query result is iterated multiple times.
       */
      async resetIterator() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultResetIterator(this._id);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
        await this._syncValues();
      }
      /**
       * Get the number of rows of the query result.
       * @returns {Number} the number of rows of the query result.
       */
      hasNext() {
        return this._hasNext;
      }
      /**
       * Check if the query result has a following query result when multiple 
       * statements are executed within a single query.
       * @returns {Boolean} true if the query result has a following query result.
       */
      hasNextQueryResult() {
        return this._hasNextQueryResult;
      }
      /**
       * Get the number of columns of the query result.
       * @returns {Number} the number of columns of the query result.
       */
      async getNumColumns() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetNumColumns(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the number of rows of the query result.
       * @returns {Number} the number of rows of the query result.
       */
      async getNumTuples() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetNumTuples(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the column names of the query result.
       * @returns {Array<String>} the column names of the query result.
       */
      async getColumnNames() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetColumnNames(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the column types of the query result.
       * @returns {Array<String>} the column types of the query result.
       */
      async getColumnTypes() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetColumnTypes(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the string representation of the query result.
       * @returns {String} the string representation of the query result.
       */
      async toString() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultToString(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the query summary (execution time and compiling time) of the query 
       * result.
       * @returns {Object} the query summary of the query result.
       */
      async getQuerySummary() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetQuerySummary(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the following query result when multiple statements are executed within 
       * a single query.
       * @returns {QueryResult} the next query result.
       */
      async getNextQueryResult() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetNextQueryResult(this._id);
        if (res.isSuccess) {
          const nextQueryResultId = res.result;
          const nextQueryResult = new _QueryResult(nextQueryResultId);
          await nextQueryResult._syncValues();
          return nextQueryResult;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get the next row of the query result.
       * @returns {Array} the next row of the query result.
       */
      async getNext() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetNext(this._id);
        if (res.isSuccess) {
          await this._syncValues();
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get all rows of the query result.
       * @returns {Array<Array>} all rows of the query result.
       */
      async getAllRows() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetAllRows(this._id);
        if (res.isSuccess) {
          await this._syncValues();
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Get all objects of the query result.
       * @returns {Array<Object>} all objects of the query result.
       */
      async getAllObjects() {
        const worker = await dispatcher.getWorker();
        const res = await worker.queryResultGetAllObjects(this._id);
        if (res.isSuccess) {
          await this._syncValues();
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Close the query result.
       */
      async close() {
        if (!this._isClosed) {
          const worker = await dispatcher.getWorker();
          await worker.queryResultClose(this._id);
          this._isClosed = true;
        }
      }
    };
    module.exports = QueryResult;
  }
});

// build/prepared_statement.js
var require_prepared_statement = __commonJS({
  "build/prepared_statement.js"(exports, module) {
    "use strict";
    var dispatcher = require_dispatcher();
    var PreparedStatement = class {
      /**
       * Internal constructor. Use `Connection.prepare` to get a
       * `PreparedStatement` object.
       * @param {String} id the internal ID of the prepared statement object.
       * statement object.
       */
      constructor(id) {
        this._id = id;
        this._isClosed = false;
        this._isSuccess = void 0;
      }
      /**
       * Internal function to update the local fields with the values from the 
       * worker.
       * @private
       * @throws {Error} if the prepared statement is closed.
       */
      async _syncValues() {
        if (this._isClosed) {
          return;
        }
        const worker = await dispatcher.getWorker();
        let res = await worker.preparedStatementIsSuccess(this._id);
        if (res.isSuccess) {
          this._isSuccess = res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Check if the prepared statement is successfully prepared.
       * @returns {Boolean} true if the prepared statement is successfully 
       * prepared.
       */
      isSuccess() {
        return this._isSuccess;
      }
      /**
       * Get the error message if the prepared statement is not successfully 
       * prepared.
       * @returns {String} the error message.
       */
      async getErrorMessage() {
        const worker = await dispatcher.getWorker();
        const res = await worker.preparedStatementGetErrorMessage(this._id);
        if (res.isSuccess) {
          return res.result;
        } else {
          throw new Error(res.error);
        }
      }
      /**
       * Close the prepared statement.
       * @throws {Error} if the prepared statement is closed.
       */
      async close() {
        if (!this._isClosed) {
          const worker = await dispatcher.getWorker();
          await worker.preparedStatementClose(this._id);
          this._isClosed = true;
        }
      }
    };
    module.exports = PreparedStatement;
  }
});

// build/connection.js
var require_connection = __commonJS({
  "build/connection.js"(exports, module) {
    "use strict";
    var dispatcher = require_dispatcher();
    var QueryResult = require_query_result();
    var PreparedStatement = require_prepared_statement();
    var Connection = class {
      /**
       * Initialize a new Connection object. Note that the initialization is done
       * lazily, so the connection is not initialized until the first query is
       * executed. To initialize the connection immediately, call the `init()`
       * function on the returned object.
       * @param {kuzu.Database} database the database object to connect to.
       * @param {Number} numThreads the maximum number of threads to use for query 
       * execution.
       */
      constructor(database, numThreads = null) {
        this._isInitialized = false;
        this._initPromise = null;
        this._id = null;
        this._isClosed = false;
        this._database = database;
        this.numThreads = numThreads;
      }
      /**
       * Initialize the connection. Calling this function is optional, as the
       * connection is initialized automatically when the first query is executed.
       */
      async init() {
        if (!this._isInitialized) {
          if (!this._initPromise) {
            this._initPromise = (async () => {
              const databaseId = await this._database._getDatabaseObjectId();
              const worker = await dispatcher.getWorker();
              const res = await worker.connectionConstruct(databaseId, this.numThreads);
              if (res.isSuccess) {
                this._id = res.id;
                this._isInitialized = true;
              } else {
                throw new Error(res.error);
              }
            })();
          }
          await this._initPromise;
          this._initPromise = null;
        }
      }
      /**
       * Internal function to get the connection object ID.
       * @private
       * @throws {Error} if the connection is closed.
       */
      async _getConnectionObjectId() {
        if (this._isClosed) {
          throw new Error("Connection is closed.");
        }
        if (!this._isInitialized) {
          await this.init();
        }
        return this._id;
      }
      /**
       * Set the maximum number of threads to use for query execution.
       * @param {Number} numThreads the maximum number of threads to use for query 
       * execution.
       */
      async setMaxNumThreadForExec(numThreads) {
        const connectionId = await this._getConnectionObjectId();
        const worker = await dispatcher.getWorker();
        const res = await worker.connectionSetMaxNumThreadForExec(connectionId, numThreads);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
      }
      /**
       * Set the query timeout in milliseconds.
       * @param {Number} timeout the query timeout in milliseconds.
       */
      async setQueryTimeout(timeout) {
        const connectionId = await this._getConnectionObjectId();
        const worker = await dispatcher.getWorker();
        const res = await worker.connectionSetQueryTimeout(connectionId, timeout);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
      }
      /**
       * Get the maximum number of threads to use for query execution.
       * @returns {Number} the maximum number of threads to use for query execution.
       */
      async getMaxNumThreadForExec() {
        const connectionId = await this._getConnectionObjectId();
        const worker = await dispatcher.getWorker();
        const res = await worker.connectionGetMaxNumThreadForExec(connectionId);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
        return res.numThreads;
      }
      /**
       * Execute a query.
       * @param {String} statement the statement to execute.
       * @returns {kuzu.QueryResult} the query result.
       */
      async query(statement) {
        const connectionId = await this._getConnectionObjectId();
        const worker = await dispatcher.getWorker();
        const res = await worker.connectionQuery(connectionId, statement);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
        const queryResult = new QueryResult(res.id);
        await queryResult._syncValues();
        return queryResult;
      }
      /**
       * Prepare a statement for execution.
       * @param {String} statement the statement to prepare.
       * @returns {kuzu.PreparedStatement} the prepared statement.
       */
      async prepare(statement) {
        const connectionId = await this._getConnectionObjectId();
        const worker = await dispatcher.getWorker();
        const res = await worker.connectionPrepare(connectionId, statement);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
        const preparedStatement = new PreparedStatement(res.id);
        await preparedStatement._syncValues();
        return preparedStatement;
      }
      /**
       * Execute a prepared statement.
       * @param {kuzu.sync.PreparedStatement} preparedStatement the prepared 
       * statement to execute.
       * @param {Object} params a plain object mapping parameter names to values.
       * @returns {kuzu.QueryResult} the query result.
       */
      async execute(preparedStatement, params = {}) {
        const connectionId = await this._getConnectionObjectId();
        const worker = await dispatcher.getWorker();
        const res = await worker.connectionExecute(connectionId, preparedStatement._id, params);
        if (!res.isSuccess) {
          throw new Error(res.error);
        }
        const queryResult = new QueryResult(res.id);
        await queryResult._syncValues();
        return queryResult;
      }
      /**
       * Close the connection.
       */
      async close() {
        if (!this._isClosed) {
          const connectionId = await this._getConnectionObjectId();
          const worker = await dispatcher.getWorker();
          await worker.connectionClose(connectionId);
          this._isClosed = true;
        }
      }
    };
    module.exports = Connection;
  }
});

// build/fs.js
var require_fs = __commonJS({
  "build/fs.js"(exports, module) {
    "use strict";
    var dispatcher = require_dispatcher();
    var FS = class {
      /**
       * Initialize a new FS object.
       */
      constructor() {
      }
      /**
       * Read a file from the filesystem.
       * @param {String} path the path to the file.
       * @returns {Buffer} the file contents.
       * @throws {Error} if the file cannot be read.
       */
      async readFile(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSReadFile(path);
        if (result.isFail) {
          throw new Error(result.error);
        }
        return result;
      }
      /**
       * Write a file to the filesystem.
       * @param {String} path the path to the file.
       * @param {Buffer | String} data the data to write.
       * @throws {Error} if the file cannot be written.
       */
      async writeFile(path, data) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSWriteFile(path, data);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Make a directory in the filesystem.
       * @param {String} path the path to the directory.
       * @throws {Error} if the directory cannot be created.
       */
      async mkdir(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSMkdir(path);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Remove a file from the filesystem.
       * @param {String} path the path to the file.
       * @throws {Error} if the file cannot be removed.
       */
      async unlink(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSUnlink(path);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Rename a file in the filesystem.
       * @param {String} oldPath the old path to the file.
       * @param {String} newPath the new path to the file.
       * @throws {Error} if the file cannot be renamed.
       */
      async rename(oldPath, newPath) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSRename(oldPath, newPath);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Remove a directory from the filesystem.
       * @param {String} path the path to the directory.
       * @throws {Error} if the directory cannot be removed.
       */
      async rmdir(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSRmdir(path);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Get the status of a file in the filesystem.
       * @param {String} path the path to the file.
       * @returns {Object} the status of the file.
       * @throws {Error} if the status cannot be retrieved.
       */
      async stat(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSStat(path);
        if (result.isSuccess) {
          return result.result;
        }
        throw new Error(result.error);
      }
      /**
       * Get the files in a directory.
       * @param {String} path the path to the directory.
       * @returns {Array} the files in the directory.
       * @throws {Error} if the files cannot be retrieved.
       */
      async readDir(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSReadDir(path);
        if (result.isSuccess) {
          return result.result;
        }
        throw new Error(result.error);
      }
      /**
       * Mount a directory as the IDBFS filesystem (persistent storage).
       * @param {String} path the path to the directory.
       * @throws {Error} if the directory cannot be mounted.
       */
      async mountIdbfs(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSMountIdbfs(path);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Unmount a mounted filesystem.
       * @param {String} path the path to the filesystem.
       * @throws {Error} if the filesystem cannot be unmounted.
       */
      async unmount(path) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSUnmount(path);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
      /**
       * Synchronize the IDBFS filesystem with the underlying storage.
       * @param {Boolean} populate control the intended direction of the 
       * synchronization `true` to initialize the file system data with the 
       * data from the file system’s persistent source, and `false` to save the 
       * file system data to the file system’s persistent source.
       * @throws {Error} if the filesystem cannot be synchronized.
       */
      async syncfs(populate) {
        const worker = await dispatcher.getWorker();
        const result = await worker.FSSyncfs(populate);
        if (!result.isSuccess) {
          throw new Error(result.error);
        }
      }
    };
    module.exports = new FS();
  }
});

// build/index.js
var require_index = __commonJS({
  "build/index.js"(exports, module) {
    var dispatcher = require_dispatcher();
    var Database = require_database();
    var Connection = require_connection();
    var PreparedStatement = require_prepared_statement();
    var QueryResult = require_query_result();
    var FS = require_fs();
    module.exports = {
      /**
       * Initialize the Kuzu WebAssembly module. Calling this function is optional,
       * as the module is initialized automatically when the first query is executed.
       * @memberof module:kuzu-wasm
       */
      init: async () => {
        await dispatcher.init();
      },
      /**
       * Get the version of the Kuzu WebAssembly module.
       * @memberof module:kuzu-wasm
       * @returns {String} the version of the Kuzu WebAssembly module.
       */
      getVersion: async () => {
        const worker = await dispatcher.getWorker();
        const version = await worker.getVersion();
        return version;
      },
      /**
       * Get the storage version of the Kuzu WebAssembly module.
       * @memberof module:kuzu-wasm
       * @returns {BigInt} the storage version of the Kuzu WebAssembly module.
       */
      getStorageVersion: async () => {
        const worker = await dispatcher.getWorker();
        const storageVersion = await worker.getStorageVersion();
        return storageVersion;
      },
      /**
       * Set the path to the WebAssembly worker script. By default, the worker 
       * script is resolved under the same directory / URL prefix as the main 
       * module. If you want to change the location of the worker script, you can 
       * pass the worker path parameter to this function. This function must be 
       * called before any other function calls to the WebAssembly module. After the 
       * initialization is started, the worker script path cannot be changed and not 
       * finding the worker script will cause an error.
       * @memberof module:kuzu-wasm
       * @param {String} workerPath the path to the WebAssembly worker script.
       */
      setWorkerPath: (workerPath) => {
        dispatcher.setWorkerPath(workerPath);
      },
      /**
       * Destroy the Kuzu WebAssembly module and kill the worker. This function
       * should be called when the module is no longer needed to free up resources.
       * @memberof module:kuzu-wasm
       */
      close: async () => {
        await dispatcher.close();
      },
      Database,
      Connection,
      PreparedStatement,
      QueryResult,
      FS
    };
  }
});
export default require_index();
