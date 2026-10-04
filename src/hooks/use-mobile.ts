import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const matches = () => window.matchMedia(QUERY).matches

const subscribe = (onStoreChange: () => void) => {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

/**
 * Whether the viewport is below the mobile breakpoint.
 *
 * The viewport is an external store, so it is read through `useSyncExternalStore`
 * rather than copied into state by an effect. The effect version needed a
 * synchronous `setState` on mount, which the React compiler rules out, and it
 * also guaranteed the first render disagreed with the real viewport width.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, matches, () => false)
}