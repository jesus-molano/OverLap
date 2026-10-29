/** One reset of a page's "Restablecer…" menu (ResetMenu.vue): its name, what it resets, the reset. */
export interface ResetItem {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly run: () => void
}
