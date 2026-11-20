import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { SignedInMenu } from "@/components/signed-in-menu"
import { getViewer } from "@/server/session"

export async function HeaderAuth() {
  const viewer = await getViewer()
  if (!viewer) {
    return (
      <Link href="/login" className={buttonVariants({ size: "sm" })}>
        Login
      </Link>
    )
  }
  return <SignedInMenu name={viewer.name} isAdmin={viewer.isAdmin} />
}
