/**
 * Deterministic simulated multi-class timed race, so the overlay can be
 * developed without iRacing. Pure TypeScript (no Node, no DOM) to keep it
 * testable; `../sources/MockSource.ts` adapts a MockSeries to TelemetrySource.
 * This module is the public entry point; the parts:
 * - race.ts: MockRace, one session (cars, finish, positions, output);
 * - series.ts: MockSeries, session after session;
 * - scripts.ts, scenarios.ts: the cast's motion and the timeline;
 * - pitLane.ts, inputs.ts: the player's pit stop and driver inputs;
 * - traffic.ts: lanes and the spotter; sessionInfo.ts: the session YAML;
 * - tyres.ts, warnings.ts: the compounds and the furled black flag;
 * - frameBuffer.ts: output arrays and the telemetry frame.
 *
 * Cast around the player (GT3 #07 by default), ~40 min before the end:
 * - escorts: two cars of the other class orbit the player on a fixed cycle,
 *   so the radar goes through every CarLeftRight state without touching the
 *   order of the player's class, then wait ~100 m ahead for a few minutes
 *   (real traffic has the radar and the traffic widget to itself);
 * - battle: a classmate ~0.8 s ahead that the player slowly catches and one
 *   ~1.2 s behind slowly closing in, both scripted in time gap to the player;
 * - a classmate pits right away, another one goes off, gets a meatball and
 *   pits for repairs, a car of the other class gets a black flag, the battle
 *   car ahead a warning (furled black flag) for a while;
 * - most cars on hards, a few on wets (the compounds are only named for the
 *   player's car model, as in iRacing);
 * - everyone else races freely, some a lap or two up or down: the LMP2s
 *   (~9 % quicker) lap the GT3 player every few minutes, with the blue flag
 *   on the player while one is within 3 s behind, and the player catches slow
 *   lapped classmates (backmarkers) up the road.
 *
 * Later in each session (MOCK_TIMELINE): a car stops on track ahead of the
 * player (twice), another runs off the track ahead of it, a short caution
 * (then the green flag for a few seconds), and the player's own pit stop at
 * 60 km/h, with a late limiter (the scripted battles and escorts carry on
 * without it). When the clock runs out the overall leader takes the
 * chequered flag at its next crossing (white flag on its last lap),
 * everybody else at theirs; cool-down; then MockSeries starts the next session.
 */
export {
  MOCK_CAR_SLOTS,
  MOCK_PIT_SPEED_LIMIT_KMH,
  MOCK_RACE_LENGTH_S,
  MOCK_SESSION_ID,
  MOCK_SUBSESSION_ID,
  MOCK_TRACK_LENGTH_M
} from './constants'
export { MockRace, estCurve } from './race'
export type { MockCast, MockRaceOptions, MockRacePhase } from './race'
export { MockSeries } from './series'
export type { MockSeriesOptions } from './series'
export { MOCK_TIMELINE } from './scenarios'
export type { MockEvent, MockEventKind, MockTimeline } from './scenarios'
export type { MockQualifyResult, MockSessionInfo, MockYamlDriver } from './sessionInfo'
export { mulberry32 } from './rng'
export { spotterState } from './traffic'
