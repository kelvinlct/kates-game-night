"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { WEEKDAYS } from "@/lib/dates"
import type { DirectoryUser } from "@/lib/admin-add"
import type { BookMode, DayView } from "@/lib/types"
import { MonthGrid } from "@/components/month-grid"

export interface MonthSlideData {
  key: string
  label: string
  days: DayView[]
  prevKey: string
  nextKey: string
}

const EDGE_GUARD_PX = 20
const LOCK_THRESHOLD_PX = 8

function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number)
  const total = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(total / 12)
  const nextMonth = ((total % 12) + 12) % 12
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`
}

function formatFallbackLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function SwipeableCalendar({
  prev,
  current,
  next,
  bookMode,
  viewerName,
  isAdmin,
  directory = [],
}: {
  prev: MonthSlideData
  current: MonthSlideData
  next: MonthSlideData
  bookMode: BookMode
  viewerName: string | null
  isAdmin: boolean
  directory?: DirectoryUser[]
}) {
  const [activeKey, setActiveKey] = useState(current.key)
  const [lastServerProps, setLastServerProps] = useState({ prev, current, next })
  const [monthCache, setMonthCache] = useState<Record<string, MonthSlideData>>(() => ({
    [prev.key]: prev,
    [current.key]: current,
    [next.key]: next,
  }))

  // BookingDialog 改完資料觸發 revalidatePath 時，即時將最新 SSR 資料寫入 cache
  if (
    lastServerProps.prev !== prev ||
    lastServerProps.current !== current ||
    lastServerProps.next !== next
  ) {
    setLastServerProps({ prev, current, next })
    setMonthCache((old) => ({
      ...old,
      [prev.key]: prev,
      [current.key]: current,
      [next.key]: next,
    }))
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const titleTrackRef = useRef<HTMLDivElement>(null)

  const activeKeyRef = useRef(activeKey)
  const snapTargetRef = useRef<-1 | 0 | 1 | null>(null)
  const awaitingShiftRef = useRef<-1 | 0 | 1>(0)
  const pendingAutoSnapRef = useRef<-1 | 1 | null>(null)
  const clearSnapRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef<number | null>(null)
  const cachedKeysRef = useRef<Set<string>>(new Set([prev.key, current.key, next.key]))
  const inFlightRef = useRef<Set<string>>(new Set())

  const gestureRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    baseDx: 0,
    dx: 0,
    velocity: 0,
    width: 320,
    axis: null as "x" | "y" | null,
    caughtMidSnap: false,
  })

  const snapToRef = useRef<((target: -1 | 0 | 1, releaseVelocity: number) => void) | null>(null)
  const navigateByRef = useRef<((dir: -1 | 1) => void) | null>(null)

  // 同步 cache keys 畀背景預載用
  useEffect(() => {
    for (const k of Object.keys(monthCache)) {
      cachedKeysRef.current.add(k)
    }
  }, [monthCache])

  // 靜默更新網址 + 背景並行預載前後 2 個月（±2）
  useEffect(() => {
    activeKeyRef.current = activeKey

    const targetSearch = `?month=${activeKey}`
    if (window.location.search !== targetSearch) {
      window.history.replaceState(null, "", `/${targetSearch}`)
    }

    const keysToEnsure = [
      activeKey,
      shiftMonthKey(activeKey, -1),
      shiftMonthKey(activeKey, 1),
      shiftMonthKey(activeKey, -2),
      shiftMonthKey(activeKey, 2),
    ]

    for (const key of keysToEnsure) {
      if (cachedKeysRef.current.has(key) || inFlightRef.current.has(key)) continue
      inFlightRef.current.add(key)

      fetch(`/api/month?month=${encodeURIComponent(key)}`)
        .then((res) => (res.ok ? (res.json() as Promise<MonthSlideData>) : null))
        .then((data) => {
          if (!data) return
          cachedKeysRef.current.add(data.key)
          setMonthCache((old) => ({ ...old, [data.key]: data }))
        })
        .catch(() => {})
        .finally(() => {
          inFlightRef.current.delete(key)
        })
    }
  }, [activeKey])

  // activeKey 一變，喺瀏覽器 paint 前無縫對齊 Grid 同 Title 兩條軌道（零閃爍）
  useLayoutEffect(() => {
    const track = trackRef.current
    const titleTrack = titleTrackRef.current
    if (!track || !titleTrack) return

    const gesture = gestureRef.current
    const shifted = awaitingShiftRef.current
    awaitingShiftRef.current = 0

    const setInstant = (dxPx: number) => {
      const percent = ((-1 + dxPx / gesture.width) / 3) * 100
      const transform = `translate3d(${percent}%, 0, 0)`
      track.style.transition = "none"
      track.style.transform = transform
      titleTrack.style.transition = "none"
      titleTrack.style.transform = transform
    }

    if (gesture.active) {
      // 手指中途截停緊：直接喺新座標系保持像素位置不變
      setInstant(gesture.dx)
      return
    }

    const queuedDir = pendingAutoSnapRef.current
    if (queuedDir !== null) {
      // 連續狂撳 Previous / Next 制：先定喺 carry 位，再即刻飛去下一格
      pendingAutoSnapRef.current = null
      setInstant(gesture.dx)
      void track.offsetWidth
      snapToRef.current?.(queuedDir, 0)
      return
    }

    if (shifted !== 0) {
      gesture.dx = 0
      setInstant(0)
    }
  }, [activeKey])

  // Native touch listeners + 雙軌 120fps 同步 + 支援中途截停狂掃
  useEffect(() => {
    const container = containerRef.current
    const track = trackRef.current
    const titleTrack = titleTrackRef.current
    if (!container || !track || !titleTrack) return

    const gesture = gestureRef.current

    const applyTracks = (dxPx: number, transitionCss: string) => {
      const effectiveProgress = (dxPx - awaitingShiftRef.current * gesture.width) / gesture.width
      const percent = ((-1 + effectiveProgress) / 3) * 100
      const transform = `translate3d(${percent}%, 0, 0)`
      track.style.transition = transitionCss
      track.style.transform = transform
      titleTrack.style.transition = transitionCss
      titleTrack.style.transform = transform
    }

    const armClickSuppression = () => {
      suppressClickRef.current = true
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current)
      }
      suppressTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false
        suppressTimerRef.current = null
      }, 250)
    }

    const commitMonthShift = (dir: -1 | 1) => {
      const nextKey = shiftMonthKey(activeKeyRef.current, dir)
      activeKeyRef.current = nextKey
      awaitingShiftRef.current = dir
      setActiveKey(nextKey)
    }

    const readCurrentTranslateX = (): number => {
      const style = window.getComputedStyle(track).transform
      if (!style || style === "none") return -gesture.width
      return new DOMMatrix(style).m41
    }

    const snapTo = (target: -1 | 0 | 1, releaseVelocity: number) => {
      const targetDx = target === -1 ? gesture.width : target === 1 ? -gesture.width : 0
      const remaining = Math.abs(targetDx - gesture.dx)

      const finish = () => {
        snapTargetRef.current = null
        if (target === 0) {
          gesture.dx = 0
          applyTracks(0, "none")
          return
        }
        gesture.dx = 0
        commitMonthShift(target)
      }

      snapTargetRef.current = target

      if (remaining < 1) {
        applyTracks(targetDx, "none")
        finish()
        return
      }

      const speedBoost = Math.min(Math.abs(releaseVelocity) * 120, 120)
      const duration = Math.round(
        Math.min(280, Math.max(130, (remaining / gesture.width) * 290 - speedBoost))
      )

      let settled = false
      let timer = 0

      const onEnd = (ev: TransitionEvent) => {
        if (ev.target !== track || ev.propertyName !== "transform") return
        settle()
      }

      const cleanup = () => {
        window.clearTimeout(timer)
        track.removeEventListener("transitionend", onEnd)
        if (clearSnapRef.current === cleanup) {
          clearSnapRef.current = null
        }
      }

      const settle = () => {
        if (settled) return
        settled = true
        cleanup()
        finish()
      }

      clearSnapRef.current?.()
      clearSnapRef.current = cleanup
      track.addEventListener("transitionend", onEnd)
      timer = window.setTimeout(settle, duration + 60)

      applyTracks(targetDx, `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`)
    }

    // 中途截停正在回彈緊嘅動畫（狂掃關鍵）
    const interruptRunningSnap = (): boolean => {
      const target = snapTargetRef.current
      if (target === null) return false

      const width = container.offsetWidth || 320
      gesture.width = width
      const currentX = readCurrentTranslateX()
      clearSnapRef.current?.()
      snapTargetRef.current = null

      if (target === -1 || target === 1) {
        // 預先 commit 嗰個目標月份，計返剩餘位移無縫接力
        const targetRestingX = target === -1 ? 0 : -2 * width
        const carryDx = currentX - targetRestingX
        gesture.baseDx = carryDx
        gesture.dx = carryDx
        commitMonthShift(target)
        applyTracks(carryDx, "none")
        return true
      }

      // 回彈去 0 中途被抓返
      const carryDx = currentX + width
      gesture.baseDx = carryDx
      gesture.dx = carryDx
      applyTracks(carryDx, "none")
      return true
    }

    const navigateBy = (dir: -1 | 1) => {
      gesture.width = container.offsetWidth || 320
      const target = snapTargetRef.current

      if (target !== null) {
        const currentX = readCurrentTranslateX()
        clearSnapRef.current?.()
        snapTargetRef.current = null

        if (target === -1 || target === 1) {
          const targetRestingX = target === -1 ? 0 : -2 * gesture.width
          gesture.dx = currentX - targetRestingX
          pendingAutoSnapRef.current = dir
          commitMonthShift(target)
          applyTracks(gesture.dx, "none")
          return
        }

        gesture.dx = currentX + gesture.width
        applyTracks(gesture.dx, "none")
        void track.offsetWidth
      } else {
        gesture.dx = 0
      }

      snapTo(dir, 0)
    }

    snapToRef.current = snapTo
    navigateByRef.current = navigateBy

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]

      if (touch.clientX < EDGE_GUARD_PX || touch.clientX > window.innerWidth - EDGE_GUARD_PX) {
        return
      }

      gesture.width = container.offsetWidth || 320
      const caught = interruptRunningSnap()

      gesture.active = true
      gesture.startX = touch.clientX
      gesture.startY = touch.clientY
      gesture.lastX = touch.clientX
      gesture.lastTime = performance.now()
      gesture.velocity = 0
      gesture.caughtMidSnap = caught

      if (!caught) {
        gesture.baseDx = 0
        gesture.dx = 0
        gesture.axis = null
      } else {
        gesture.axis = "x"
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!gesture.active) return

      if (e.touches.length !== 1) {
        gesture.active = false
        if (gesture.axis === "x") snapTo(0, 0)
        return
      }

      const touch = e.touches[0]
      const rawDx = touch.clientX - gesture.startX
      const rawDy = touch.clientY - gesture.startY

      if (gesture.axis === null) {
        if (Math.abs(rawDx) < LOCK_THRESHOLD_PX && Math.abs(rawDy) < LOCK_THRESHOLD_PX) return
        if (Math.abs(rawDx) > Math.abs(rawDy) * 1.1) {
          gesture.axis = "x"
        } else {
          gesture.axis = "y"
          gesture.active = false
          return
        }
      }

      if (gesture.axis === "x") {
        e.preventDefault()

        const clampedDx = Math.max(-gesture.width, Math.min(gesture.width, gesture.baseDx + rawDx))
        const now = performance.now()
        const dt = now - gesture.lastTime
        if (dt > 0) {
          const instantV = (touch.clientX - gesture.lastX) / dt
          gesture.velocity = gesture.velocity * 0.4 + instantV * 0.6
          gesture.lastX = touch.clientX
          gesture.lastTime = now
        }

        gesture.dx = clampedDx
        applyTracks(clampedDx, "none")
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!gesture.active) return
      gesture.active = false
      if (gesture.axis !== "x") return

      armClickSuppression()

      if (e.type === "touchcancel") {
        snapTo(0, 0)
        return
      }

      const fingerDelta = gesture.lastX - gesture.startX
      const releaseVelocity = performance.now() - gesture.lastTime > 80 ? 0 : gesture.velocity

      // 中途輕觸煞停、無額外拉動就順住落去啱啱嗰個月
      if (gesture.caughtMidSnap && Math.abs(fingerDelta) < 12 && Math.abs(releaseVelocity) < 0.2) {
        snapTo(0, 0)
        return
      }

      const goPrev = gesture.dx > gesture.width * 0.25 || (releaseVelocity > 0.35 && fingerDelta > 16)
      const goNext =
        gesture.dx < -gesture.width * 0.25 || (releaseVelocity < -0.35 && fingerDelta < -16)

      if (goPrev) {
        snapTo(-1, releaseVelocity)
      } else if (goNext) {
        snapTo(1, releaseVelocity)
      } else {
        snapTo(0, releaseVelocity)
      }
    }

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClickRef.current) return
      e.preventDefault()
      e.stopPropagation()
      suppressClickRef.current = false
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current)
        suppressTimerRef.current = null
      }
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true })
    container.addEventListener("touchmove", onTouchMove, { passive: false })
    container.addEventListener("touchend", onTouchEnd, { passive: true })
    container.addEventListener("touchcancel", onTouchEnd, { passive: true })
    container.addEventListener("click", onClickCapture, { capture: true })

    return () => {
      clearSnapRef.current?.()
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current)
      }
      container.removeEventListener("touchstart", onTouchStart)
      container.removeEventListener("touchmove", onTouchMove)
      container.removeEventListener("touchend", onTouchEnd)
      container.removeEventListener("touchcancel", onTouchEnd)
      container.removeEventListener("click", onClickCapture, { capture: true })
    }
  }, [])

  const prevKey = shiftMonthKey(activeKey, -1)
  const nextKey = shiftMonthKey(activeKey, 1)
  const slots = [
    { slot: -1 as const, key: prevKey, data: monthCache[prevKey] ?? null },
    { slot: 0 as const, key: activeKey, data: monthCache[activeKey] ?? null },
    { slot: 1 as const, key: nextKey, data: monthCache[nextKey] ?? null },
  ]

  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => navigateByRef.current?.(-1)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label="Previous month"
        >
          Previous
        </button>

        {/* 標題同步滑動視窗，兩邊微微 fade 唔會硬切 */}
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div
            ref={titleTrackRef}
            className="flex w-[300%] items-center will-change-transform [transform:translate3d(-33.333333%,0,0)]"
          >
            {slots.map(({ slot, key, data }) => (
              <h2
                key={key}
                aria-hidden={slot !== 0}
                className="font-heading w-1/3 shrink-0 truncate px-2 text-center text-2xl tracking-tight sm:text-3xl"
              >
                {data?.label ?? formatFallbackLabel(key)}
              </h2>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateByRef.current?.(1)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          aria-label="Next month"
        >
          Next
        </button>
      </div>

      <div ref={containerRef} className="overflow-hidden touch-pan-y select-none">
        <div
          ref={trackRef}
          className="flex w-[300%] items-start will-change-transform [transform:translate3d(-33.333333%,0,0)]"
        >
          {slots.map(({ slot, key, data }) => (
            <div key={key} className="w-1/3 shrink-0" aria-hidden={slot !== 0}>
              {data ? (
                <MonthGrid
                  days={data.days}
                  monthLabel={data.label}
                  bookMode={bookMode}
                  viewerName={viewerName}
                  isAdmin={isAdmin}
                  directory={directory}
                />
              ) : (
                <MonthPlaceholderGrid
                  monthKey={key}
                  monthLabel={formatFallbackLabel(key)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 狂掃快過網速時頂住用：計出真實日期排列 + 保持相同格仔高度，API 返到即刻無縫切換
function MonthPlaceholderGrid({
  monthKey,
  monthLabel,
}: {
  monthKey: string
  monthLabel: string
}) {
  const [year, month] = monthKey.split("-").map(Number)
  const startsMonday = WEEKDAYS[0]?.toLowerCase().startsWith("m") ?? false
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const leading = startsMonday ? (firstDow + 6) % 7 : firstDow
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const offset = i - leading + 1
    if (offset < 1) {
      return { key: `p-${i}`, dayNum: prevMonthDays + offset, inMonth: false }
    }
    if (offset > daysInMonth) {
      return { key: `n-${i}`, dayNum: offset - daysInMonth, inMonth: false }
    }
    return { key: `c-${offset}`, dayNum: offset, inMonth: true }
  })

  const weeks: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <table className="w-full table-fixed border-separate border-spacing-1 sm:border-spacing-1.5">
      <caption className="sr-only">{monthLabel} loading</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((weekday) => (
            <th
              key={weekday}
              scope="col"
              className="pb-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
            >
              {weekday}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, wIdx) => (
          <tr key={wIdx}>
            {week.map((cell) => (
              <td key={cell.key} className="p-0 align-top">
                <div
                  className={`flex h-16 w-full flex-col items-start overflow-hidden rounded-lg p-1.5 text-left sm:h-24 sm:p-2 ${
                    cell.inMonth
                      ? "animate-pulse bg-[#e4ddd2]/55 text-muted-foreground"
                      : "bg-transparent text-muted-foreground/40"
                  }`}
                >
                  <span className="text-xs font-medium sm:text-sm">{cell.dayNum}</span>
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
