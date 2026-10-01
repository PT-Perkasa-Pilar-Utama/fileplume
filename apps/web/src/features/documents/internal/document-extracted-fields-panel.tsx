import type { DocumentDetailView } from "@archiva/shared";
import { Sparkles } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card.tsx";

export interface DocumentExtractedFieldsPanelProps {
  readonly document: DocumentDetailView;
}

/**
 * Extracted fields panel in document detail view (AC-38.02).
 * Stubbed region for Sprint 3 (FE-S3-07), styled after Figma screen 28:3451.
 */
export function DocumentExtractedFieldsPanel({
  document,
}: DocumentExtractedFieldsPanelProps): JSX.Element {
  return (
    <Card
      data-testid="document-extracted-fields-region"
      className="shadow-xs rounded-xl border border-border bg-card"
    >
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-base font-medium tracking-wide text-foreground">
          Bidang Terekstraksi
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-4">
        <div className="flex items-center justify-between gap-4 py-2 border-b border-border/50">
          <span className="text-sm font-normal text-muted-foreground shrink-0">Tipe Dokumen</span>
          <p
            className="text-sm font-medium text-foreground text-right"
            data-testid="extracted-field-document-type"
          >
            {document.documentType ?? "Belum teridentifikasi"}
          </p>
        </div>

        {/* SCAFFOLD: FE-S3-07 renders the extracted fields and their inline correction. */}
        <Alert
          variant="default"
          className="border-dashed bg-muted/40"
          data-testid="extracted-fields-placeholder"
        >
          <Sparkles className="size-4 text-muted-foreground shrink-0" />
          <AlertDescription className="text-xs text-muted-foreground font-normal">
            Bidang terekstraksi dokumen belum tersedia.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
