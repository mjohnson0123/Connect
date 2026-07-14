import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import Screen from '../../src/components/Screen';
import { Button } from '../../src/components/ui';
import { chooseProfilePhoto } from '../../src/lib/photoPicker';
import { LIVENESS_HTML } from '../../src/generated/livenessHtml';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Selfie liveness verification (PRD §5.1) — the rideshare-driver pattern,
 * now backed by AWS Rekognition Face Liveness. The official AWS web detector
 * runs in a WebView (AWS ships no React Native component); sessions are
 * created and scored server-side by the liveness Edge Function, which is the
 * only path to verified status. Camera permission is requested here,
 * contextually, not at onboarding start (PRD §9.3). The web preview build
 * keeps the simulated path (no camera streaming in that environment).
 */
export default function Verify() {
  const router = useRouter();
  const submitVerification = useStore((s) => s.submitVerification);
  const startLiveness = useStore((s) => s.startLiveness);
  const finishLiveness = useStore((s) => s.finishLiveness);
  const setAvatarFromBase64 = useStore((s) => s.setAvatarFromBase64);
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'intro' | 'liveness' | 'checking' | 'photo' | 'done'>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const proceed = () => {
    setCaptured(null);
    setPhase('done');
    setTimeout(() => router.replace('/onboarding/profile'), 900);
  };

  const usePhoto = async (yes: boolean) => {
    if (yes && captured) {
      setBusy(true);
      const err = await setAvatarFromBase64(captured);
      setBusy(false);
      if (err) {
        setError(err);
      }
    }
    proceed();
  };

  const uploadDifferent = async () => {
    const picked = await chooseProfilePhoto();
    if (!picked) return; // cancelled — stay on the choice screen
    setBusy(true);
    const err = await setAvatarFromBase64(picked);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    proceed();
  };

  const scoreSession = async (id: string) => {
    setPhase('checking');
    const result = await finishLiveness(id);
    if (result.error) {
      setError(result.error);
      setPhase('intro');
      return;
    }
    if (!result.verified) {
      setError(
        'We couldn’t confirm a live face this time. Find even lighting, hold the phone at eye level, and try again.',
      );
      setPhase('intro');
      return;
    }
    if (result.referenceImage) {
      // One capture, two jobs: offer the verified frame as the profile photo.
      // A photo shown on a profile is guaranteed to be the person who passed
      // the check — nobody can upload a face that isn't them.
      setCaptured(result.referenceImage);
      setPhase('photo');
      return;
    }
    proceed();
  };

  const onWebViewMessage = (e: WebViewMessageEvent) => {
    let msg: { type?: string; message?: string } = {};
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'complete' && sessionId) void scoreSession(sessionId);
    if (msg.type === 'cancel') setPhase('intro');
    if (msg.type === 'error') {
      setError('The face check hit a snag. Check your connection and try again.');
      setPhase('intro');
    }
  };

  const start = async () => {
    setError(null);
    if (Platform.OS === 'web') {
      // Web preview build: no camera streaming here; the simulated path keeps
      // onboarding walkable until the kill switch flips at launch.
      setPhase('checking');
      const err = await submitVerification(null);
      if (err) {
        setError(err);
        setPhase('intro');
        return;
      }
      proceed();
      return;
    }
    // The WebView can only use the camera if the app itself holds the
    // permission — request it before opening the detector.
    const res = permission?.granted ? permission : await requestPermission();
    if (!res?.granted) return;
    setBusy(true);
    const session = await startLiveness();
    setBusy(false);
    if (session.error || !session.sessionId) {
      setError(session.error ?? 'Couldn’t start the face check.');
      return;
    }
    setSessionId(session.sessionId);
    setPhase('liveness');
  };

  if (phase === 'liveness') {
    const html = LIVENESS_HTML.replace('__SESSION_ID__', sessionId ?? '')
      .replace('__REGION__', process.env.EXPO_PUBLIC_AWS_REGION ?? 'us-east-1')
      .replace('__IDENTITY_POOL_ID__', process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID ?? '');
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.ink,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Slim top bar (tour-style) instead of a footer button: the AWS
            detector lays its own controls out at the bottom of the page, so
            every vertical pixel below the bar belongs to it. */}
        <View style={livenessStyles.topBar}>
          <Text style={livenessStyles.topBarTitle}>FACE CHECK</Text>
          <Pressable
            onPress={() => setPhase('intro')}
            accessibilityRole="button"
            accessibilityLabel="Cancel face check"
            hitSlop={10}
          >
            <Text style={livenessStyles.topBarCancel}>CANCEL</Text>
          </Pressable>
        </View>
        <WebView
          source={{ html, baseUrl: 'https://localhost' }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          onMessage={onWebViewMessage}
          style={{ flex: 1, backgroundColor: color.ink }}
        />
      </View>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.root}>
        {phase === 'intro' && (
          <View style={{ gap: space(4) }}>
            <Text style={styles.title}>Everyone here is a real person</Text>
            <Text style={styles.body}>
              A quick face check confirms there’s a live person behind this profile — the
              same check rideshare drivers pass. The scan starts as soon as you tap the
              button: center your face in the oval and hold still for a few seconds. It
              runs on Amazon’s verification service; your face data is used only for
              this check.
            </Text>
            <Text style={styles.caution}>
              The check briefly flashes colored lights. If you’re sensitive to flashing
              light, ask us for an alternative instead.
            </Text>
            <Button label={busy ? 'Starting…' : 'Start face check'} onPress={() => void start()} disabled={busy} />
            {error ? <Text style={styles.caution}>{error}</Text> : null}
            {permission && !permission.granted && !permission.canAskAgain ? (
              <Text style={styles.caution}>
                Camera access is off for this app. Enable it in system settings to verify —
                your profile can’t go live without verification.
              </Text>
            ) : null}
          </View>
        )}

        {phase === 'checking' && (
          <View style={{ gap: space(4), alignItems: 'center' }}>
            <ActivityIndicator color={color.ink} size="large" />
            <Text style={styles.mono}>CONFIRMING LIVENESS…</Text>
          </View>
        )}

        {phase === 'photo' && (
          <View style={{ gap: space(4) }}>
            {captured ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${captured}` }}
                style={styles.photoPreview}
                accessibilityLabel="Your verified photo"
              />
            ) : null}
            <Text style={styles.title}>Use this photo on your profile?</Text>
            <Text style={styles.body}>
              People decide who to connect with partly by seeing a real face — and this
              one is verified as you. You can skip and show your initials instead.
            </Text>
            <Button label={busy ? 'Saving…' : 'Use as profile photo'} onPress={() => void usePhoto(true)} disabled={busy} />
            <Button label="Use a different photo" variant="ink" onPress={() => void uploadDifferent()} disabled={busy} />
            <Button label="Skip — show my initials" variant="quiet" onPress={() => void usePhoto(false)} disabled={busy} />
          </View>
        )}

        {phase === 'done' && (
          <View style={{ gap: space(3), alignItems: 'center' }}>
            <View style={styles.verifiedRing}>
              <Text style={styles.verifiedMark}>✓</Text>
            </View>
            <Text style={[styles.mono, { color: color.signal }]}>VERIFIED</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const livenessStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(5),
    paddingVertical: space(3),
  },
  topBarTitle: { ...type.monoSmall, color: color.textMutedOnInk },
  topBarCancel: { ...type.monoSmall, fontSize: 12, color: color.amberOnInk },
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingBottom: space(10) },
  title: { ...type.title, color: color.textOnChalk },
  body: { ...type.body, color: color.textMutedOnChalk },
  caution: { ...type.caption, color: color.caution },
  mono: { ...type.mono, color: color.textOnChalk },
  photoPreview: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignSelf: 'center',
    backgroundColor: color.ink,
    borderWidth: 2,
    borderColor: color.signal,
  },
  verifiedRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: color.signalTintBg,
    borderWidth: 2,
    borderColor: color.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedMark: { fontSize: 40, color: color.signal },
});
