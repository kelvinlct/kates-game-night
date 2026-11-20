import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl gap-4 px-4 pb-8 text-sm text-muted-foreground sm:px-6">
      <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
        Terms
      </Link>
    </footer>
  )
}
