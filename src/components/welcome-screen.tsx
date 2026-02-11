'use client'

import { motion } from 'motion/react'
import { Database, ArrowLeft, Cloud, Shield, Zap, Plus } from 'lucide-react'

interface WelcomeScreenProps {
  onAddSource?: () => void
}

const features = [
  {
    icon: ArrowLeft,
    title: 'Browse & Navigate',
    description: 'Double-click folders to navigate, use breadcrumbs to go back',
  },
  {
    icon: Shield,
    title: 'Manage Objects',
    description: 'Right-click for copy, move, download, and more actions',
  },
  {
    icon: Zap,
    title: 'View Properties',
    description: 'Inspect size, ETag, storage class, and metadata',
  },
]

export function WelcomeScreen({ onAddSource }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center text-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="relative mb-6"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary">
            <Cloud className="h-3 w-3 text-primary-foreground" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-balance text-lg font-semibold text-foreground"
        >
          Select a Bucket to Begin
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground"
        >
          Choose an S3 bucket from the sidebar to browse its contents,
          or add a new S3-compatible source to get started.
        </motion.p>

        {onAddSource && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onAddSource}
            className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add S3 Source
          </motion.button>
        )}

        {/* Feature hints */}
        <div className="mt-8 flex flex-col gap-3 text-left">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.25 + index * 0.08 }}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3"
            >
              <feature.icon className="h-4 w-4 flex-shrink-0 text-primary" />
              <div>
                <p className="text-xs font-medium text-foreground">{feature.title}</p>
                <p className="text-[11px] text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
