import { describe, expect, it } from 'vitest'
import {
  PROJECT_PAGES,
  PROJECT_URL,
  SUPPORT_URL,
  hasSupportLink,
  isProjectPage,
  projectUrl
} from './projectLinks'

describe('the project pages (Acerca de y ayuda)', () => {
  it('are all on the repository, apart from the donations page', () => {
    expect(PROJECT_URL).toBe('https://github.com/jesus-molano/OverLap')
    expect(projectUrl('guide')).toBe(`${PROJECT_URL}#readme`)
    expect(projectUrl('guide', undefined, 'en')).toBe(`${PROJECT_URL}#readme`)
    expect(projectUrl('guide', undefined, 'es')).toBe(`${PROJECT_URL}/blob/main/README.es.md`)
    expect(projectUrl('issues')).toBe(`${PROJECT_URL}/issues`)
    expect(projectUrl('source')).toBe(PROJECT_URL)
    expect(projectUrl('licence')).toBe(`${PROJECT_URL}/blob/main/LICENSE`)
    expect(projectUrl('notices')).toBe(`${PROJECT_URL}/blob/main/THIRD_PARTY_NOTICES.md`)
  })

  it('offer «Apoyar OverLap» only with a real https page', () => {
    expect(projectUrl('support', '')).toBeNull()
    expect(hasSupportLink('')).toBe(false)
    expect(isProjectPage('support', '')).toBe(false)
    for (const bad of ['ko-fi.com/x', 'http://ko-fi.com/x', 'javascript:alert(1)', 'https://']) {
      expect(projectUrl('support', bad), bad).toBeNull()
    }
    expect(projectUrl('support', 'https://ko-fi.com/someone')).toBe('https://ko-fi.com/someone')
    expect(isProjectPage('support', 'https://ko-fi.com/someone')).toBe(true)
  })

  it('has the donations page empty or a real one, never a placeholder shown to users', () => {
    // Filled in once the Ko-fi account exists (projectLinks.ts, the one place).
    if (SUPPORT_URL === '') expect(hasSupportLink()).toBe(false)
    else expect(SUPPORT_URL).toMatch(/^https:\/\/(ko-fi\.com|github\.com\/sponsors)\/[\w-]+$/)
  })

  it('names a page, never an address', () => {
    for (const page of PROJECT_PAGES.filter((p) => p !== 'support')) {
      expect(isProjectPage(page), page).toBe(true)
    }
    expect(isProjectPage('https://example.com')).toBe(false)
    expect(isProjectPage(undefined)).toBe(false)
    expect(isProjectPage('toString')).toBe(false)
  })
})
