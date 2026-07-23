"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration can fail in unsupported/preview contexts — safe to ignore.
      })
    }
    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])
  return null
}
