import { ExpoRoot } from 'expo-router';
import React from 'react';

/**
 * Entry shim for environments that expect an App component (Expo Snack's
 * GitHub import, for one). Normal builds ignore this file — package.json
 * "main" points at expo-router/entry, which registers the root itself.
 */
export default function App() {
  const ctx = (require as { context?: (path: string) => unknown }).context?.('./app');
  return <ExpoRoot context={ctx as Parameters<typeof ExpoRoot>[0]['context']} />;
}
