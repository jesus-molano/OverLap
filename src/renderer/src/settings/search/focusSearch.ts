/**
 * «Ayuda rápida» (R40) can send the user to «Buscar ajuste»: the one field mounted (the sidebar's,
 * or the narrow window's bar, R49) takes the focus when this event is sent on the window.
 */
export const FOCUS_SEARCH_EVENT = 'settings:focus-search'

/** Puts the focus in «Buscar ajuste», wherever the window draws it now. */
export function requestSearchFocus(): void {
  window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))
}
