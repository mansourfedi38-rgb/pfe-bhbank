import { NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Agency, ApiService, ChatbotResponse, MonthlyEnergyKpi } from '../../services/api.service';
import { SupportedLanguageCode, supportedLanguages } from '../../language/supported-languages';

type ChatMessage = {
  sender: 'user' | 'assistant';
  text: string;
};

@Component({
  selector: 'app-energy-assistant',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule],
  templateUrl: './energy-assistant.html',
  styleUrl: './energy-assistant.scss'
})
export class EnergyAssistantComponent implements OnInit, OnDestroy {
  @ViewChild('messagesPanel') private messagesPanel?: ElementRef<HTMLDivElement>;

  isOpen = false;
  isLoading = false;
  errorMessage = '';
  draftMessage = '';
  selectedMonth = '';
  selectedAgencyId: number | null = null;
  availableMonths: string[] = [];
  agencies: Agency[] = [];
  suggestions: string[] = [];
  messages: ChatMessage[] = [];
  private languageSubscription?: Subscription;

  constructor(
    private api: ApiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.messages = [{ sender: 'assistant', text: this.translate.instant('energyAssistant.welcome') }];
    this.refreshLocalSuggestions();
    this.loadContext();
    this.languageSubscription = this.translate.onLangChange.subscribe(() => {
      this.refreshLocalSuggestions();
      if (this.messages.length === 1 && this.messages[0].sender === 'assistant') {
        this.messages[0].text = this.translate.instant('energyAssistant.welcome');
      }
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
  }

  private refreshLocalSuggestions(): void {
    this.suggestions = [
      this.translate.instant('energyAssistant.suggestions.platform'),
      this.translate.instant('energyAssistant.suggestions.modules'),
      this.translate.instant('energyAssistant.suggestions.alerts'),
      this.translate.instant('energyAssistant.suggestions.aiDetector')
    ];
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.scrollSoon();
    }
  }

  closeChat(): void {
    this.isOpen = false;
  }

  sendSuggestion(suggestion: string): void {
    this.draftMessage = suggestion;
    this.sendMessage();
  }

  sendMessage(): void {
    const message = this.draftMessage.trim();
    if (!message || this.isLoading) return;

    this.messages.push({ sender: 'user', text: message });
    this.draftMessage = '';
    this.errorMessage = '';
    this.isLoading = true;
    this.scrollSoon();

    this.api.askChatbot({
      message,
      month: this.selectedMonth || undefined,
      agency_id: this.selectedAgencyId,
      language: this.currentLanguage
    })
      .subscribe({
        next: (response: ChatbotResponse) => {
          this.isLoading = false;
          this.applyResolvedContext(response);
          this.messages.push({ sender: 'assistant', text: response.reply });
          this.suggestions = response.suggestions?.length ? response.suggestions : this.suggestions;
          this.scrollSoon();
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = this.translate.instant('energyAssistant.error');
          this.scrollSoon();
        }
      });
  }

  private loadContext(): void {
    this.api.getMonthlyEnergyKpi().subscribe({
      next: (rows) => this.applyMonths(rows),
      error: () => {
        this.availableMonths = [];
      }
    });

    this.api.getAgencies().subscribe({
      next: (agencies) => {
        this.agencies = agencies;
      },
      error: () => {
        this.agencies = [];
      }
    });
  }

  private applyMonths(rows: MonthlyEnergyKpi[]): void {
    this.availableMonths = Array.from(new Set(rows.map((row) => row.month))).sort();
    this.selectedMonth = this.availableMonths[this.availableMonths.length - 1] || '';
  }

  private applyResolvedContext(response: ChatbotResponse): void {
    if (response.month) {
      if (!this.availableMonths.includes(response.month)) {
        this.availableMonths = [...this.availableMonths, response.month].sort();
      }
      this.selectedMonth = response.month;
    }

    if (response.agency_id !== undefined) {
      this.selectedAgencyId = response.agency_id;
    }
  }

  private get currentLanguage(): SupportedLanguageCode {
    const candidate = this.translate.currentLang as SupportedLanguageCode | undefined;
    return candidate && supportedLanguages.includes(candidate) ? candidate : 'en';
  }

  private scrollSoon(): void {
    setTimeout(() => {
      this.scrollToBottom();
      requestAnimationFrame(() => this.scrollToBottom());
    }, 0);
  }

  private scrollToBottom(): void {
    const panel = this.messagesPanel?.nativeElement;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }
}
