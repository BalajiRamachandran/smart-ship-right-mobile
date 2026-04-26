import { getApiBaseUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';
import { rootNavigationRef } from '../navigation/rootNavigationRef';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type SubmitFeedbackResult = { issue_number?: number; message?: string };

/**
 * Submit user feedback with optional screenshot (multipart), matching web FeedbackButton → POST /api/v1/support/feedback.
 */
export async function submitSupportFeedback(params: {
  message: string;
  screenshotUri?: string | null;
}): Promise<SubmitFeedbackResult> {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error('Not signed in');
  }

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/support/feedback`;

  const route = rootNavigationRef.getCurrentRoute();
  const pageContext =
    route != null
      ? `${route.name}${route.params ? ` ${JSON.stringify(route.params).slice(0, 200)}` : ''}`
      : 'mobile';

  const metadata = {
    message: params.message.trim(),
    page_url: `ship-right-mobile://${pageContext}`,
    user_agent: `SmartShipRightMobile/${Constants.expoConfig?.version ?? '1.0'} (${Platform.OS})`,
    timestamp: new Date().toISOString(),
  };

  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));

  if (params.screenshotUri) {
    formData.append('screenshot', {
      uri: params.screenshotUri,
      name: 'screenshot.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const err = (await response.json()) as { detail?: string; message?: string };
      detail = err.detail || err.message || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return (await response.json()) as SubmitFeedbackResult;
}
