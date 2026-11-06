export const DOCUMENT_QUEUE = "document.process";
export const PROCESS_DOCUMENT_JOB = "process-document";
export const PROCESSING_ATTEMPTS = 3;
export const PROCESSING_BACKOFF_MS = 5000;

export function documentJobOptions(documentId: string): {
  jobId: string;
  attempts: number;
  backoff: { type: "exponential"; delay: number };
  removeOnComplete: { age: number; count: number };
  removeOnFail: boolean;
} {
  return {
    jobId: documentId,
    attempts: PROCESSING_ATTEMPTS,
    backoff: { type: "exponential", delay: PROCESSING_BACKOFF_MS },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: false,
  };
}

export function valkeyConnection(url: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    db: Number(parsed.pathname.slice(1) || "0"),
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
