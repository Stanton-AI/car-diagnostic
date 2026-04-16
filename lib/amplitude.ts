'use client';

import * as amplitude from '@amplitude/analytics-browser';

const API_KEY = '7309128946976262457feb17d8f1bb29';

let initialized = false;

export function initAmplitude() {
  if (initialized || typeof window === 'undefined') return;
  amplitude.init(API_KEY, undefined, {
    defaultTracking: {
      pageViews: true,
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
    },
  });
  initialized = true;
}

export function track(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  amplitude.track(eventName, properties);
}

export function setUser(userId: string) {
  if (typeof window === 'undefined') return;
  amplitude.setUserId(userId);
}
