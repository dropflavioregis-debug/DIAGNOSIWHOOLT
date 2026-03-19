import type { NavIcon } from "@/lib/nav-config";

const iconPaths: Record<NavIcon, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  battery: (
    <>
      <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M13 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="6" width="5" height="4" rx=".5" fill="currentColor" opacity=".5" />
    </>
  ),
  dtc: (
    <>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r=".75" fill="currentColor" />
    </>
  ),
  ai: (
    <>
      <path
        d="M2 12L4 9H12C12.6 9 13 8.6 13 8V4C13 3.4 12.6 3 12 3H4C3.4 3 3 3.4 3 4V8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  sessions: (
    <>
      <path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  libs: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 3V2M8 3V2M11 3V2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  device: (
    <>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  config: (
    <>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
};

export function NavIcon({ name }: { name: NavIcon }) {
  return (
    <svg className="h-[14px] w-[14px] shrink-0 opacity-60" viewBox="0 0 16 16" fill="none" aria-hidden>
      {iconPaths[name]}
    </svg>
  );
}
