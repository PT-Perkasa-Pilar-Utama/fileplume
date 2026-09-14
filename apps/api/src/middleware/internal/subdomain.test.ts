import { describe, expect, test } from "bun:test";
import { subdomainOf } from "./subdomain.ts";

describe("subdomainOf", () => {
  test.each([
    ["contohbaru.archiva.id", "archiva.id", "contohbaru"],
    ["contohbaru.sit.archiva.id", "sit.archiva.id", "contohbaru"],
    ["archiva-demo.localhost", "localhost", "archiva-demo"],
    ["ContohBaru.Archiva.id", "archiva.id", "contohbaru"],
    ["admin.archiva.id", "archiva.id", "admin"],
  ])("%s under %s is %s", (hostname, baseHost, expected) => {
    expect(subdomainOf(hostname, baseHost)).toBe(expected);
  });

  test.each([
    ["archiva.id", "archiva.id"],
    ["a.b.archiva.id", "archiva.id"],
    ["contohbaru.evil.id", "archiva.id"],
    ["contohbaruarchiva.id", "archiva.id"],
    ["-bad.archiva.id", "archiva.id"],
  ])("%s under %s addresses no tenant", (hostname, baseHost) => {
    expect(subdomainOf(hostname, baseHost)).toBeNull();
  });
});
