'use client'

import { useEffect, useState } from 'react'

function formatRemaining(milliseconds: number) {
  if (milliseconds <= 0) return 'Voting closed'

  const totalMinutes = Math.floor(milliseconds / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  return days > 0
    ? `Closes in ${days}d ${hours}h ${minutes}m`
    : `Closes in ${hours}h ${minutes}m`
}

export default function LiveCountdown({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState(() => new Date(closesAt).getTime() - Date.now())

  useEffect(() => {
    const update = () => setRemaining(new Date(closesAt).getTime() - Date.now())
    update()
    const timer = window.setInterval(update, 30000)
    return () => window.clearInterval(timer)
  }, [closesAt])

  return (
    <span role="status" aria-live="polite">
      {formatRemaining(remaining)}
    </span>
  )
}
