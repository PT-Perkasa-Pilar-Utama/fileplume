import { loadConfig } from "@archiva/config";
import { STAGES } from "@archiva/enrichment";
import { QUEUE_NAME } from "./jobs/process-document.ts";

/** Composition root for the worker. Adapters are built here, not in the module. */
const config = loadConfig();

console.log(
  JSON.stringify({
    msg: "worker starting",
    queue: QUEUE_NAME,
    stages: STAGES,
    concurrency: config.WORKER_CONCURRENCY,
    maxAttempts: config.WORKER_MAX_ATTEMPTS,
  }),
);

// SCAFFOLD: the BullMQ consumer and the injected MalwareScanner, TextExtractor
// and AiProvider adapters land in BE-S3-01 through BE-S3-04.
