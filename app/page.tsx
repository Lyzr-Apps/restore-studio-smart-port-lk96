'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FiImage, FiClock, FiMenu, FiChevronLeft, FiActivity } from 'react-icons/fi'

import RestorationWorkspace from './sections/RestorationWorkspace'
import HistoryGallery from './sections/HistoryGallery'
import type { RestorationEntry } from './sections/RestorationWorkspace'

const STORAGE_KEY = 'photo-restore-history'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#f2f2f2]">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-[#999999] mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-[#f2f2f2] text-[#171717] rounded-sm text-sm font-medium tracking-wide"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

type Screen = 'restore' | 'history'

export default function Page() {
  const [screen, setScreen] = useState<Screen>('restore')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sampleMode, setSampleMode] = useState(false)
  const [history, setHistory] = useState<RestorationEntry[]>([])
  const [mounted, setMounted] = useState(false)

  // Load history from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Save history to localStorage
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
      } catch {
        // Ignore quota errors
      }
    }
  }, [history, mounted])

  const handleSaveToHistory = useCallback((entry: RestorationEntry) => {
    setHistory((prev) => [entry, ...prev])
  }, [])

  const handleDeleteEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const navItems: { id: Screen; label: string; icon: React.ReactNode }[] = [
    { id: 'restore', label: 'Restore', icon: <FiImage className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <FiClock className="w-4 h-4" /> },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-background text-foreground font-sans" style={{ position: 'relative', zIndex: 0 }}>
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col border-r border-[#1f1f1f] bg-[#0d0d0d] transition-all duration-200 flex-shrink-0',
            sidebarOpen ? 'w-56' : 'w-14'
          )}
          style={{ position: 'relative', zIndex: 10 }}
        >
          {/* Top: Logo + Collapse */}
          <div className="flex items-center justify-between p-3 border-b border-[#1f1f1f]">
            {sidebarOpen && (
              <span className="text-sm font-semibold tracking-wide text-foreground truncate">
                Photo Restore Studio
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <FiChevronLeft className="w-4 h-4" /> : <FiMenu className="w-4 h-4" />}
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 p-2 space-y-1">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 rounded-sm text-sm tracking-wide transition-colors',
                  screen === item.id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                {item.icon}
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.id === 'history' && history.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] tracking-wide">{history.length}</Badge>
                )}
              </button>
            ))}
          </nav>

          {/* Sample data toggle */}
          {sidebarOpen && (
            <div className="p-3 border-t border-[#1f1f1f]">
              <div className="flex items-center gap-2">
                <Switch
                  id="sample-toggle"
                  checked={sampleMode}
                  onCheckedChange={setSampleMode}
                />
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground tracking-wide cursor-pointer">
                  Sample Data
                </Label>
              </div>
            </div>
          )}

          {/* Agent status */}
          {sidebarOpen && (
            <div className="p-3 border-t border-[#1f1f1f]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wide">
                <FiActivity className="w-3 h-3" />
                <span>Agent Status</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground tracking-wide truncate">Image Restoration Agent</span>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1 tracking-wide">ID: 69a290...c95b</p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar (mobile) */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold tracking-wide">Photo Restore Studio</span>
            <div className="flex items-center gap-2">
              <Switch
                id="sample-toggle-mobile"
                checked={sampleMode}
                onCheckedChange={setSampleMode}
              />
              <Label htmlFor="sample-toggle-mobile" className="text-xs text-muted-foreground tracking-wide">
                Sample
              </Label>
            </div>
          </div>

          {/* Screen content */}
          {screen === 'restore' && (
            <RestorationWorkspace
              onSaveToHistory={handleSaveToHistory}
              sampleMode={sampleMode}
            />
          )}
          {screen === 'history' && (
            <HistoryGallery
              history={history}
              onDeleteEntry={handleDeleteEntry}
              sampleMode={sampleMode}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}
