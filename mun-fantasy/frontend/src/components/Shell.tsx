import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { GUC_MUN_HEADER_SRC } from "@/lib/gucLogos";
import { useAuthStore } from "../store/authStore";
import { disconnectSocket } from "../lib/socket";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-lg px-3 py-2 text-sm",
    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

type NavItem = { to: string; label: string; roles: ("all" | "admin" | "coordinator")[] };

const NAV_ITEMS: NavItem[] = [
  { to: "/market", label: "Market", roles: ["all"] },
  { to: "/builder", label: "Builder", roles: ["all"] },
  { to: "/my-team", label: "My Team", roles: ["all"] },
  { to: "/leaderboard", label: "Leaderboard", roles: ["all"] },
  { to: "/live", label: "Live", roles: ["all"] },
  { to: "/admin", label: "Admin", roles: ["admin"] },
  { to: "/coordinator", label: "Coordinator", roles: ["coordinator"] },
];

export function Shell() {
  const { email, isAdmin, isCoordinator, logout } = useAuthStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const visibleItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.roles.includes("all")) return true;
        if (item.roles.includes("admin") && isAdmin) return true;
        if (item.roles.includes("coordinator") && isCoordinator) return true;
        return false;
      }),
    [isAdmin, isCoordinator],
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-950 to-pitch-950">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 text-white md:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="block h-0.5 w-5 rounded bg-white" />
              <span className="block h-0.5 w-5 rounded bg-white" />
              <span className="block h-0.5 w-5 rounded bg-white" />
            </button>
            <img
              src={GUC_MUN_HEADER_SRC}
              alt="GUC MUN"
              className="h-9 w-auto max-w-[min(200px,42vw)] shrink-0 object-contain object-left md:h-10 md:max-w-[220px]"
            />
            <Link to="/" className="min-w-0 truncate font-semibold tracking-tight text-white hover:text-white/90">
              MUN Fantasy League
            </Link>
          </div>

          <nav className="hidden flex-wrap items-center gap-1 md:flex">
            {visibleItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden max-w-[200px] truncate text-xs text-slate-400 lg:block">{email}</div>
            <button
              type="button"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              onClick={() => {
                disconnectSocket();
                logout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(88vw,320px)] flex-col border-r border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
            <div className="mb-4 text-xs text-slate-400">{email}</div>
            <div className="flex flex-col gap-1">
              {visibleItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
