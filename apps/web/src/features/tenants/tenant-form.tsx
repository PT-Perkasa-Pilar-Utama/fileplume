import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleX, PlusCircle } from "lucide-react";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Label } from "../../components/ui/label.tsx";
import { type CreateTenantFormInput, createTenantFormSchema } from "./types.ts";

export interface TenantFormProps {
  onSubmit: (values: CreateTenantFormInput) => Promise<void>;
  isSubmitting?: boolean;
  successMessage?: string | null;
  serverError?: string | null;
}

export function TenantForm({
  onSubmit,
  isSubmitting = false,
  successMessage,
  serverError,
}: TenantFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTenantFormInput>({
    resolver: zodResolver(createTenantFormSchema),
    defaultValues: {
      name: "",
      subdomain: "",
    },
  });

  const handleFormSubmit = async (values: CreateTenantFormInput): Promise<void> => {
    await onSubmit(values);
    reset();
  };

  return (
    <div className="space-y-4">
      {successMessage ? (
        <Alert variant="success" data-testid="tenant-success-alert">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {serverError ? (
        <Alert variant="destructive" data-testid="tenant-error-alert">
          <CircleX className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nama Organisasi</Label>
            <Input
              id="tenant-name"
              placeholder="PT Contoh Baru"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name ? <p className="text-destructive text-xs">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tenant-subdomain"
                placeholder="contohbaru"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.subdomain)}
                className="font-mono text-sm"
                {...register("subdomain")}
              />
              <span className="text-muted-foreground text-sm">.archiva.id</span>
            </div>
            {errors.subdomain ? (
              <p className="text-destructive text-xs">{errors.subdomain.message}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                3-63 karakter alfanumerik huruf kecil dan tanda hubung
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <PlusCircle className="size-4" />
            <span>{isSubmitting ? "Menyimpan..." : "Simpan"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
