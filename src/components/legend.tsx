export function Legend() {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-[#e4ddd2]" aria-hidden />
        Closed
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-[#d7efe2]" aria-hidden />
        Open, seats left
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-[#f6d9d4]" aria-hidden />
        Full, game confirmed
      </li>
    </ul>
  )
}
