// Providers used by every Angular test.
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideZoneChangeDetection } from '@angular/core';

const testProviders = [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter([]), provideHttpClient()];

export default testProviders;
