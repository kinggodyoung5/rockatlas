import { describe, expect, it } from 'vitest'
import { defaultRoute, parseExplorerRoute, routeToSearch } from './explorerRoute'

describe('explorer routes', () => {
  it('round-trips supported filters', () => {
    const route = {
      ...defaultRoute(),
      view: 'bands' as const,
      genreId: 'pop-soft-rock' as const,
      quickMoodId: 'bright-upbeat' as const,
      selectedMoodIds: ['groovy-danceable' as const],
      query: 'Dream Theater',
      eraId: '1990s' as const,
      countryCode: 'US',
      sort: 'formed-desc' as const,
    }
    expect(parseExplorerRoute(routeToSearch(route))).toEqual(route)
  })

  it('falls back safely for unknown enum values', () => {
    const route = parseExplorerRoute('?view=unknown&genre=not-real&mood=nope&era=1800s&sort=random')
    expect(route).toMatchObject(defaultRoute())
  })
})
