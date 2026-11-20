import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export function MonthPager({
  label,
  prevHref,
  nextHref,
}: {
  label: string
  prevHref: string
  nextHref: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <Link
        href={prevHref}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label="Previous month"
      >
        Previous
      </Link>
      <h2 className="font-heading text-center text-2xl tracking-tight sm:text-3xl">{label}</h2>
      <Link
        href={nextHref}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label="Next month"
      >
        Next
      </Link>
    </div>
  )
}
