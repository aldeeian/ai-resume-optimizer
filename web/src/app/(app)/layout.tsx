import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { FileText } from "lucide-react";

import { SidebarNav } from "@/components/layout/sidebar-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar: icon rail on mobile, full labels on lg+ */}
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col border-r bg-card lg:w-60">
        <div className="flex h-16 items-center justify-center border-b px-3 lg:justify-start">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-primary" aria-hidden />
            <span className="hidden lg:inline">ResumeForge</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <UserButton
            appearance={{ elements: { avatarBox: "h-9 w-9" } }}
            afterSignOutUrl="/"
          />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
