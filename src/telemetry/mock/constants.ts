/** Fixed numbers of the mock race session. */
import { TRACK_LENGTH_M } from './track'

export const MOCK_TRACK_LENGTH_M = TRACK_LENGTH_M
/** WeekendInfo.TrackPitSpeedLimit of the mock circuit, km/h. */
export const MOCK_PIT_SPEED_LIMIT_KMH = 60
/** Per-car array length: current iRacing builds send 72 entries (the SDK header says 64). */
export const MOCK_CAR_SLOTS = 72
/** Timed race: the race session's SessionTime limit, seconds. */
export const MOCK_RACE_LENGTH_S = 4500
/** WeekendInfo.SubSessionID of the first session; every new session adds 1. */
export const MOCK_SUBSESSION_ID = 71234567
/** WeekendInfo.SessionID of the first session; every new session adds 1. */
export const MOCK_SESSION_ID = 291234567

/** Race time already run when a session starts (~40 min left, consistent with 15 laps done). */
export const RACE_ELAPSED_AT_START_S = 2100
/** Seconds from the start of a mock session until the race clock reaches 0. */
export const CLOCK_LEFT_AT_START_S = MOCK_RACE_LENGTH_S - RACE_ELAPSED_AT_START_S
/** Gridding and pace lap before the green flag. */
const PRE_GREEN_S = 180
/** SessionTime when a mock session starts. */
export const START_SESSION_TIME_S = PRE_GREEN_S + RACE_ELAPSED_AT_START_S
