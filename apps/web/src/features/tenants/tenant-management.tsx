import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import { type ChangeEvent, type JSX, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { ApiError } from "../../lib/api.ts";
import { createTenantRequest, fetchTenants } from "./api.ts";
import { TenantForm } from "./tenant-form.tsx";
import { TenantTable } from "./tenant-table.tsx";
import type { CreateTenantFormInput } from "./types.ts";

export function TenantManagement(): JSX.Element {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenants", { q: searchQuery }],
    queryFn: () => fetchTenants({ q: searchQuery || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateTenantFormInput) => createTenantRequest(values),
    onSuccess: () => {
      setServerError(null);
      // AC-43.01: "Sistem menampilkan pesan sukses: 'Tenant berhasil ditambahkan'"
      setSuccessMessage("Tenant berhasil ditambahkan");
      void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (error: unknown) => {
      setSuccessMessage(null);
      if (error instanceof ApiError) {
        setServerError(error.message);
      } else if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError("Gagal menambahkan tenant");
      }
    },
  });

  const handleCreateTenant = async (values: CreateTenantFormInput): Promise<void> => {
    setServerError(null);
    setSuccessMessage(null);
    await createMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight text-foreground">Manajemen Tenant</h1>
          <p className="text-muted-foreground text-sm">
            Kelola organisasi dan alokasi penyimpanan tenant pada platform Archiva.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-5 text-primary" />
            Tambah Tenant Baru
          </CardTitle>
          <CardDescription>
            Daftarkan organisasi baru ke dalam sistem dengan mengisikan nama dan subdomain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantForm
            onSubmit={handleCreateTenant}
            isSubmitting={createMutation.isPending}
            successMessage={successMessage}
            serverError={serverError}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Daftar Tenant</CardTitle>
              <CardDescription>Seluruh tenant yang terdaftar aktif dalam sistem.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau subdomain..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TenantTable tenants={data?.data ?? []} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
