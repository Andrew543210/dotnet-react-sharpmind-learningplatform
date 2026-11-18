import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { api, message } from './api'

export function useApi<T>(path: string) {
  const [result, setResult] = useState<{
    path: string
    revision: number
    data: T | null
    error: string
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    api
      .get<T>(path, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, revision, data, error: '' })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ path, revision, data: null, error: message(error) })
      })
    return () => controller.abort()
  }, [path, revision])
  const current = result?.path === path && result.revision === revision
  return {
    data: current ? result.data : null,
    error: current ? result.error : '',
    loading: !current,
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
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty && !allow.current) event.preventDefault()
      },
      [dirty],
    ),
  )
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allow.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Є незбережені зміни. Залишити цю сторінку?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  return () => {
    allow.current = true
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
