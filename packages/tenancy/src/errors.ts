export type TenantNameTaken = { kind: "TenantNameTaken" };
export type SubdomainTaken = { kind: "SubdomainTaken" };
export type InvalidConfigValue = { kind: "InvalidConfigValue"; key: string };
export type ValueOutOfRange = {
  kind: "ValueOutOfRange";
  key: string;
  min: number;
  max: number;
  unit: string;
};
export type NotEditableByTenant = { kind: "NotEditableByTenant"; key: string };
export type QuotaExceeded = { kind: "QuotaExceeded" };
