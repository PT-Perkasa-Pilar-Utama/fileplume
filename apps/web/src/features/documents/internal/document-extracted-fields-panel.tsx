import type { DocumentDetailView } from "@archiva/shared";
import { Sparkles } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx";

export interface DocumentExtractedFieldsPanelProps {
  readonly document: DocumentDetailView;
}

/**
 * Extracted fields panel in document detail view (AC-38.02).
 * Stubbed region for Sprint 3 (FE-S3-04).
 */
export function DocumentExtractedFieldsPanel({
  document,
}: DocumentExtractedFieldsPanelProps): JSX.Element {
  return (
    <Card data-testid="document-extracted-fields-region" className="shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Bidang Terekstraksi</CardTitle>
        <CardDescription className="text-xs">
          Informasi yang diekstraksi secara otomatis dari isi dokumen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Tipe Dokumen</span>
          <p
            className="text-sm font-medium text-foreground"
            data-testid="extracted-field-document-type"
          >
            {document.documentType ?? "Belum teridentifikasi"}
          </p>
        </div>

        {/* SCAFFOLD: FE-S3-04 implements full AI extracted field display and inline correction */}
        <Alert
          variant="default"
          className="border-dashed bg-muted/40"
          data-testid="extracted-fields-placeholder"
        >
          <Sparkles className="size-4 text-muted-foreground shrink-0" />
          <AlertDescription className="text-xs text-muted-foreground font-normal">
            Ekstraksi bidang AI akan tersedia pada pembaruan mendatang (Sprint 3).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
