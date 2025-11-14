import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { TransferState, makeStateKey } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { TenantConfigResponse } from '../types/tenant-config';

const TENANT_CONFIG_KEY = makeStateKey<any>('tenantConfig');

@Injectable({
  providedIn: 'root'
})
export class TenantMetaService {
  private apiService = inject(ApiService);
  private title = inject(Title);
  private meta = inject(Meta);
  private transferState = inject(TransferState);
  private platformId = inject(PLATFORM_ID);

  private isServer = isPlatformServer(this.platformId);

  loadAndApplyTenantMeta(tenantId: string): Observable<TenantConfigResponse | null> {
    // Check if we already have the config from SSR (client-side only)
    const cachedConfig = this.transferState.get(TENANT_CONFIG_KEY, null);
    
    if (cachedConfig) {
      console.log('Using cached tenant config from SSR');
      this.applyMetaTags(cachedConfig);
      return of(cachedConfig);
    }

    // Fetch the config using your existing ApiService
    console.log('Fetching tenant config for:', tenantId);
    
    return this.apiService.getTenantConfig(tenantId).pipe(
      tap(response => {
        if (response.success && response.config) {
          console.log('Tenant config loaded:', response.config.business_name);
          
          // Store in transfer state if on server
          if (this.isServer) {
            this.transferState.set(TENANT_CONFIG_KEY, response);
            console.log('Stored in TransferState for client');
          }
          
          // Apply meta tags
          this.applyMetaTags(response);
        }
      }),
      catchError(error => {
        console.error('Error loading tenant config:', error);
        this.setDefaultMeta();
        return of(null);
      })
    );
  }

  private applyMetaTags(response: TenantConfigResponse): void {
    if (!response.success || !response.config) {
      this.setDefaultMeta();
      return;
    }

    const config = response.config;
    const businessName = config.business_name || 'Local Contact Forms';
    
    this.title.setTitle(businessName);
    console.log('Set page title to:', businessName);

    if (config.meta_description) {
      this.meta.updateTag({ name: 'description', content: config.meta_description });
    }

    if (config.meta_keywords) {
      this.meta.updateTag({ name: 'keywords', content: config.meta_keywords });
    }
  }

  private setDefaultMeta(): void {
    this.title.setTitle('Local Contact Forms');
    this.meta.updateTag({ name: 'description', content: 'Contact forms for local businesses' });
  }
}