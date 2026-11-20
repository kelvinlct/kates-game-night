import Link from "next/link"

export function SiteFrame({
  aside,
  children,
}: {
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <Link href="/" className="min-w-0">
          <p className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
            Kate&apos;s Game Night
          </p>
          <p className="mt-1 text-sm text-muted-foreground">A monthly table for friends.</p>
        </Link>
        <div className="shrink-0">{aside}</div>
      </header>
      {children}
    </div>
  )
}
