import Link from "next/link"
import { SiteFrame } from "@/components/site-frame"

export function LegalPage({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <SiteFrame
      aside={
        <Link href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Calendar
        </Link>
      }
    >
      <article className="max-w-2xl">
        <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective November 20, 2026</p>
        <div className="mt-6 flex flex-col gap-6 text-sm leading-6">{children}</div>
      </article>
    </SiteFrame>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-xl tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
