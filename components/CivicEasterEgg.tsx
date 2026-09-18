'use client'

import { useEffect } from 'react'

export default function CivicEasterEgg() {
  useEffect(() => {
    const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
    let currentIdx = 0

    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === sequence[currentIdx].toLowerCase()) {
        currentIdx++
        if (currentIdx === sequence.length) {
          triggerCampusPride()
          currentIdx = 0
        }
      } else {
        currentIdx = 0
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function triggerCampusPride() {
    const existing = document.getElementById('civic-pride-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'civic-pride-toast'
    toast.className = 'fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 border border-white/20 animate-bounce'
    toast.innerHTML = '<span>🎓</span> <span>Secret Civic Pride Unlocked! Thanks for participating in your campus democracy!</span>'
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.classList.add('transition-opacity', 'duration-500', 'opacity-0')
      setTimeout(() => toast.remove(), 500)
    }, 4500)
  }

  return null
}
