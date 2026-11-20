import { Suspense } from "react"
import Link from "next/link"
import { AuthForm } from "@/components/auth-form"
import { SiteFrame } from "@/components/site-frame"
import { oauthErrorMessage } from "@/lib/account-linking"
import { isGoogleEnabled } from "@/lib/auth"
import { firstQueryValue, safeNextPath } from "@/lib/paths"

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <SiteFrame
      aside={
        <Link href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Calendar
        </Link>
      }
    >
      <Suspense fallback={<div className="mx-auto h-80 max-w-sm rounded-2xl bg-card" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </SiteFrame>
  )
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const nextPath = safeNextPath(firstQueryValue(params.next))
  return (
    <AuthForm
      googleEnabled={isGoogleEnabled()}
      nextPath={nextPath}
      oauthError={oauthErrorMessage(firstQueryValue(params.error))}
    />
  )
}
