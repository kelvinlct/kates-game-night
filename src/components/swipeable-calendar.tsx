"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { DirectoryUser } from "@/lib/admin-add"
import type { BookMode, DayView } from "@/lib/types"
import { MonthGrid } from "@/components/month-grid"
import { MonthPager } from "@/components/month-pager"

export interface MonthSlideData {
  label: string
  days: DayView[]
  prevKey: string
  nextKey: string
}

const EDGE_GUARD_PX = 20
const LOCK_THRESHOLD_PX = 8

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
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const phaseRef = useRef<"idle" | "snapping" | "navigating">("idle")
  const keysRef = useRef({ prevKey: current.prevKey, nextKey: current.nextKey })
  const clearSnapRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef<number | null>(null)

  const [prevCurrentLabel, setPrevCurrentLabel] = useState(current.label)
  const [activeSlot, setActiveSlot] = useState<-1 | 0 | 1>(0)

  // Server 返咗新月份嗰下，喺 commit 前同步 reset activeSlot，避免標題閃爍
  if (prevCurrentLabel !== current.label) {
    setPrevCurrentLabel(current.label)
    setActiveSlot(0)
  }

  // 同步最新 keys 畀 native event listeners，同時預載前後兩個月
  useEffect(() => {
    keysRef.current = { prevKey: current.prevKey, nextKey: current.nextKey }
    router.prefetch(`/?month=${current.prevKey}`)
    router.prefetch(`/?month=${current.nextKey}`)
  }, [router, current.prevKey, current.nextKey])

  // 新月份到位時，喺瀏覽器 paint 前靜默將 track reset 返正中間
  useLayoutEffect(() => {
    clearSnapRef.current?.()
    clearSnapRef.current = null
    phaseRef.current = "idle"
    const track = trackRef.current
    if (track) {
      track.style.transition = "none"
      track.style.transform = ""
    }
  }, [current.label])

  // Native touch listeners：120fps 直接改 DOM + { passive: false } 防 iOS 斜拉 + 唔食 Portal 事件
  useEffect(() => {
    const container = containerRef.current
    const track = trackRef.current
    if (!container || !track) return

    const gesture = {
      active: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastTime: 0,
      dx: 0,
      velocity: 0,
      width: 320,
      axis: null as "x" | "y" | null,
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

    const snapTo = (target: -1 | 0 | 1, releaseVelocity: number) => {
      const targetDx = target === -1 ? gesture.width : target === 1 ? -gesture.width : 0
      const targetTransform =
        target === -1
          ? "translate3d(0%, 0, 0)"
          : target === 1
            ? "translate3d(-66.666667%, 0, 0)"
            : "translate3d(-33.333333%, 0, 0)"

      const remaining = Math.abs(targetDx - gesture.dx)

      const finish = () => {
        if (target === 0) {
          track.style.transition = "none"
          track.style.transform = ""
          phaseRef.current = "idle"
          return
        }
        const targetKey = target === -1 ? keysRef.current.prevKey : keysRef.current.nextKey
        router.push(`/?month=${targetKey}`, { scroll: false })
      }

      if (target !== 0) {
        phaseRef.current = "navigating"
        setActiveSlot(target)
      } else {
        phaseRef.current = "snapping"
      }

      // 已經拖到貼邊，唔會 trigger transitionend，直接完成
      if (remaining < 1) {
        track.style.transition = "none"
        track.style.transform = targetTransform
        finish()
        return
      }

      // 根據剩餘距離同甩手速度動態計回彈時間（150ms–300ms）
      const speedBoost = Math.min(Math.abs(releaseVelocity) * 120, 120)
      const duration = Math.round(
        Math.min(300, Math.max(150, (remaining / gesture.width) * 320 - speedBoost))
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

      track.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
      track.style.transform = targetTransform
    }

    const onTouchStart = (e: TouchEvent) => {
      // 如果想嚴格限定手機 mode（< 640px）先有得滑，解除下面嗰行註解：
      // if (window.innerWidth >= 640) return
      if (e.touches.length !== 1 || phaseRef.current !== "idle") return
      const touch = e.touches[0]

      // 避開 iOS Safari 左右邊緣系統返回/前進手勢
      if (touch.clientX < EDGE_GUARD_PX || touch.clientX > window.innerWidth - EDGE_GUARD_PX) {
        return
      }

      gesture.active = true
      gesture.startX = touch.clientX
      gesture.startY = touch.clientY
      gesture.lastX = touch.clientX
      gesture.lastTime = performance.now()
      gesture.dx = 0
      gesture.velocity = 0
      gesture.width = container.offsetWidth || 320
      gesture.axis = null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!gesture.active) return

      // 多指觸控時安全取消
      if (e.touches.length !== 1) {
        gesture.active = false
        if (gesture.axis === "x") snapTo(0, 0)
        return
      }

      const touch = e.touches[0]
      const rawDx = touch.clientX - gesture.startX
      const rawDy = touch.clientY - gesture.startY

      // 頭 8px 判斷方向，稍微偏重上下捲動，防斜向上下掃誤觸
      if (gesture.axis === null) {
        if (Math.abs(rawDx) < LOCK_THRESHOLD_PX && Math.abs(rawDy) < LOCK_THRESHOLD_PX) return
        if (Math.abs(rawDx) > Math.abs(rawDy) * 1.1) {
          gesture.axis = "x"
          track.style.transition = "none"
        } else {
          gesture.axis = "y"
          gesture.active = false
          return
        }
      }

      if (gesture.axis === "x") {
        e.preventDefault()

        // 限制最大拖拉距離唔超過一個月闊度，防拉出白邊
        const clampedDx = Math.max(-gesture.width, Math.min(gesture.width, rawDx))
        const now = performance.now()
        const dt = now - gesture.lastTime
        if (dt > 0) {
          const instantV = (touch.clientX - gesture.lastX) / dt
          gesture.velocity = gesture.velocity * 0.4 + instantV * 0.6
          gesture.lastX = touch.clientX
          gesture.lastTime = now
        }

        gesture.dx = clampedDx
        track.style.transform = `translate3d(calc(-33.333333% + ${clampedDx}px), 0, 0)`
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!gesture.active) return
      gesture.active = false
      if (gesture.axis !== "x") return

      armClickSuppression()

      // 系統中斷（例如拉出控制中心 / 來電）就彈返原位
      if (e.type === "touchcancel") {
        snapTo(0, 0)
        return
      }

      // 鬆手前停頓超過 80ms 就唔當係甩手
      const releaseVelocity = performance.now() - gesture.lastTime > 80 ? 0 : gesture.velocity
      const goPrev = gesture.dx > gesture.width * 0.25 || (releaseVelocity > 0.35 && gesture.dx > 20)
      const goNext = gesture.dx < -gesture.width * 0.25 || (releaseVelocity < -0.35 && gesture.dx < -20)

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
  }, [router])

  const slides = [
    { slot: -1 as const, data: prev },
    { slot: 0 as const, data: current },
    { slot: 1 as const, data: next },
  ]
  const activeSlide = activeSlot === -1 ? prev : activeSlot === 1 ? next : current

  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10 sm:p-5">
      <MonthPager
        label={activeSlide.label}
        prevHref={`/?month=${activeSlide.prevKey}`}
        nextHref={`/?month=${activeSlide.nextKey}`}
      />
      <div ref={containerRef} className="overflow-hidden touch-pan-y select-none">
        <div
          ref={trackRef}
          className="flex w-[300%] items-start will-change-transform [transform:translate3d(-33.333333%,0,0)]"
        >
          {slides.map(({ slot, data }) => (
            <div key={data.label} className="w-1/3 shrink-0" aria-hidden={slot !== activeSlot}>
              <MonthGrid
                days={data.days}
                monthLabel={data.label}
                bookMode={bookMode}
                viewerName={viewerName}
                isAdmin={isAdmin}
                directory={directory}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
