import { loadConfig } from "@archiva/config";
import { createApp } from "./app.ts";

/** Composition root: builds adapters, wires modules, binds the port. */
const config = loadConfig();

// SCAFFOLD: real dependency probes are built in BE-S1-04, one per row of
// api-specs/10-system.md 10.3.
const app = createApp(config, []);

export default { port: config.PORT, fetch: app.fetch };
