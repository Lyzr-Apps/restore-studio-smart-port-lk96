'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { FiSearch, FiDownload, FiTrash2, FiCalendar, FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { HiOutlinePhoto } from 'react-icons/hi2'

import type { RestorationEntry } from './RestorationWorkspace'

interface HistoryGalleryProps {
  history: RestorationEntry[]
  onDeleteEntry: (id: string) => void
  sampleMode: boolean
}

// Before/After Slider (reusable)
function BeforeAfterSlider({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const isDragging = React.useRef(false)

  const handleMove = React.useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const handleMouseDown = React.useCallback(() => { isDragging.current = true }, [])

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isDragging.current) handleMove(e.clientX) }
    const onUp = () => { isDragging.current = false }
    const onTouchMove = (e: TouchEvent) => { if (isDragging.current && e.touches[0]) handleMove(e.touches[0].clientX) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [handleMove])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] overflow-hidden rounded-sm border border-border select-none cursor-col-resize"
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      <img src={afterSrc} alt="Restored" className="absolute inset-0 w-full h-full object-contain bg-black" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={beforeSrc} alt="Original" className="absolute inset-0 w-full h-full object-contain bg-black" style={{ minWidth: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }} draggable={false} />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10" style={{ left: `${position}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border-2 border-white flex items-center justify-center shadow-lg">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3L2 8L5 13" stroke="#171717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 3L14 8L11 13" stroke="#171717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <span className="absolute top-3 left-3 z-20 px-2 py-0.5 text-xs font-medium tracking-wide bg-black/60 text-white rounded-sm">Before</span>
      <span className="absolute top-3 right-3 z-20 px-2 py-0.5 text-xs font-medium tracking-wide bg-black/60 text-white rounded-sm">After</span>
    </div>
  )
}

export default function HistoryGallery({ history, onDeleteEntry, sampleMode }: HistoryGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortNewest, setSortNewest] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<RestorationEntry | null>(null)

  const sampleHistory: RestorationEntry[] = sampleMode ? [
    {
      id: 'sample-1',
      originalUrl: 'https://asset.lyzr.app/AVj15AwE',
      restoredUrl: 'https://asset.lyzr.app/AVj15AwE',
      fileName: 'family_portrait_1985.jpg',
      fileSize: 3200000,
      analysis: 'Restored faded colors and removed noise artifacts from vintage family portrait.',
      date: new Date(Date.now() - 86400000).toISOString(),
      presets: ['Sharpness Boost', 'Portrait Enhance'],
    },
    {
      id: 'sample-2',
      originalUrl: 'https://asset.lyzr.app/AVj15AwE',
      restoredUrl: 'https://asset.lyzr.app/AVj15AwE',
      fileName: 'wedding_photo.png',
      fileSize: 5100000,
      analysis: 'Enhanced lighting and sharpness for a slightly blurry wedding photo.',
      date: new Date(Date.now() - 172800000).toISOString(),
      presets: ['Lighting Balance'],
    },
    {
      id: 'sample-3',
      originalUrl: 'https://asset.lyzr.app/AVj15AwE',
      restoredUrl: 'https://asset.lyzr.app/AVj15AwE',
      fileName: 'old_landscape.webp',
      fileSize: 2800000,
      analysis: 'Improved clarity and color accuracy on a scanned landscape photograph.',
      date: new Date(Date.now() - 259200000).toISOString(),
      presets: [],
    },
  ] : []

  const entries = sampleMode ? sampleHistory : history

  const filtered = useMemo(() => {
    let items = [...entries]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter((e) => e.fileName.toLowerCase().includes(q))
    }
    items.sort((a, b) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      return sortNewest ? db - da : da - db
    })
    return items
  }, [entries, searchQuery, sortNewest])

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return iso
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `restored-${name}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-foreground">Restoration History</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">Browse and revisit your past photo restorations</p>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border text-sm tracking-wide"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortNewest(!sortNewest)}
            className="gap-1.5 text-xs tracking-wide"
          >
            {sortNewest ? <FiArrowDown className="w-3.5 h-3.5" /> : <FiArrowUp className="w-3.5 h-3.5" />}
            {sortNewest ? 'Newest' : 'Oldest'}
          </Button>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <HiOutlinePhoto className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground tracking-wide text-sm">
              {searchQuery ? 'No restorations match your search.' : 'No restorations yet. Start by uploading a photo!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((entry) => (
              <Card
                key={entry.id}
                className="border-border bg-card cursor-pointer transition-colors hover:bg-secondary/50 group"
                onClick={() => setSelectedEntry(entry)}
              >
                <CardContent className="p-3 space-y-3">
                  <div className="relative rounded-sm overflow-hidden aspect-[4/3] border border-border">
                    <img src={entry.restoredUrl} alt={entry.fileName} className="w-full h-full object-contain bg-black" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium tracking-wide truncate text-foreground">{entry.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wide">
                      <FiCalendar className="w-3 h-3" />
                      <span>{formatDate(entry.date)}</span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{formatFileSize(entry.fileSize)}</span>
                    </div>
                    {Array.isArray(entry.presets) && entry.presets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.presets.map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px] tracking-wide">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs tracking-wide gap-1"
                      onClick={(e) => { e.stopPropagation(); handleDownload(entry.restoredUrl, entry.fileName) }}
                    >
                      <FiDownload className="w-3 h-3" />
                      Download
                    </Button>
                    {!sampleMode && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-400 hover:text-red-300 tracking-wide"
                        onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
                      >
                        <FiTrash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedEntry(null) }}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground tracking-wide">{selectedEntry?.fileName ?? 'Restoration Detail'}</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-2">
                <BeforeAfterSlider beforeSrc={selectedEntry.originalUrl} afterSrc={selectedEntry.restoredUrl} />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wide">
                    <FiCalendar className="w-3 h-3" />
                    <span>{formatDate(selectedEntry.date)}</span>
                    <span className="text-muted-foreground/40">|</span>
                    <span>{formatFileSize(selectedEntry.fileSize)}</span>
                  </div>
                  {Array.isArray(selectedEntry.presets) && selectedEntry.presets.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedEntry.presets.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs tracking-wide">{p}</Badge>
                      ))}
                    </div>
                  )}
                  {selectedEntry.analysis && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-1">Analysis</p>
                      <p className="text-sm text-foreground/80 leading-relaxed tracking-wide">{selectedEntry.analysis}</p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleDownload(selectedEntry.restoredUrl, selectedEntry.fileName)}
                  className="w-full gap-2 tracking-wide"
                >
                  <FiDownload className="w-4 h-4" />
                  Download Full Scale
                </Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
