import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  readonly socialLinks = [
    {
      name: 'LinkedIn',
      href: 'https://www.linkedin.com/company/bh-bank',
      iconClass: 'fa-brands fa-linkedin-in',
    },
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/bh_bank/',
      iconClass: 'fa-brands fa-instagram',
    },
    {
      name: 'Facebook',
      href: 'https://www.facebook.com/BHBank',
      iconClass: 'fa-brands fa-facebook-f',
    },
    {
      name: 'YouTube',
      href: 'https://www.youtube.com/channel/UCRw2rFa-9RhCg7Mq1q4Q7Sg',
      iconClass: 'fa-brands fa-youtube',
    },
  ];
}
