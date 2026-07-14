/**
 * Face Liveness page — bundled by scripts/build-liveness-web.mjs into a
 * single self-contained HTML string (src/generated/livenessHtml.ts) that the
 * app loads in a WebView. AWS ships no React Native liveness component, so
 * the official web detector runs here; the WebView grants it the camera.
 *
 * The page receives { sessionId, region, identityPoolId } via window.__CONFIG__
 * (placeholders substituted by the app at runtime) and reports back through
 * window.ReactNativeWebView.postMessage: {type: 'complete' | 'cancel' | 'error'}.
 * It holds no secrets — the identity pool grants guest access scoped to
 * rekognition:StartFaceLivenessSession only; session results are fetched
 * server-side by the liveness Edge Function.
 */
import { ThemeProvider } from '@aws-amplify/ui-react';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import { Amplify } from 'aws-amplify';
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@aws-amplify/ui-react/styles.css';

declare global {
  interface Window {
    __CONFIG__: { sessionId: string; region: string; identityPoolId: string };
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

const cfg = window.__CONFIG__;

Amplify.configure({
  Auth: { Cognito: { identityPoolId: cfg.identityPoolId, allowGuestAccess: true } },
});

const post = (msg: Record<string, unknown>) =>
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));

function App() {
  return (
    <ThemeProvider>
      <FaceLivenessDetector
        sessionId={cfg.sessionId}
        region={cfg.region}
        // The app's own intro screen is the start screen (it carries the
        // camera-permission ask and the photosensitivity warning), so AWS's
        // "Get ready" page — whose begin button sat below the fold on tall
        // camera previews — is skipped and the check starts immediately.
        disableStartScreen
        onAnalysisComplete={async () => post({ type: 'complete' })}
        onUserCancel={() => post({ type: 'cancel' })}
        onError={(err) =>
          post({ type: 'error', message: String(err?.error?.message ?? 'liveness error') })
        }
      />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
