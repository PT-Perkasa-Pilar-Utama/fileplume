import type { S3Client } from "bun";
import { GenericContainer, Wait } from "testcontainers";
import { createS3Client } from "../adapters/s3-client.ts";

const S3_PORT = 8333;
const BUCKET = "archiva";

/**
 * Test-only bootstrap: the blobstore image compose.yaml runs, started the same
 * way. CODING_STANDARD.md 10.5 — a mocked S3 call proves the mock, not the wire.
 */
export async function startTestBlobStore(): Promise<{
  s3: S3Client;
  stop: () => Promise<void>;
}> {
  const container = await new GenericContainer(
    "chrislusf/seaweedfs:4.47@sha256:ce9e796f1fe6f06968f4c04bdaf8f678dad9c8acdfef3d244133d71bfa6bf882",
  )
    .withCommand([
      "mini",
      `-bucket=${BUCKET}`,
      "-master.telemetry=false",
      "-webdav=false",
      "-admin.ui=false",
      "-s3.port.iceberg=0",
      "-s3.port.lance=0",
    ])
    .withEnvironment({ AWS_ACCESS_KEY_ID: "archiva", AWS_SECRET_ACCESS_KEY: "archiva-secret" })
    .withExposedPorts(S3_PORT)
    .withWaitStrategy(Wait.forLogMessage(`created bucket ${BUCKET}`))
    .start();

  const s3 = createS3Client({
    S3_ENDPOINT: `http://${container.getHost()}:${container.getMappedPort(S3_PORT)}`,
    S3_REGION: "us-east-1",
    S3_BUCKET: BUCKET,
    S3_ACCESS_KEY_ID: "archiva",
    S3_SECRET_ACCESS_KEY: "archiva-secret",
    S3_FORCE_PATH_STYLE: true,
  });

  return {
    s3,
    async stop() {
      await container.stop();
    },
  };
}
