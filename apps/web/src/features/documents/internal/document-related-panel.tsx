import { FileText, Sparkles } from "lucide-react";
import type { JSX } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx";
import { cn } from "../../../lib/cn.ts";

export interface DocumentRelatedPanelProps {
  readonly className?: string;
}

/**
 * Related documents panel in document detail view.
 * Sliced after Figma screen 28:3451 (Node 28:4191).
 * Stubbed region for Sprint 4 (FE-S4-06: List related documents).
 */
export function DocumentRelatedPanel({ className }: DocumentRelatedPanelProps = {}): JSX.Element {
  return (
    <Card
      data-testid="document-related-region"
      className={cn("shadow-xs rounded-xl border border-border bg-card", className)}
    >
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-base font-medium tracking-wide uppercase text-foreground">
          RELATED DOCUMENT
        </CardTitle>
        <CardDescription className="text-sm font-normal text-muted-foreground">
          Related document based on active and document tags
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        {/* Sample related items styled identical to Figma 28:4191 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-2.5 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">bat-requirement.xlsx</p>
                <p className="text-2xs text-muted-foreground">Imam Fahrudin</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-2.5 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  technical-proposal-bat.pdf
                </p>
                <p className="text-2xs text-muted-foreground">Imam Fahrudin</p>
              </div>
            </div>
          </div>
        </div>

        {/* SCAFFOLD: FE-S4-06 wires dynamic related document listing and navigation */}
        <Alert
          variant="default"
          className="border-dashed bg-muted/30 py-2"
          data-testid="related-documents-placeholder"
        >
          <Sparkles className="size-3.5 text-muted-foreground shrink-0" />
          <AlertDescription className="text-2xs text-muted-foreground font-normal">
            Daftar dokumen terkait otomatis akan dihubungkan pada Sprint 4 (FE-S4-06).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
