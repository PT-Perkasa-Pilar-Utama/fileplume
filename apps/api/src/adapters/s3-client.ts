import type { Config } from "@archiva/config";
import { S3Client } from "bun";

export type S3ClientConfig = Pick<
  Config,
  | "S3_ENDPOINT"
  | "S3_REGION"
  | "S3_BUCKET"
  | "S3_ACCESS_KEY_ID"
  | "S3_SECRET_ACCESS_KEY"
  | "S3_FORCE_PATH_STYLE"
>;

/** technical-specs/11-environment-configuration.md 11.2. */
export function createS3Client(config: S3ClientConfig): S3Client {
  return new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    bucket: config.S3_BUCKET,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    virtualHostedStyle: !config.S3_FORCE_PATH_STYLE,
  });
}
