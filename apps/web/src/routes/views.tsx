import type { UploadBatch } from "@archiva/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText } from "lucide-react";
import { type JSX, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.tsx";
import {
  getAcceptedFileTypeByName,
  type TrayItem,
  type UploadedDocumentDisplay,
  UploadedDocumentsList,
  UploadTray,
  type UploadTrayProps,
} from "../features/documents/index.ts";
import { TenantManagement } from "../features/tenants/tenant-management.tsx";

// SCAFFOLD: uploaderName and createdAt are placeholders until the real
// document list lands in FE-S2-03 (api-specs/05-documents.md 5.1).
const PLACEHOLDER_UPLOADER = "Member Team";
const PLACEHOLDER_UPLOAD_DATE = "Hari ini";

export interface DashboardViewProps {
  readonly uploader?: UploadTrayProps["uploader"];
}

export function DashboardView({ uploader }: DashboardViewProps = {}): JSX.Element {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocumentDisplay[]>([]);

  const handleUploadSettled = (_batch: UploadBatch, acceptedItems: readonly TrayItem[]): void => {
    const acceptedDocs: UploadedDocumentDisplay[] = [];
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
        uploaderName: PLACEHOLDER_UPLOADER,
        createdAt: PLACEHOLDER_UPLOAD_DATE,
      });
    }

    if (acceptedDocs.length > 0) {
      setUploadedDocs((prev) => [...acceptedDocs, ...prev]);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <UploadTray onUploadSettled={handleUploadSettled} uploader={uploader} />
      <UploadedDocumentsList documents={uploadedDocs} />
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
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dokumen yang diunggah akan muncul di sini setelah diproses.
          </p>
          <div className="pt-1">
            <Link
              to="/documents/$id"
              params={{ id: "0f8c1a1e-4d2b-4c31-9f0e-2a6b7c8d9e01" }}
              data-testid="demo-document-detail-link"
              className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-2xs hover:bg-muted/50 hover:border-primary/50 transition-colors"
            >
              <FileText className="size-4 text-primary" />
              <span>Buka Demo Detail Dokumen (kontrak-kerjasama.pdf)</span>
              <ArrowRight className="size-4 text-muted-foreground ml-1" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// FE-S2-04 implements document detail shell, metadata, extracted fields stub, and version picker.
export { DocumentDetailView } from "../features/documents/document-detail-view.tsx";

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
