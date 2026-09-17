import type { JSX } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card.tsx";

// SCAFFOLD: Placeholder shell; real dashboard metrics and flows wired in FE-S1-05 & FE-S5-01.
export function DashboardView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Sistem</CardTitle>
          <CardDescription>Selamat datang di platform Archiva</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Kelola dokumen, kategori, dan izin akses melalui menu navigasi di samping.
          </p>
        </CardContent>
      </Card>
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

// SCAFFOLD: FE-S4-01 implements tenant configuration editing and parameter resets.
export function ConfigurationView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Konfigurasi</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Tenant</CardTitle>
          <CardDescription>Konfigurasi parameter sistem</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Parameter sistem tenant.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// SCAFFOLD: FE-S1-04 implements Super Admin tenant list and create tenant form.
export function TenantManagementView(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Manajemen Tenant</h1>
      <Card>
        <CardHeader>
          <CardTitle>Daftar Tenant</CardTitle>
          <CardDescription>Pengelolaan organisasi dan tenant terdaftar</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Panel pengelolaan tenant untuk Super Admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function NotFoundView(): JSX.Element {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <h2 className="text-3xl font-bold tracking-tight">404</h2>
      <p className="text-muted-foreground">Halaman tidak ditemukan</p>
    </div>
  );
}
