import { FileArchive, FileCode, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { ArchivaLogoIcon } from "./archiva-logo.tsx";

interface OrbitBadge {
  Icon: LucideIcon;
  angle: number;
  radius: number;
  iconClassName: string;
  label: string;
}

const ORBIT_BADGES: OrbitBadge[] = [
  {
    Icon: FileArchive,
    angle: -50,
    radius: 208,
    iconClassName: "text-orange-600",
    label: "Archive document",
  },
  { Icon: FileText, angle: 0, radius: 152, iconClassName: "text-rose-600", label: "Text document" },
  {
    Icon: FileCode,
    angle: 52,
    radius: 208,
    iconClassName: "text-purple-600",
    label: "Code document",
  },
  { Icon: FileText, angle: 48, radius: 96, iconClassName: "text-blue-600", label: "Text document" },
  {
    Icon: FileSpreadsheet,
    angle: 90,
    radius: 160,
    iconClassName: "text-emerald-600",
    label: "Spreadsheet document",
  },
  {
    Icon: FileArchive,
    angle: 138,
    radius: 208,
    iconClassName: "text-orange-600",
    label: "Archive document",
  },
  {
    Icon: FileText,
    angle: 180,
    radius: 96,
    iconClassName: "text-rose-600",
    label: "Text document",
  },
  {
    Icon: FileSpreadsheet,
    angle: 215,
    radius: 208,
    iconClassName: "text-emerald-600",
    label: "Spreadsheet document",
  },
  {
    Icon: FileText,
    angle: 270,
    radius: 160,
    iconClassName: "text-blue-600",
    label: "Text document",
  },
];

function OrbitNode({ badge }: { badge: OrbitBadge }): JSX.Element {
  const { Icon, angle, radius, iconClassName, label } = badge;
  const style: CSSProperties = {
    transform: `rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`,
  };
  return (
    <div className="absolute top-1/2 left-1/2 -mt-6 -ml-6" style={style}>
      <div
        role="img"
        aria-label={label}
        className="flex size-12 items-center justify-center rounded-full bg-white/85 shadow-lg backdrop-blur-sm"
      >
        <Icon className={`size-5 ${iconClassName}`} />
      </div>
    </div>
  );
}

export function LoginBanner(): JSX.Element {
  return (
    <div className="hidden flex-1 bg-background p-4 lg:flex">
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden p-12 text-white">
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="login-folder-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="hsl(var(--banner-from))" />
              <stop offset="1" stopColor="hsl(var(--banner-to))" />
            </linearGradient>
          </defs>
          <path
            fill="url(#login-folder-bg)"
            d="M 0 144 Q 0 80 64 80 H 96 Q 128 80 128 48 Q 128 16 160 16 H 968 Q 1000 16 1000 48 V 864 Q 1000 912 952 912 H 888 Q 856 912 856 944 Q 856 976 824 976 H 48 Q 0 976 0 928 Z"
          />
        </svg>

        <div className="relative flex flex-1 items-center justify-center" aria-hidden="true">
          <div className="relative flex size-112 items-center justify-center">
            <div className="absolute size-112 rounded-full border border-white/20" />
            <div className="absolute size-80 rounded-full border border-white/20" />
            <div className="absolute size-48 rounded-full border border-white/25" />
            {ORBIT_BADGES.map((badge) => (
              <OrbitNode key={`${badge.angle}-${badge.radius}`} badge={badge} />
            ))}
            <div className="relative z-10 flex size-16 items-center justify-center rounded-full bg-white shadow-xl">
              <ArchivaLogoIcon className="h-7 w-auto" />
            </div>
          </div>
        </div>

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
    </div>
  );
}
