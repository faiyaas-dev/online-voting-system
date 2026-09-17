'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-gray-700 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:border-white print:hidden"
    >
      Print / Save PDF
    </button>
  )
}
