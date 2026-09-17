import type { JSX } from "react";

export function ArchivaLogoIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      width="46"
      height="40"
      viewBox="0 0 46 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M46 33L41.3939 25H33.7552C28.7431 25 24.5053 28.7103 23.8429 33.6784L23 40H33L34.4415 36.6365C35.387 34.4304 37.5562 33 39.9564 33H46Z"
        fill="#C82327"
      />
      <path
        d="M4.60608 25L18.9999 0H23L22.6032 9.52405C22.2608 17.7406 15.7455 24.3596 7.53539 24.8316L4.60608 25Z"
        fill="#104D9C"
      />
      <path
        d="M41.3939 25L27.0001 0H23L23.3968 9.52405C23.7392 17.7406 30.2545 24.3596 38.4646 24.8316L41.3939 25Z"
        fill="#458D3A"
      />
    </svg>
  );
}
