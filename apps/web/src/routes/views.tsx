import type { UploadBatch } from "@archiva/shared";
import { useQueryClient } from "@tanstack/react-query";
import { type JSX, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.tsx";
import { useAuthStore } from "../features/auth/auth-store.ts";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENTS_QUERY_KEY,
  DocumentCardGridView,
  getAcceptedFileTypeByName,
  type TrayItem,
  type UploadedDocumentDisplay,
  UploadTray,
  type UploadTrayProps,
  useDocuments,
} from "../features/documents/index.ts";
import { TenantManagement } from "../features/tenants/tenant-management.tsx";
import { cn } from "../lib/cn.ts";

export interface DashboardViewProps {
  readonly uploader?: UploadTrayProps["uploader"];
  readonly initialDocuments?: readonly UploadedDocumentDisplay[];
}

export function DashboardView({
  uploader,
  initialDocuments = [],
}: DashboardViewProps = {}): JSX.Element {
  const queryClient = useQueryClient();
  const documentsQuery = useDocuments();
  const uploaderName = useAuthStore((state) => state.principal?.user.name);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocumentDisplay[]>([
    ...initialDocuments,
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [docCategories, setDocCategories] = useState<Record<string, string>>({});

  const handleUploadSettled = (_batch: UploadBatch, acceptedItems: readonly TrayItem[]): void => {
    const acceptedDocs: UploadedDocumentDisplay[] = [];
    const uploadedAt = new Date().toISOString();
    for (const item of acceptedItems) {
      if (!item.document) continue;
      const fileType = getAcceptedFileTypeByName(item.document.title) ?? "other";

      acceptedDocs.push({
        id: item.document.id,
        title: item.document.title,
        fileType,
        sizeBytes: item.sizeBytes,
        processingState: item.document.processingState,
        processingLabel: item.document.processingLabel,
        uploaderName,
        createdAt: uploadedAt,
      });
    }

    if (acceptedDocs.length > 0) {
      setUploadedDocs((prev) => [...acceptedDocs, ...prev]);
    }

    // Invalidate document collection query so newly uploaded documents appear
    // from the server list (AC-01.02).
    queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
  };

  // Merge server documents with freshly uploaded items in local state.
  const displayDocuments = useMemo(() => {
    const serverDocs = documentsQuery.data?.data ?? [];
    if (serverDocs.length === 0 && uploadedDocs.length === 0) {
      return [];
    }

    const serverIds = new Set(serverDocs.map((doc) => doc.id));
    const pendingUploads = uploadedDocs.filter((doc) => !serverIds.has(doc.id));
    return [...pendingUploads, ...serverDocs];
  }, [documentsQuery.data?.data, uploadedDocs]);

  const filteredDocuments = useMemo(() => {
    if (!selectedCategory) return displayDocuments;
    return displayDocuments.filter((doc) => {
      const cat =
        docCategories[doc.id] ??
        ("category" in doc && doc.category?.name
          ? doc.category.name
          : "categoryName" in doc && doc.categoryName
            ? doc.categoryName
            : null);
      return cat === selectedCategory;
    });
  }, [displayDocuments, selectedCategory, docCategories]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Dashboard</h1>
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex w-full flex-col lg:col-span-4">
          <UploadTray
            className="flex-1"
            onUploadSettled={handleUploadSettled}
            uploader={uploader}
          />
        </div>
        <div className="flex w-full flex-col lg:col-span-8">
          <section
            aria-labelledby="uploaded-document-heading"
            className="flex flex-1 flex-col rounded-xl border border-border bg-card p-6 shadow-xs space-y-4 min-h-96"
          >
            <div className="flex flex-col space-y-1">
              <h2
                id="uploaded-document-heading"
                className="text-base font-medium text-foreground"
                aria-label="Dokumen Terunggah"
              >
                UPLOADED DOCUMENT
                <span className="sr-only">Dokumen Terunggah</span>
              </h2>
              <p className="text-sm font-normal text-muted-foreground">
                Repository of uploaded files and records for quick access and verification.
                <span className="sr-only">
                  Repositori file dan catatan yang diunggah untuk akses dan verifikasi cepat.
                </span>
              </p>
            </div>

            {displayDocuments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-sm font-normal text-foreground">Category :</span>
                {DOCUMENT_CATEGORIES.map((category) => {
                  const isSelected = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(isSelected ? null : category)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-normal transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      )}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredDocuments.length === 0 && displayDocuments.length > 0 ? (
              <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-muted-foreground">
                Tidak ada dokumen dalam kategori ini.
              </div>
            ) : (
              <DocumentCardGridView
                documents={filteredDocuments}
                isLoading={documentsQuery.isLoading && displayDocuments.length === 0}
                isError={documentsQuery.isError && displayDocuments.length === 0}
                errorMessage={documentsQuery.error?.message}
                emptyMessage={documentsQuery.data?.meta?.message}
                docCategories={docCategories}
                onCategoryChange={(id, cat) => setDocCategories((prev) => ({ ...prev, [id]: cat }))}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// SCAFFOLD: FE-S2-06 implements document listing, search, and pagination.
export function DocumentsView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dokumen</h1>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Dokumen</CardTitle>
          <CardDescription>Semua dokumen dalam tenant Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dokumen yang diunggah akan muncul di sini setelah diproses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// SCAFFOLD: FE-S2-06 implements document detail, metadata inspector, and preview.
export function DocumentDetailView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Detail Dokumen</h1>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Dokumen</CardTitle>
          <CardDescription>Metadata dan pratinjau dokumen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Detail dokumen sedang dimuat...</p>
        </CardContent>
      </Card>
    </div>
  );
}

// SCAFFOLD: FE-S3-01 implements category management and download permissions.
export function PermissionCategoryView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Kategori & Izin</h1>
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Kategori</CardTitle>
          <CardDescription>Atur kategori dan izin unduh dokumen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Daftar kategori tenant Anda.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// SCAFFOLD: FE-S5-04 implements activity audit trail table and filters.
export function AuditTrailView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Aktivitas</CardTitle>
          <CardDescription>Catatan seluruh aktivitas pengguna dalam sistem</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Log audit aktivitas tenant.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// SCAFFOLD: FE-S5-03 implements analytics charts and classification summaries.
export function AnalyticsView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Analitik</h1>
      <Card>
        <CardHeader>
          <CardTitle>Statistik Penggunaan</CardTitle>
          <CardDescription>Statistik dokumen dan klasifikasi</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Data analitik tenant.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export { ConfigurationView } from "../features/configuration/configuration-view.tsx";

// FE-S1-04 implements Super Admin tenant list and create tenant form.
export function TenantManagementView(): JSX.Element {
  return <TenantManagement />;
}

export function NotFoundView(): JSX.Element {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <h2 className="text-3xl font-bold tracking-tight">404</h2>
      <p className="text-muted-foreground">Halaman tidak ditemukan</p>
    </div>
  );
}
