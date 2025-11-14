import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TenantConfigResponse,
  FormSubmissionResponse,
  FormSubmission
} from '../types/tenant-config';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {
    console.log('API Base URL:', this.apiBaseUrl);
  }

  getTenantConfig(tenantId: string): Observable<TenantConfigResponse> {
    const url = `${this.apiBaseUrl}/getTenantConfig?tenantId=${encodeURIComponent(tenantId)}`;
    console.log('Fetching tenant config from:', url);
    return this.http.get<TenantConfigResponse>(url);
  }

  submitForm(formData: FormSubmission): Observable<FormSubmissionResponse> {
    return this.http.post<FormSubmissionResponse>(
      `${this.apiBaseUrl}/submitForm`,
      formData
    );
  }
}