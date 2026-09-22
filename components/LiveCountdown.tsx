'use client'

import { useEffect, useState } from 'react'

const HOUR = 3600000
const DAY = 24 * HOUR

function formatRemaining(milliseconds: number, label: string, closedLabel: string) {
  if (milliseconds <= 0) return closedLabel

  // Sub-hour precision: MM:SS ticking for the closing frenzy.
  if (milliseconds < HOUR) {
    const mins = Math.floor(milliseconds / 60000)
    const secs = Math.floor((milliseconds % 60000) / 1000)
    return `${label} ${mins}:${String(secs).padStart(2, '0')}`
  }

  const totalMinutes = Math.floor(milliseconds / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  return days > 0
    ? `${label} ${days}d ${hours}h ${minutes}m`
    : `${label} ${hours}h ${minutes}m`
}

export default function LiveCountdown({
  closesAt,
  label = 'Closes in',
  closedLabel = 'Voting closed',
  showIcon = true,
}: {
  closesAt: string
  label?: string
  closedLabel?: string
  showIcon?: boolean
}) {
  const [remaining, setRemaining] = useState(() => new Date(closesAt).getTime() - Date.now())
  const subHour = remaining < HOUR && remaining > 0

  useEffect(() => {
    const update = () => setRemaining(new Date(closesAt).getTime() - Date.now())
    update()
    // Tick every second under 1h for MM:SS precision, else every 30s.
    const interval = subHour ? 1000 : 30000
    const timer = window.setInterval(update, interval)
    return () => window.clearInterval(timer)
  }, [closesAt, subHour])

  // Urgency tiers: zinc (>24h) → yellow (<24h) → red + pulse (<1h).
  const tier =
    remaining <= 0 || remaining >= DAY
      ? 'border-white/15 bg-white/5 text-zinc-300'
      : remaining < HOUR
        ? 'border-red-400/40 bg-red-400/10 text-red-300 animate-pulse-glow'
        : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'

  return (
    <span
      role="status"
      aria-live="polite"
      title={`Closes ${new Date(closesAt).toLocaleString()}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider tabular-nums ${tier}`}
    >
      {showIcon && remaining > 0 && (
        <span aria-hidden="true" className="live-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {formatRemaining(remaining, label, closedLabel)}
    </span>
  )
}
