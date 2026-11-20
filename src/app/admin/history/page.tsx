import { Suspense } from "react"
import { connection } from "next/server"
import Link from "next/link"
import { HeaderAuth } from "@/components/header-auth"
import { SiteFrame } from "@/components/site-frame"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HISTORY_LIMIT } from "@/lib/history"
import { listBookingHistory } from "@/server/queries"
import { requireAdmin } from "@/server/session"

export default function HistoryPage() {
  return (
    <SiteFrame
      aside={
        <Suspense fallback={<div className="h-8 w-24 rounded-lg bg-muted" />}>
          <HeaderAuth />
        </Suspense>
      }
    >
      <Suspense fallback={<div className="h-96 rounded-2xl bg-card ring-1 ring-foreground/10" />}>
        <HistoryContent />
      </Suspense>
    </SiteFrame>
  )
}

async function HistoryContent() {
  await connection()
  await requireAdmin("/admin/history")
  const events = await listBookingHistory()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Joins and removals, newest first.
            {events.length === HISTORY_LIMIT ? ` Showing the latest ${HISTORY_LIMIT}.` : ""}
          </p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to admin
        </Link>
      </div>
      <div className="rounded-2xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Night</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No one has joined or left yet.
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">{event.when}</TableCell>
                  <TableCell>{event.who}</TableCell>
                  <TableCell>{event.action}</TableCell>
                  <TableCell className="whitespace-nowrap">{event.night}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
