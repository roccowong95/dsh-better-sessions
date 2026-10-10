import { createElement as h, Fragment } from 'react'
import { Modal, Input, Button } from '@deepseek-ai/dsh-client-ui-primitives'
// The SDK renderer uses this same loader entry. This project has no @types/react-dom.
// @ts-expect-error react-dom/client ships no declarations; keep the used surface typed below.
import { createRoot as createReactRoot } from 'react-dom/client'
import type { ReactNode } from 'react'

const createRoot: (container: HTMLElement) => {
  render(children: ReactNode): void
  unmount(): void
} = createReactRoot

export interface SessionDialogOptions {
  title: string
  cancelLabel: string
  saveLabel: string
  /** Omit for a confirmation dialog; rename uses an accessibly named text input. */
  initialValue?: string
  message?: string
  submit(value: string, signal: AbortSignal): Promise<void>
}

export function createSessionDialogs(doc: Document = document) {
  let active: (() => void) | undefined
  let disposed = false
  let sequence = 0

  return {
    open(options: SessionDialogOptions): void {
      if (disposed || active) return
      const controller = new AbortController()
      const previousFocus = doc.activeElement
      const container = doc.createElement('div')
      container.dataset.betterSessionsDialog = 'session'
      const id = `better-sessions-dialog-${++sequence}`
      let input: HTMLInputElement | null = null
      let selected = false
      let pending = false
      let error: string | undefined
      doc.body.appendChild(container)
      let root: ReturnType<typeof createRoot>
      try {
        root = createRoot(container)
      } catch (cause) {
        container.remove()
        throw cause
      }
      const close = () => {
        if (controller.signal.aborted) return
        controller.abort()
        // onClose can run within React callbacks/commits. Never synchronously
        // unmount another root from there; keep the active guard until cleanup.
        queueMicrotask(() => {
          try {
            root.unmount()
          } finally {
            container.remove()
            if (active === close) active = undefined
            const HTMLElementClass = doc.defaultView?.HTMLElement
            // Modal normally restores focus itself. Only fall back when it did
            // not mount (or the invoking control changed before its commit).
            if (HTMLElementClass && previousFocus instanceof HTMLElementClass && previousFocus.isConnected && doc.activeElement !== previousFocus) {
              previousFocus.focus()
            }
          }
        })
      }
      active = close
      const submit = (event: { preventDefault(): void }) => {
        event.preventDefault()
        // Immediate closure guard, independent of React's render scheduling.
        if (pending || controller.signal.aborted) return
        const value = input?.value.trim() ?? ''
        if (options.initialValue !== undefined && !value) { input?.focus(); return }
        pending = true
        error = undefined
        render()
        void (async () => {
          try {
            await options.submit(value, controller.signal)
            close()
          } catch (cause) {
            if (controller.signal.aborted) return
            error = cause instanceof Error ? cause.message : String(cause)
            pending = false
            render()
          }
        })()
      }
      const render = () => {
        root.render(h(Modal, {
          open: true,
          title: options.title,
          closeLabel: options.cancelLabel,
          onClose: close,
          footer: h(Fragment, null,
            h(Button, { type: 'button', variant: 'ghost', onClick: close, ...{ 'data-modal-autofocus': options.initialValue === undefined ? true : undefined } }, options.cancelLabel),
            h(Button, { type: 'submit', variant: 'primary', form: id, disabled: pending }, options.saveLabel)),
        }, h('form', { id, onSubmit: submit, 'aria-busy': pending },
          options.message ? h('p', null, options.message) : null,
          options.initialValue !== undefined ? h(Input, {
            name: 'title',
            type: 'text',
            defaultValue: options.initialValue,
            disabled: pending,
            'aria-label': options.title,
            'aria-describedby': error !== undefined ? `${id}-error` : undefined,
            ...{ 'data-modal-autofocus': true },
            ref: (element: HTMLInputElement | null) => {
              input = element
              if (!element || controller.signal.aborted) return
              if (!selected) { selected = true; element.select() }
              if (error !== undefined && !pending) element.focus()
            },
          }) : null,
          error !== undefined ? h('p', { id: `${id}-error`, role: 'alert', 'aria-live': 'assertive' }, error) : null)))
      }
      try {
        render()
      } catch (cause) {
        close()
        throw cause
      }
    },
    dispose(): void {
      disposed = true
      active?.()
    },
  }
}
