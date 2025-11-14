import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TenantMetaService } from './services/tenant-meta-service';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  private route = inject(ActivatedRoute);
  private tenantMetaService = inject(TenantMetaService);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const tenantId = params['id'];
      
      if (tenantId) {
        // This works on both server AND client!
        this.tenantMetaService.loadAndApplyTenantMeta(tenantId).subscribe();
      }
    });
  }

}
