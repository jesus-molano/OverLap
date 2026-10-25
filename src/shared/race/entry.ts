import type { DriverEntry } from '../types'

/**
 * Identity of the entry driving a CarIdx. In team races DriverInfo shows the
 * driver currently in the car, so the entry is the team (car number when the
 * TeamID is missing) and a driver change keeps the car's history; otherwise
 * it is the person (user name when the UserID is missing).
 */
export function entryKey(d: DriverEntry, teamRacing: boolean): string {
  if (teamRacing) return d.teamId > 0 ? `t${d.teamId}` : `c${d.carNumber}`
  return d.userId > 0 ? `u${d.userId}` : `n${d.userName}`
}
