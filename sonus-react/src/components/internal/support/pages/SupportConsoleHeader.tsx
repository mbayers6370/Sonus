import {
  BookUser,
  FileText,
  Gauge,
  Home,
  LogOut,
  TextSearch,
  UserRoundSearch,
} from "lucide-react";

type ViewMode =
  | "dashboard"
  | "ops"
  | "metrics-support"
  | "metrics-learning"
  | "metrics-impact"
  | "quality-reports";

type SupportConsoleHeaderProps = {
  iconButtonBase: string;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  viewMode: ViewMode;
};

export default function SupportConsoleHeader({
  iconButtonBase,
  onLogout,
  onNavigate,
  viewMode,
}: SupportConsoleHeaderProps) {
  return (
    <>
      <section className="fixed inset-x-0 top-0 z-[110] w-full border-b border-white/20 bg-[#1f2937] px-4 py-4 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)] md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="relative flex items-center justify-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/branding/Logo_White.png"
                srcSet="/branding/Logo_White-500.png 500w, /branding/Logo_White.png 2000w"
                sizes="(max-width: 768px) 180px, 260px"
                width={2000}
                height={500}
                alt="Sonus"
                className="h-6 w-auto opacity-95 md:h-7"
                loading="eager"
              />
              <span aria-hidden="true" className="text-white/45">
                |
              </span>
              <h1 className="main-font truncate text-base font-normal text-white md:text-lg">
                Support Dashboard
              </h1>
            </div>
            <div className="absolute right-0">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white"
                onClick={onLogout}
                aria-label="Log Out"
                title="Log Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "dashboard" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onNavigate("/internal/support")}
                  aria-label="Home"
                  title="Home"
                >
                  <Home className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "ops" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onNavigate("/internal/support/users")}
                  aria-label="User Operations"
                  title="User Operations"
                >
                  <UserRoundSearch className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "metrics-support" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onNavigate("/internal/support/metrics/support")}
                  aria-label="Support Metrics"
                  title="Support Metrics"
                >
                  <TextSearch className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "metrics-learning" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onNavigate("/internal/support/metrics/learning")}
                  aria-label="Learning Metrics"
                  title="Learning Metrics"
                >
                  <BookUser className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "metrics-impact" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onNavigate("/internal/support/metrics/impact-outcomes")}
                  aria-label="Impact and Outcomes"
                  title="Impact and Outcomes"
                >
                  <Gauge className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "quality-reports" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onNavigate("/internal/support/quality-reports")}
                  aria-label="Quality Reports"
                  title="Quality Reports"
                >
                  <FileText className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div aria-hidden="true" className="h-[100px] md:h-[95px]" />
    </>
  );
}

