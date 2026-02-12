'use client'

import { useState, useEffect, useCallback } from 'react'
import { Boxes } from 'lucide-react'
import { isTauriRuntime } from '@/lib/tauri'

function TrafficLights() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [hovered, setHovered] = useState(false)

  const updateMaximized = useCallback(async () => {
    if (!isTauriRuntime()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    setIsMaximized(await getCurrentWindow().isMaximized())
  }, [])

  useEffect(() => {
    updateMaximized()
  }, [updateMaximized])

  const handleMinimize = async () => {
    if (!isTauriRuntime()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  }

  const handleMaximize = async () => {
    if (!isTauriRuntime()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().toggleMaximize()
    setIsMaximized(!(await getCurrentWindow().isMaximized()))
  }

  const handleClose = async () => {
    if (!isTauriRuntime()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().close()
  }

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={handleClose}
        className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] transition-colors hover:bg-[#ff5f57]/80"
        aria-label="Close"
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6" className="text-black/80">
            <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={handleMinimize}
        className="flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] transition-colors hover:bg-[#febc2e]/80"
        aria-label="Minimize"
      >
        {hovered && (
          <svg width="6" height="2" viewBox="0 0 6 2" className="text-black/80">
            <path d="M0.5 1H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={handleMaximize}
        className="flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] transition-colors hover:bg-[#28c840]/80"
        aria-label="Maximize"
      >
        {hovered && (
          <svg width="6" height="6" viewBox="0 0 6 6" className="text-black/80">
            {isMaximized ? (
              <path d="M1 2L3 0.5L5 2L3 5.5Z" fill="currentColor" />
            ) : (
              <path d="M0.5 3.5L0.5 0.5L3.5 0.5M2.5 5.5L5.5 5.5L5.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        )}
      </button>
    </div>
  )
}

export function TitleBar() {
  const [isTauri, setIsTauri] = useState(false)

  useEffect(() => {
    setIsTauri(isTauriRuntime())
  }, [])

  return (
    <div
      className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-4"
      data-tauri-drag-region
    >
      {/* Left: traffic lights + app identity */}
      <div className="flex items-center gap-4">
        {isTauri && <TrafficLights />}
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Boxes className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[13px] font-semibold text-foreground">Mahzen</span>
        </div>
      </div>

      {/* Center: spacer — draggable */}
      <div className="flex-1" data-tauri-drag-region />
    </div>
  )
}
