import { useEffect, useRef } from 'react'

const escapeCloseStack = []
let listening = false

function handleKeyDown(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return

  const topEntry = escapeCloseStack.at(-1)
  if (!topEntry) return

  event.preventDefault()
  topEntry.onCloseRef.current?.(event)
}

function ensureListener() {
  if (listening || typeof document === 'undefined') return
  document.addEventListener('keydown', handleKeyDown)
  listening = true
}

function removeListenerIfIdle() {
  if (!listening || escapeCloseStack.length > 0 || typeof document === 'undefined') return
  document.removeEventListener('keydown', handleKeyDown)
  listening = false
}

export function useEscapeToClose(onClose, active = true) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return undefined

    const entry = { onCloseRef }
    escapeCloseStack.push(entry)
    ensureListener()

    return () => {
      const index = escapeCloseStack.indexOf(entry)
      if (index >= 0) escapeCloseStack.splice(index, 1)
      removeListenerIfIdle()
    }
  }, [active])
}
