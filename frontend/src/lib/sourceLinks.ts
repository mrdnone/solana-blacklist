import type { ContactInfo } from '../api/types'

export interface AppealLink {
  label: string
  href: string
  /** 'discord' | 'telegram' | 'web' */
  kind: 'discord' | 'telegram' | 'web'
}

/**
 * Returns ordered appeal links from a ContactInfo object.
 * Priority: discord > telegram > website.
 */
export function getAppealLinks(info: ContactInfo | null | undefined): AppealLink[] {
  if (!info) return []
  const links: AppealLink[] = []
  if (info.discord) links.push({ label: 'Discord', href: info.discord, kind: 'discord' })
  if (info.telegram) links.push({ label: 'Telegram', href: info.telegram, kind: 'telegram' })
  if (info.website) links.push({ label: 'Website', href: info.website, kind: 'web' })
  return links
}
