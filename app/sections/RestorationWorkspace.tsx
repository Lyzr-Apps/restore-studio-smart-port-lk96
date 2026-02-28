'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { FiUploadCloud, FiDownload, FiImage, FiCheck, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import { HiOutlineSparkles, HiOutlineSun, HiOutlineUser } from 'react-icons/hi2'

const AGENT_ID = '69a29056b465805dc60ec95b'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface RestorationEntry {
  id: string
  originalUrl: string
  restoredUrl: string
  fileName: string
  fileSize: number
  analysis: string
  date: string
  presets: string[]
  aspectRatio?: string
}

interface RestorationWorkspaceProps {
  onSaveToHistory: (entry: RestorationEntry) => void
  sampleMode: boolean
}

// --- Before/After Slider ---
export function BeforeAfterSlider({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const draggingRef = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = true
    updatePosition(e.clientX)
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }, [updatePosition])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    e.preventDefault()
    updatePosition(e.clientX)
  }, [updatePosition])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] overflow-hidden rounded-sm border border-border select-none touch-none"
      style={{ cursor: 'col-resize' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* After (restored) image - full background */}
      <img src={afterSrc} alt="Restored" className="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none" draggable={false} />
      {/* Before (original) image - clipped */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: `${position}%` }}>
        <img
          src={beforeSrc}
          alt="Original"
          className="absolute inset-0 w-full h-full object-contain bg-black"
          style={{ minWidth: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
          draggable={false}
        />
      </div>
      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
        style={{ left: `${position}%`, transform: 'translateX(-50%)', zIndex: 10 }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 border-2 border-white flex items-center justify-center shadow-lg">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3L2 8L5 13" stroke="#171717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 3L14 8L11 13" stroke="#171717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      {/* Labels */}
      <span className="absolute top-3 left-3 px-2 py-0.5 text-xs font-medium tracking-wide bg-black/60 text-white rounded-sm pointer-events-none" style={{ zIndex: 20 }}>Before</span>
      <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium tracking-wide bg-black/60 text-white rounded-sm pointer-events-none" style={{ zIndex: 20 }}>After</span>
    </div>
  )
}

// --- Get image dimensions ---
function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1, height: 1 })
    img.src = src
  })
}

// --- Workspace ---
export default function RestorationWorkspace({ onSaveToHistory, sampleMode }: RestorationWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string>('')
  const [originalDataUrl, setOriginalDataUrl] = useState<string>('')
  const [assetIds, setAssetIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoredUrl, setRestoredUrl] = useState<string>('')
  const [analysis, setAnalysis] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [progressVal, setProgressVal] = useState(0)
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Presets
  const [sharpness, setSharpness] = useState(false)
  const [lighting, setLighting] = useState(false)
  const [portrait, setPortrait] = useState(false)

  // Sample data
  const sampleOriginal = 'https://asset.lyzr.app/AVj15AwE'
  const sampleRestored = 'https://asset.lyzr.app/AVj15AwE'
  const sampleAnalysis = 'The uploaded photo shows moderate noise, slight color fading, and minor blur around the edges. The restoration process enhanced sharpness, corrected white balance, reduced noise artifacts, and improved overall contrast. Facial details have been preserved with high fidelity.'

  useEffect(() => {
    if (sampleMode) {
      setOriginalPreviewUrl(sampleOriginal)
      setRestoredUrl(sampleRestored)
      setAnalysis(sampleAnalysis)
      setStatus('completed')
    } else {
      if (originalPreviewUrl === sampleOriginal) {
        setOriginalPreviewUrl('')
        setRestoredUrl('')
        setAnalysis('')
        setStatus('')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleMode])

  const fileToDataUrl = (f: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(f)
    })
  }

  const handleFileSelect = async (selectedFile: File) => {
    setErrorMsg('')
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setErrorMsg('Please upload a JPG, PNG, or WEBP image.')
      return
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMsg('File size exceeds 20MB limit.')
      return
    }
    setFile(selectedFile)
    const objUrl = URL.createObjectURL(selectedFile)
    setOriginalPreviewUrl(objUrl)

    // Get image dimensions for aspect ratio
    const dims = await getImageDimensions(objUrl)
    setImageDims(dims)

    const dataUrl = await fileToDataUrl(selectedFile)
    setOriginalDataUrl(dataUrl)
    setRestoredUrl('')
    setAnalysis('')
    setStatus('')

    // Upload immediately
    setUploading(true)
    try {
      const uploadResult = await uploadFiles(selectedFile)
      if (uploadResult.success && Array.isArray(uploadResult.asset_ids) && uploadResult.asset_ids.length > 0) {
        setAssetIds(uploadResult.asset_ids)
      } else {
        setErrorMsg(uploadResult.error || 'Upload failed. Please try again.')
      }
    } catch {
      setErrorMsg('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDropzonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) handleFileSelect(droppedFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleRestore = async () => {
    if (assetIds.length === 0 || restoring) return
    setRestoring(true)
    setErrorMsg('')
    setProgressVal(10)

    const activePresets: string[] = []

    // Build aspect ratio instruction
    let aspectInstruction = ''
    if (imageDims && imageDims.width > 0 && imageDims.height > 0) {
      const ratio = imageDims.width / imageDims.height
      if (ratio > 1.3) {
        aspectInstruction = ` The original image is landscape orientation (${imageDims.width}x${imageDims.height}). Generate the restored image in the SAME landscape aspect ratio.`
      } else if (ratio < 0.77) {
        aspectInstruction = ` The original image is portrait orientation (${imageDims.width}x${imageDims.height}). Generate the restored image in the SAME portrait aspect ratio.`
      } else {
        aspectInstruction = ` The original image is roughly square (${imageDims.width}x${imageDims.height}). Generate the restored image in the SAME square aspect ratio.`
      }
    }

    let promptMsg = `Analyze this uploaded photo and restore it. CRITICAL: You MUST reproduce the EXACT same scene, people, poses, background, and every visual element. Do NOT reimagine or create a new scene. Only enhance the technical quality -- improve sharpness, reduce noise, fix color fading, increase resolution to 8K clarity. The output must look like the same photograph taken with a better camera, nothing else.${aspectInstruction}`
    if (sharpness) {
      promptMsg += ' Apply extra sharpness enhancement and fine detail recovery while keeping the scene identical.'
      activePresets.push('Sharpness Boost')
    }
    if (lighting) {
      promptMsg += ' Optimize lighting balance and exposure correction while keeping the scene identical.'
      activePresets.push('Lighting Balance')
    }
    if (portrait) {
      promptMsg += ' Apply subtle portrait enhancement with natural skin detail preservation while keeping the subject exactly the same.'
      activePresets.push('Portrait Enhance')
    }

    const progressInterval = setInterval(() => {
      setProgressVal((prev) => Math.min(prev + 5, 85))
    }, 2000)

    try {
      const result: AIAgentResponse = await callAIAgent(promptMsg, AGENT_ID, { assets: assetIds })
      clearInterval(progressInterval)
      setProgressVal(100)

      if (result.success) {
        // Check for API-level errors in the result
        const resultData = result?.response?.result ?? {}
        if (resultData.error) {
          const errMsg = typeof resultData.error === 'object'
            ? (resultData.error.message || JSON.stringify(resultData.error))
            : String(resultData.error)
          setErrorMsg(`Agent error: ${errMsg}`)
          return
        }

        const restorationAnalysis = resultData.restoration_analysis ?? ''
        const restorationStatus = resultData.status ?? 'completed'
        const artifactFiles = Array.isArray(result?.module_outputs?.artifact_files) ? result.module_outputs!.artifact_files : []
        const imageUrl = artifactFiles.length > 0 ? (artifactFiles[0]?.file_url ?? '') : ''

        setAnalysis(restorationAnalysis)
        setStatus(restorationStatus)
        if (imageUrl) {
          setRestoredUrl(imageUrl)
          // Save to history
          const entry: RestorationEntry = {
            id: Date.now().toString(),
            originalUrl: originalDataUrl,
            restoredUrl: imageUrl,
            fileName: file?.name ?? 'unknown',
            fileSize: file?.size ?? 0,
            analysis: restorationAnalysis,
            date: new Date().toISOString(),
            presets: activePresets,
            aspectRatio: imageDims ? `${imageDims.width}:${imageDims.height}` : undefined,
          }
          onSaveToHistory(entry)
        } else {
          setErrorMsg('Restoration completed but no image was returned. Please try again.')
        }
      } else {
        setErrorMsg(result?.error ?? 'Restoration failed. Please try again.')
      }
    } catch {
      clearInterval(progressInterval)
      setErrorMsg('An error occurred during restoration.')
    } finally {
      setRestoring(false)
    }
  }

  const handleDownload = useCallback(() => {
    if (!restoredUrl) return
    const a = document.createElement('a')
    a.href = restoredUrl
    a.download = `restored-${file?.name ?? 'photo.png'}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [restoredUrl, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setOriginalPreviewUrl('')
    setOriginalDataUrl('')
    setAssetIds([])
    setRestoredUrl('')
    setAnalysis('')
    setStatus('')
    setErrorMsg('')
    setProgressVal(0)
    setImageDims(null)
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const hasOriginal = !!originalPreviewUrl
  const hasRestored = !!restoredUrl
  const canRestore = assetIds.length > 0 && !uploading && !restoring && !hasRestored

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-wide text-foreground">Restore Photo</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide">Upload a photo and let AI restore it to its original clarity</p>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/20 border border-destructive/30 text-sm text-red-300">
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="text-red-300 hover:text-red-100 p-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* Before/After Slider (shown when both images available) */}
        {hasOriginal && hasRestored && !sampleMode && (
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <BeforeAfterSlider beforeSrc={originalPreviewUrl} afterSrc={restoredUrl} />
            </CardContent>
          </Card>
        )}

        {sampleMode && (
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <BeforeAfterSlider beforeSrc={sampleOriginal} afterSrc={sampleRestored} />
            </CardContent>
          </Card>
        )}

        {/* Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Upload / Original */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Original Photo</h2>
              {!hasOriginal && !sampleMode ? (
                <div
                  role="button"
                  tabIndex={0}
                  className="relative border-2 border-dashed border-border rounded-sm p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors hover:border-muted-foreground/50 min-h-[280px]"
                  style={{ position: 'relative', zIndex: 2 }}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={handleDropzonClick}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDropzonClick() }}
                >
                  <img src="https://asset.lyzr.app/AVj15AwE" alt="Photo Restore" className="w-24 h-24 object-contain opacity-40 mb-2 pointer-events-none" draggable={false} />
                  <FiUploadCloud className="w-8 h-8 text-muted-foreground pointer-events-none" />
                  <p className="text-sm text-muted-foreground text-center tracking-wide pointer-events-none">
                    Drag and drop your photo here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground/60 pointer-events-none">JPG, PNG, WEBP up to 20MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ zIndex: 3 }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileSelect(f)
                      e.target.value = ''
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-sm overflow-hidden border border-border aspect-[4/3]">
                    <img
                      src={sampleMode ? sampleOriginal : originalPreviewUrl}
                      alt="Original"
                      className="w-full h-full object-contain bg-black"
                    />
                  </div>
                  {file && !sampleMode && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs tracking-wide">{file.name}</Badge>
                      <Badge variant="outline" className="text-xs tracking-wide">{formatFileSize(file.size)}</Badge>
                      {imageDims && <Badge variant="outline" className="text-xs tracking-wide">{imageDims.width}x{imageDims.height}</Badge>}
                      {uploading && <Badge variant="outline" className="text-xs text-yellow-400 tracking-wide">Uploading...</Badge>}
                      {assetIds.length > 0 && !uploading && <Badge variant="outline" className="text-xs text-green-400 tracking-wide"><FiCheck className="w-3 h-3 mr-1" />Uploaded</Badge>}
                    </div>
                  )}
                  {!sampleMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs tracking-wide gap-1.5"
                      onClick={handleReset}
                    >
                      <FiRefreshCw className="w-3 h-3" />
                      Replace Photo
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Restored / Presets / Action */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Restored Output</h2>

              {/* Presets */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground tracking-wide">Enhancement presets</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSharpness(!sharpness)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium tracking-wide transition-colors border cursor-pointer',
                      sharpness ? 'bg-foreground text-background border-foreground' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    <HiOutlineSparkles className="w-3.5 h-3.5" />
                    Sharpness Boost
                  </button>
                  <button
                    type="button"
                    onClick={() => setLighting(!lighting)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium tracking-wide transition-colors border cursor-pointer',
                      lighting ? 'bg-foreground text-background border-foreground' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    <HiOutlineSun className="w-3.5 h-3.5" />
                    Lighting Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortrait(!portrait)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium tracking-wide transition-colors border cursor-pointer',
                      portrait ? 'bg-foreground text-background border-foreground' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    <HiOutlineUser className="w-3.5 h-3.5" />
                    Portrait Enhance
                  </button>
                </div>
              </div>

              {/* Restoring state */}
              {restoring && (
                <div className="space-y-3 py-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground tracking-wide">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round"/></svg>
                    Restoring your photo...
                  </div>
                  <Progress value={progressVal} className="h-1" />
                </div>
              )}

              {/* Restored image */}
              {hasRestored && !restoring && (
                <div className="space-y-3">
                  <div className="relative rounded-sm overflow-hidden border border-border aspect-[4/3]">
                    <img src={restoredUrl} alt="Restored" className="w-full h-full object-contain bg-black" />
                  </div>
                  <Button type="button" onClick={handleDownload} variant="outline" size="sm" className="gap-2 text-xs tracking-wide">
                    <FiDownload className="w-3.5 h-3.5" />
                    Download Full Scale
                  </Button>
                </div>
              )}

              {/* Empty state */}
              {!hasRestored && !restoring && (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                  <FiImage className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground tracking-wide">
                    {hasOriginal ? 'Ready to restore. Click the button below.' : 'Upload a photo to get started.'}
                  </p>
                </div>
              )}

              {/* CTA */}
              {!sampleMode && (
                <Button
                  type="button"
                  onClick={handleRestore}
                  disabled={!canRestore}
                  className="w-full tracking-wide"
                  size="lg"
                >
                  {restoring ? 'Restoring...' : 'Restore Photo'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analysis */}
        {analysis && (
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Restoration Analysis</h2>
              <div className="text-sm text-foreground/80 leading-relaxed tracking-wide">
                {renderMarkdown(analysis)}
              </div>
              {status && (
                <Badge variant="outline" className="text-xs tracking-wide capitalize mt-2">{status}</Badge>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}
