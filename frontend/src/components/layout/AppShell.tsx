import { LayoutDashboard, Menu, Plus, Radar } from "lucide-react"
import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router"
import { ThemeToggle } from "./ThemeToggle"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useProfiles } from "@/hooks/useProfiles"
import type { ProfileWithStats } from "@/types"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profiles/new", label: "New Profile", icon: Plus },
]

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-[9px] bg-linear-to-br from-[#7b5bff] to-[#5a2fe0]">
        <Radar className="size-4 text-white" />
      </div>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">AI Visibility</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground/80 uppercase">
      {children}
    </div>
  )
}

function NavItem({
  to, active, onNavigate, children,
}: { to: string; active: boolean; onNavigate?: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex w-full items-center gap-3 rounded-[9px] border border-transparent px-2.5 py-2 text-[13.5px] transition-colors",
        active
          ? "border-accent-border bg-accent font-medium text-foreground"
          : "text-secondary-foreground/80 hover:bg-muted",
      )}
    >
      {children}
    </Link>
  )
}

/** Shared sidebar body — rendered in the desktop rail and the mobile drawer. */
function SidebarNav({
  pathname, profiles, onNavigate,
}: { pathname: string; profiles: ProfileWithStats[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
      <div className="flex items-center justify-between px-2 pb-2">
        <BrandMark />
        <ThemeToggle />
      </div>

      <SectionLabel>Navigation</SectionLabel>
      <nav className="flex flex-col gap-0.5">
        {NAV.map(item => (
          <NavItem key={item.to} to={item.to} active={pathname === item.to} onNavigate={onNavigate}>
            <item.icon className="size-4 shrink-0 opacity-70" />
            {item.label}
          </NavItem>
        ))}
      </nav>

      {profiles.length > 0 && (
        <>
          <SectionLabel>Profiles</SectionLabel>
          <nav className="flex flex-col gap-0.5">
            {profiles.map(p => {
              const active = pathname === `/profiles/${p.profile_uuid}`
              return (
                <NavItem
                  key={p.profile_uuid}
                  to={`/profiles/${p.profile_uuid}`}
                  active={active}
                  onNavigate={onNavigate}
                >
                  <span
                    className={cn(
                      "size-4 shrink-0 rounded-full border-2",
                      active ? "border-primary" : "border-muted-foreground/40",
                    )}
                  />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
                </NavItem>
              )
            })}
          </nav>
        </>
      )}
    </div>
  )
}

const SIDEBAR_PROFILES = 5

export function AppShell() {
  const { pathname } = useLocation()
  const { data } = useProfiles()
  // Sidebar shows only the most recently run profiles (never-run ones sort
  // last) — the full list lives on the paginated dashboard.
  const profiles = [...(data?.items ?? [])]
    .sort((a, b) => (b.last_run_at ?? "").localeCompare(a.last_run_at ?? ""))
    .slice(0, SIDEBAR_PROFILES)
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Mobile top bar with hamburger */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden">
        <BrandMark />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Open menu"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-secondary-foreground hover:bg-muted"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-[260px] p-0">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <SidebarNav pathname={pathname} profiles={profiles} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarNav pathname={pathname} profiles={profiles} />
      </aside>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-4 pb-16 sm:px-6 lg:px-8 lg:pt-6">
        <Outlet />
      </main>
    </div>
  )
}
