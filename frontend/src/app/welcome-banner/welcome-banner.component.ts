/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Component, type OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { ConfigurationService } from '../Services/configuration.service'
import { MatDialogRef } from '@angular/material/dialog'
import { CookieService } from 'ngy-cookie'
import { TranslateModule } from '@ngx-translate/core'

import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-welcome-banner',
  templateUrl: 'welcome-banner.component.html',
  styleUrls: ['./welcome-banner.component.scss'],
  imports: [MatButtonModule, MatIconModule, TranslateModule]
})
export class WelcomeBannerComponent implements OnInit {
  dialogRef = inject<MatDialogRef<WelcomeBannerComponent>>(MatDialogRef)
  private readonly configurationService = inject(ConfigurationService)
  private readonly cookieService = inject(CookieService)

  public title = 'Welcome to OWASP Juice Shop'
  public message = '<p>Fresh juices, smoothies and shop merchandise, delivered to your door.</p>'

  private readonly welcomeBannerStatusCookieKey = 'welcomebanner_status'

  ngOnInit (): void {
    this.configurationService.getApplicationConfiguration().subscribe({
      next: (config) => {
        if (config?.application?.welcomeBanner) {
          this.title = config.application.welcomeBanner.title
          this.message = config.application.welcomeBanner.message
        }
      },
      error: (err) => { console.log(err) }
    })
  }

  closeWelcome (): void {
    this.dialogRef.close()
    const expires = new Date()
    expires.setFullYear(expires.getFullYear() + 1)
    this.cookieService.put(this.welcomeBannerStatusCookieKey, 'dismiss', { expires })
  }
}
