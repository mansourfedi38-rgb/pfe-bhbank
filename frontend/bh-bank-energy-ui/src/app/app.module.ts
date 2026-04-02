import { NgModule, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { TranslateHttpLoader, TRANSLATE_HTTP_LOADER_CONFIG } from '@ngx-translate/http-loader';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';

import { supportedLanguages } from './language/supported-languages';

function applyRtlIfNeeded(lang: string) {
  if (typeof document === 'undefined') return;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

export function translateInitializer(translate: TranslateService) {
  return () => {
    const stored =
      typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null;
    const safeStored = stored ?? 'en';
    const lang = supportedLanguages.includes(safeStored as any) ? (safeStored as any) : 'en';

    translate.setDefaultLang('en');
    translate.use(lang);
    applyRtlIfNeeded(lang);
  };
}

@NgModule({
  imports: [
    HttpClientModule,
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: { provide: TranslateLoader, useClass: TranslateHttpLoader }
    })
  ],
  providers: [
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useValue: { prefix: '/assets/i18n/', suffix: '.json' }
    },
    {
      provide: APP_INITIALIZER,
      useFactory: translateInitializer,
      deps: [TranslateService],
      multi: true
    }
  ]
})
export class AppModule {}

