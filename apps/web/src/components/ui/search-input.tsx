import { Search } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type JSX } from "react";
import { cn } from "../../lib/cn.ts";
import { Input } from "./input.tsx";

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconPosition?: "leading" | "trailing";
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, iconPosition = "leading", ...props }, ref): JSX.Element => {
    return (
      <div className="relative w-full">
        {iconPosition === "leading" ? (
          <>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={ref} className={cn("pl-9", className)} {...props} />
          </>
        ) : (
          <>
            <Input ref={ref} className={cn("pr-9", className)} {...props} />
            <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </>
        )}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";
