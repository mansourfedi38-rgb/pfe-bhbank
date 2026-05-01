export type SupportedLanguageCode = 'en' | 'fr' | 'ar';

export const supportedLanguages: SupportedLanguageCode[] = ['en', 'fr', 'ar'];

export const languageOptions: Array<{ code: SupportedLanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' }
];

export function isRtlLanguage(lang: SupportedLanguageCode): boolean {
  return lang === 'ar';
}
