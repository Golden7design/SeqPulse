export type LocalizedText = {
  key: string | null
  fallback: string
  params?: Record<string, string | number | boolean | null>
}

type Translate = (
  key: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => string

export function resolveLocalizedText(
  localized: LocalizedText | null | undefined,
  t: Translate,
  fallback?: string
): string {
  if (!localized) return fallback ?? ""
  if (!localized.key) return localized.fallback || fallback || ""
  const translated = t(localized.key, localized.params ?? {})
  if (!translated || translated === localized.key) {
    return localized.fallback || fallback || ""
  }
  return translated
}

export function resolveLocalizedList(
  localized: LocalizedText[] | undefined,
  t: Translate,
  fallback: string[] = []
): string[] {
  if (!localized || localized.length === 0) return fallback
  return localized.map((entry) => resolveLocalizedText(entry, t))
}

