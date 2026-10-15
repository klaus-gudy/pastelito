import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { PageTitle } from "@/components/dashboard/page-title"
import { SignInIntro } from "@/components/sign-in-intro"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { prisma } from "@/lib/prisma"
import { SIGN_IN_INTRO_COOKIE } from "@/lib/sign-in-intro"

// Layouts don't re-run on every navigation, so pages that load private data
// must still check the session themselves.
export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const session = await auth()
  if (!session?.user?.id) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  })
  if (!user) redirect("/sign-in")

  const cookieStore = await cookies()
  // The sidebar stores its open/collapsed state in this cookie.
  const sidebarState = cookieStore.get("sidebar_state")?.value
  // Rendered on the server, so the dashboard never shows before the intro.
  const showIntro = cookieStore.has(SIGN_IN_INTRO_COOKIE)

  return (
    <SidebarProvider defaultOpen={sidebarState !== "false"}>
      <AppSidebar
        user={{ name: user.name, email: user.email, image: user.image }}
      />
      {/* min-w-0 lets wide tables scroll inside their box instead of
          widening the page. */}
      <SidebarInset className="min-w-0">
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
        {/* Tables switch to cards by this box's width, not the screen's, so an
            open sidebar on a tablet still gets cards. */}
        <div className="@container/main flex flex-1 flex-col p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
      {showIntro && <SignInIntro />}
    </SidebarProvider>
  )
}
