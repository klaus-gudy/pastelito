import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { PageTitle } from "@/components/dashboard/page-title"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { prisma } from "@/lib/prisma"

// Layouts don't re-run on every navigation, so pages that load private data
// must still check the session themselves.
export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const session = await auth()
  if (!session?.user?.id) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, emailVerified: true },
  })
  if (!user) redirect("/sign-in")

  // The sidebar stores its open/collapsed state in this cookie.
  const sidebarState = (await cookies()).get("sidebar_state")?.value

  return (
    <SidebarProvider defaultOpen={sidebarState !== "false"}>
      <AppSidebar
        user={{ name: user.name, email: user.email, image: user.image }}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-center"
          />
          <PageTitle />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        {!user.emailVerified && (
          <div className="px-4 pt-4 md:px-6">
            <VerifyEmailBanner email={user.email} />
          </div>
        )}
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
