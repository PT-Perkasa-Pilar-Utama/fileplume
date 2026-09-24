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
 * Stubbed region for Sprint 3 (FE-S3-04), styled after Figma screen 28:3451.
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
        <CardTitle className="text-base font-medium tracking-wide uppercase text-foreground">
          EXTRACTED FIELD
        </CardTitle>
        <CardDescription className="text-sm font-normal text-muted-foreground">
          Show your field extracted from the document
        </CardDescription>
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
