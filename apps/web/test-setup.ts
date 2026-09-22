import { GlobalRegistrator } from "@happy-dom/global-registrator";

const native = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  // happy-dom shims these, but a shimmed FormData serializes to
  // "[object Object]" under a native Request, which breaks every API
  // multipart test with UPLOAD_INTERRUPTED. Browser tests do not need
  // the shims: the natives are what a real browser provides.
  File: globalThis.File,
  FormData: globalThis.FormData,
  Blob: globalThis.Blob,
};

GlobalRegistrator.register();
Object.assign(globalThis, native);

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
