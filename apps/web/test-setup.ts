import { GlobalRegistrator } from "@happy-dom/global-registrator";

const native = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
};

GlobalRegistrator.register();
Object.assign(globalThis, native);
Reflect.deleteProperty(globalThis, "XMLHttpRequest");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
