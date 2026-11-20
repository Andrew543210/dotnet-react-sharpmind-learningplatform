import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker, useSearchParams } from 'react-router-dom'
import { api, message, statusOf } from './api'

export function useApi<T>(path: string) {
  const [result, setResult] = useState<{
    path: string
    revision: number
    data: T | null
    error: string
    status: number
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    api
      .get<T>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, revision, data, error: '', status: 200 })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ path, revision, data: null, error: message(error), status: statusOf(error) })
      })
    return () => controller.abort()
  }, [path, revision])
  const samePath = result?.path === path
  const current = samePath && result.revision === revision
  return {
    data: samePath ? result.data : null,
    error: current ? result.error : '',
    status: current ? result.status : 0,
    loading: !samePath || (!current && result.data === null),
    refreshing: samePath && !current,
    refresh,
  }
}

export function useAction() {
  const lock = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const run = async (action: () => Promise<void>, successText = '') => {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError('')
    setSuccess('')
    try {
      await action()
      setSuccess(successText)
    } catch (error) {
      setError(message(error))
    } finally {
      lock.current = false
      setPending(false)
    }
  }
  return { pending, error, success, run }
}

export function useUnsaved(dirty: boolean) {
  const allow = useRef(false)
  useEffect(() => {
    const check = (event: Event) => {
      if (dirty && !allow.current) event.preventDefault()
    }
    window.addEventListener('sharpmind:check-unsaved', check)
    return () => window.removeEventListener('sharpmind:check-unsaved', check)
  }, [dirty])
  return () => {
    allow.current = true
  }
}

function hasUnsavedChanges() {
  return !window.dispatchEvent(new Event('sharpmind:check-unsaved', { cancelable: true }))
}

// A single router blocker protects every registered form on the current page.
export function useUnsavedNavigation() {
  useBeforeUnload(
    useCallback((event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) event.preventDefault()
    }, []),
  )
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search) &&
      hasUnsavedChanges(),
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Є незбережені зміни. Залишити цю сторінку?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
}

// List page and filters live in the URL, so Back, reload and shared links keep them. Changing them is a
// navigation, which the router blocker above guards when a form on the page has unsaved changes.
export function useListParams() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.trunc(Number(params.get('page'))) || 1)
  const update = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [name, value] of Object.entries(changes))
        if (value) next.set(name, value)
        else next.delete(name)
      if (!('page' in changes)) next.delete('page')
      return next
    })
  return {
    params,
    page,
    update,
    setPage: (value: number) => update({ page: value > 1 ? String(value) : null }),
  }
}

export function useDraft(key: string) {
  const [value, setValue] = useState(() => {
    try {
      return sessionStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      if (value) sessionStorage.setItem(key, value)
      else sessionStorage.removeItem(key)
    } catch {
      /* A private browser may block storage; the in-memory form remains usable. */
    }
  }, [key, value])
  useUnsaved(Boolean(value))
  return [value, setValue] as const
}
