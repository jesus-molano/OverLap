/**
 * The text of anything thrown. Never throws itself (an object without toString, a throwing
 * getter): it runs inside catch blocks that must not fail.
 */
export function errorMessage(err: unknown): string {
  try {
    return err instanceof Error ? err.message : String(err)
  } catch {
    return 'unknown error'
  }
}

const NATIVE_SDK_MISSING = 'NativeSdkMissingError'

/**
 * The iRacing SDK's native addon did not load (@irsdk-node/native fell back
 * to its MockSDK): the status says so with the 'native-missing' note instead
 * of a generic error.
 */
export class NativeSdkMissingError extends Error {
  constructor() {
    super('The iRacing SDK native module could not be loaded')
    this.name = NATIVE_SDK_MISSING
  }
}

/**
 * A NativeSdkMissingError, also from another copy of this module (by name:
 * tests reload modules). Never throws.
 */
export function isNativeSdkMissing(err: unknown): boolean {
  try {
    return (
      err instanceof NativeSdkMissingError ||
      (err instanceof Error && err.name === NATIVE_SDK_MISSING)
    )
  } catch {
    return false
  }
}
