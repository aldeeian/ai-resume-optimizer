"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileSearch,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/jobs", label: "Job Descriptions", icon: FileSearch },
  { href: "/optimize", label: "Optimize", icon: Wand2 },
  { href: "/generated", label: "Generated Resumes", icon: Sparkles },
  { href: "/interview", label: "Mock Interview", icon: MessagesSquare },
  { href: "/tracker", label: "Tracker", icon: KanbanSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

const bottomItems = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col justify-between p-3"
    >
      <div className="space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>
      <div className="space-y-1">
        {bottomItems.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
  );
}
