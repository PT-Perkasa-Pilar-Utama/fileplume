import {
  type CategoryNameBody,
  type CategoryView,
  categoryNameBody,
  ERROR_MESSAGES,
} from "@archiva/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Plus } from "lucide-react";
import { type FormEvent, type JSX, useMemo, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Label } from "../../components/ui/label.tsx";
import { ApiError } from "../../lib/api.ts";
import { createCategoryRequest, fetchCategories } from "./api.ts";
import { CategoryCard } from "./internal/category-card.tsx";

export const CATEGORIES_QUERY_KEY = ["categories"] as const;

export function PermissionCategoryView(): JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCategories, setCreatedCategories] = useState<CategoryView[]>([]);

  const categoriesQuery = useQuery({
    queryKey: [...CATEGORIES_QUERY_KEY, { q: search, page }],
    queryFn: () => fetchCategories({ q: search || undefined, page }),
  });

  const createMutation = useMutation({
    mutationFn: (input: CategoryNameBody) => createCategoryRequest(input),
    onSuccess: (created) => {
      setCreatedCategories((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setName("");
      setFormError(null);
      setDialogOpen(false);
      setSearch("");
      setPage(1);
      setSuccess(true);
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (error: unknown) => {
      setFormError(error instanceof ApiError ? error.message : ERROR_MESSAGES.INTERNAL_ERROR);
    },
  });

  const handleDialogChange = (open: boolean): void => {
    if (!open && createMutation.isPending) return;
    setDialogOpen(open);
    if (!open) {
      setName("");
      setFormError(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = categoryNameBody.safeParse({ name });
    if (!parsed.success) {
      setFormError(ERROR_MESSAGES.VALIDATION_ERROR);
      return;
    }
    setFormError(null);
    setSuccess(false);
    createMutation.mutate(parsed.data);
  };

  // api-specs/06-categories.md 6.2: order reserved system row (Uncategorized) last
  const categories = useMemo(() => {
    const raw = categoriesQuery.data?.data ?? [];
    const displayedIds = new Set(raw.map((item) => item.id));
    const pending =
      page === 1 && !search ? createdCategories.filter((item) => !displayedIds.has(item.id)) : [];
    return [...pending, ...raw].sort((a, b) => Number(a.isSystem) - Number(b.isSystem));
  }, [categoriesQuery.data?.data, createdCategories, page, search]);

  const totalPages = categoriesQuery.data?.meta.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold uppercase tracking-normal text-brand-title">
          PERMISSION CATEGORY
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize system privileges and access controls into structured categories
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Input
            aria-label="Cari kategori"
            placeholder="Cari kategori..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pr-9"
          />
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        <Button type="button" size="lg" onClick={() => handleDialogChange(true)}>
          <Plus />
          Tambah Kategori
        </Button>
      </div>

      {success && (
        <Alert variant="success" role="status" data-testid="category-success-alert">
          <CheckCircle2 className="size-4" />
          <AlertDescription>Kategori berhasil ditambahkan</AlertDescription>
        </Alert>
      )}

      {categoriesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat kategori...</p>
      ) : categoriesQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {categoriesQuery.error instanceof ApiError
            ? categoriesQuery.error.message
            : ERROR_MESSAGES.INTERNAL_ERROR}
        </p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada kategori.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Kategori</DialogTitle>
            <DialogDescription>Tambahkan kategori untuk dokumen tenant.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="category-name">Nama Kategori</Label>
              <Input
                id="category-name"
                placeholder="Masukkan nama kategori"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                disabled={createMutation.isPending}
                aria-invalid={formError !== null}
                aria-describedby={formError ? "category-name-error" : undefined}
              />
              {formError && (
                <p id="category-name-error" role="alert" className="text-xs text-destructive">
                  {formError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createMutation.isPending}
                onClick={() => handleDialogChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
