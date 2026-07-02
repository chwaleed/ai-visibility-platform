import { LayoutDashboard, Plus, Radar } from "lucide-react"
import { Link, Outlet, useLocation } from "react-router"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./ThemeToggle"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profiles/new", label: "New Profile", icon: Plus },
]

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Radar className="size-5 text-primary" />
            <span className="font-semibold group-data-[collapsible=icon]:hidden">
              AI Visibility
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(item => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={pathname === item.to}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
