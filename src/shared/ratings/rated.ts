import type { SessionMeta } from '../types'

/**
 * iRating and SR can only change in an official race event (WeekendInfo
 * Official == 1 and EventType 'Race'; its practice and qualifying count for
 * SR too). Test drives, hosted, league and AI sessions are never official, so
 * projecting there would show changes that cannot happen.
 */
export function isRatedEvent(session: Pick<SessionMeta, 'official' | 'eventType'>): boolean {
  return session.official && session.eventType.trim().toLowerCase() === 'race'
}
