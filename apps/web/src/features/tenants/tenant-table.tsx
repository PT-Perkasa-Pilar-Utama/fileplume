import type { TenantListItem } from "@archiva/shared";
import type { JSX } from "react";
import { Badge } from "../../components/ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";
import { formatStorage } from "../../lib/format.ts";

export interface TenantTableProps {
  tenants: readonly TenantListItem[];
  isLoading?: boolean;
}

export function TenantTable({ tenants, isLoading = false }: TenantTableProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
        Memuat daftar tenant...
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
        Belum ada tenant terdaftar.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Organisasi</TableHead>
            <TableHead>Subdomain</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Penyimpanan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id} data-testid={`tenant-row-${tenant.id}`}>
              <TableCell className="font-medium text-foreground">{tenant.name}</TableCell>
              <TableCell className="font-mono text-muted-foreground text-xs">
                {tenant.subdomain}.archiva.id
              </TableCell>
              <TableCell>
                <Badge variant="success" className="capitalize">
                  {tenant.status === "active" ? "Active" : tenant.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatStorage(
                  tenant.storageUsedBytes,
                  tenant.storageQuotaBytes,
                  tenant.storagePercent,
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
