import DashboardSidebar from '@/components/dashboard/DashboardSidebar'

// A nested layout must not render <html>/<body> or a second ClerkProvider;
// the root layout in app/layout.tsx already owns both.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
