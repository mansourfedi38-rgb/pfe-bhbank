import { NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Agency, ApiService, ChatbotResponse, MonthlyEnergyKpi } from '../../services/api.service';

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
export class EnergyAssistantComponent implements OnInit {
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

  constructor(
    private api: ApiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.messages = [
      {
        sender: 'assistant',
        text: this.translate.instant('energyAssistant.welcome')
      }
    ];
    this.suggestions = [
      this.translate.instant('energyAssistant.suggestions.compare'),
      this.translate.instant('energyAssistant.suggestions.alerts'),
      this.translate.instant('energyAssistant.suggestions.recommendations')
    ];
    this.loadContext();
    this.translate.onLangChange.subscribe(() => {
      if (this.messages.length === 1 && this.messages[0].sender === 'assistant') {
        this.messages[0].text = this.translate.instant('energyAssistant.welcome');
      }
    });
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => this.scrollToBottom(), 0);
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
      agency_id: this.selectedAgencyId
    })
      .pipe(finalize(() => {
        this.isLoading = false;
        this.scrollSoon();
      }))
      .subscribe({
        next: (response: ChatbotResponse) => {
          this.messages.push({ sender: 'assistant', text: response.reply });
          this.suggestions = response.suggestions?.length ? response.suggestions : this.suggestions;
        },
        error: () => {
          this.errorMessage = this.translate.instant('energyAssistant.error');
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

  private scrollSoon(): void {
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private scrollToBottom(): void {
    const panel = this.messagesPanel?.nativeElement;
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  }
}
