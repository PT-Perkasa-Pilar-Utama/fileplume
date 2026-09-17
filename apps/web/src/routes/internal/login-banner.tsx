import { FileArchive, FileCode, FileSpreadsheet, FileText } from "lucide-react";
import type { JSX } from "react";
import { ArchivaLogoIcon } from "./archiva-logo.tsx";

export function LoginBanner(): JSX.Element {
  return (
    <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-linear-to-br from-banner-from to-banner-to p-12 text-white lg:flex">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative flex size-112 items-center justify-center">
          {/* Concentric rings */}
          <div className="absolute size-112 rounded-full border border-white/15" />
          <div className="absolute size-80 rounded-full border border-white/20" />
          <div className="absolute size-48 rounded-full border border-white/25" />

          {/* Floating document badges matching Figma */}
          <div className="absolute top-12 left-8 flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-emerald-200 text-xs backdrop-blur-xs">
            <FileSpreadsheet className="size-3.5" />
            <span>XLSX</span>
          </div>
          <div className="absolute top-8 right-16 flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1 text-amber-200 text-xs backdrop-blur-xs">
            <FileArchive className="size-3.5" />
            <span>ZIP</span>
          </div>
          <div className="absolute bottom-20 left-12 flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/20 px-3 py-1 text-rose-200 text-xs backdrop-blur-xs">
            <FileText className="size-3.5" />
            <span>PDF</span>
          </div>
          <div className="absolute right-10 bottom-12 flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-purple-200 text-xs backdrop-blur-xs">
            <FileCode className="size-3.5" />
            <span>DOCX</span>
          </div>

          {/* Center icon badge */}
          <div className="relative z-10 flex size-16 items-center justify-center rounded-full bg-white shadow-xl">
            <ArchivaLogoIcon className="h-7 w-auto" />
          </div>
        </div>
      </div>

      {/* Branding text */}
      <div className="relative z-10 max-w-md">
        <p className="font-normal text-base text-blue-100">Welcome to,</p>
        <h2 className="my-1 font-bold text-5xl text-white tracking-tight">ARCHIVA</h2>
        <p className="text-blue-100/80 text-sm leading-relaxed">
          ARCHIVA is Document Management Systems
          <br />
          made by Perkasa Pilar Utama
        </p>
      </div>
    </div>
  );
}
