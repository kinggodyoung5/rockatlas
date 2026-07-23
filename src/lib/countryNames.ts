const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['ko'], { type: 'region' })
  : null

/** Localizes an ISO 3166-1 alpha-2 country code to its Korean name via the browser's built-in region data.
 *  Covers every real-world country code automatically — no manual mapping table to maintain as new
 *  countries appear in the catalog. Falls back to the raw code if the browser lacks Intl.DisplayNames
 *  or the code isn't recognized. */
export function countryName(code: string): string {
  if (!code) return code
  try {
    return regionNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
