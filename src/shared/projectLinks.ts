import type { Language } from './i18n/language'

/**
 * The project's own pages, the only addresses the settings window can open (in the browser, and
 * only when a button is pressed: «Acerca de y ayuda»). The window names a page; main looks up its
 * address here, so no address ever comes from a page.
 */

/** The copyright line, the same in every language (the About page's «Licencia», the README). */
export const COPYRIGHT = '© 2026 Jesús Molano'

/** The repository: the source code, the guide (its README, README.es.md in Spanish), the issues. */
export const PROJECT_URL = 'https://github.com/jesus-molano/OverLap'

/**
 * “Support OverLap” (README.es.md: «Apoyar OverLap»): the donations page (Ko-fi, e.g.
 * 'https://ko-fi.com/<user>'). The one place to fill it in. Empty, there is no support link:
 * «Acerca de y ayuda» shows none and main refuses the command.
 */
export const SUPPORT_URL: string = ''

export const PROJECT_PAGES = ['guide', 'issues', 'source', 'licence', 'notices', 'support'] as const
export type ProjectPage = (typeof PROJECT_PAGES)[number]

/**
 * The address of `page`, null for the support page while SUPPORT_URL is empty. The guide is the
 * README in the interface's language: English in README.md, Spanish in README.es.md.
 */
export function projectUrl(
  page: ProjectPage,
  support: string = SUPPORT_URL,
  language: Language = 'en'
): string | null {
  switch (page) {
    case 'guide':
      return language === 'es' ? `${PROJECT_URL}/blob/main/README.es.md` : `${PROJECT_URL}#readme`
    case 'issues':
      return `${PROJECT_URL}/issues`
    case 'source':
      return PROJECT_URL
    case 'licence':
      return `${PROJECT_URL}/blob/main/LICENSE`
    case 'notices':
      return `${PROJECT_URL}/blob/main/THIRD_PARTY_NOTICES.md`
    case 'support':
      return /^https:\/\/\S+$/.test(support) ? support : null
  }
}

/** One of the pages, and one that has an address (the window's command, checked by main). */
export function isProjectPage(page: unknown, support: string = SUPPORT_URL): page is ProjectPage {
  return (
    typeof page === 'string' &&
    (PROJECT_PAGES as readonly string[]).includes(page) &&
    projectUrl(page as ProjectPage, support) !== null
  )
}

/** «Apoyar OverLap» is offered only once SUPPORT_URL is filled in. */
export const hasSupportLink = (support: string = SUPPORT_URL): boolean =>
  projectUrl('support', support) !== null
