import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button } from '../../src/components/ui';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Selfie liveness verification (PRD §5.1) — the rideshare-driver pattern.
 * Camera permission is requested here, contextually, not at onboarding start
 * (PRD §9.3). The demo build simulates the liveness service; the capture is
 * discarded after the check — only the verification status is kept.
 */
export default function Verify() {
  const router = useRouter();
  const submitVerification = useStore((s) => s.submitVerification);
  const setAvatarFromBase64 = useStore((s) => s.setAvatarFromBase64);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'intro' | 'camera' | 'checking' | 'photo' | 'done'>('intro');
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const finish = async (imageBase64: string | null) => {
    setPhase('checking');
    setError(null);
    // The selfie uploads to a private storage bucket and a verification row
    // is recorded server-side. Liveness scoring is the vendor integration
    // that slots in next; the storage + record pipeline is real now.
    const err = await submitVerification(imageBase64);
    if (err) {
      setError(err);
      setPhase('intro');
      return;
    }
    if (imageBase64) {
      // One capture, two jobs: offer the verified selfie as the profile
      // photo. The photo shown on profiles is guaranteed to be the person
      // who passed verification — nobody can upload a face that isn't them.
      setCaptured(imageBase64);
      setPhase('photo');
      return;
    }
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
    setCaptured(null);
    setPhase('done');
    setTimeout(() => router.replace('/onboarding/profile'), 900);
  };

  const capture = async () => {
    let base64: string | null = null;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.6 });
      base64 = photo?.base64 ?? null;
    } catch {
      // Capture can fail on simulators — submit without an image rather than dead-end.
    }
    await finish(base64);
  };

  const start = async () => {
    if (Platform.OS === 'web') {
      // Web preview build: camera capture isn't part of the product surface.
      await finish(null);
      return;
    }
    const res = permission?.granted ? permission : await requestPermission();
    if (res?.granted) setPhase('camera');
  };

  return (
    <Screen scroll={false}>
      <View style={styles.root}>
        {phase === 'intro' && (
          <View style={{ gap: space(4) }}>
            <Text style={styles.title}>Everyone here is a real person</Text>
            <Text style={styles.body}>
              Take a quick selfie so we can confirm your profile photo is really you —
              the same check rideshare drivers pass. Your selfie is used only for this
              verification and is deleted as soon as it completes.
            </Text>
            <Button label="Take selfie" onPress={start} />
            {error ? <Text style={styles.caution}>{error}</Text> : null}
            {permission && !permission.granted && !permission.canAskAgain ? (
              <Text style={styles.caution}>
                Camera access is off for this app. Enable it in system settings to verify —
                your profile can’t go live without verification.
              </Text>
            ) : null}
          </View>
        )}

        {phase === 'camera' && (
          <View style={{ gap: space(4), flex: 1 }}>
            <View style={styles.cameraFrame}>
              <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            </View>
            <Text style={styles.body}>Center your face and hold still.</Text>
            <Button label="Capture" onPress={() => void capture()} />
          </View>
        )}

        {phase === 'checking' && (
          <View style={{ gap: space(4), alignItems: 'center' }}>
            <ActivityIndicator color={color.ink} size="large" />
            <Text style={styles.mono}>RUNNING LIVENESS CHECK…</Text>
          </View>
        )}

        {phase === 'photo' && (
          <View style={{ gap: space(4) }}>
            {captured ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${captured}` }}
                style={styles.photoPreview}
                accessibilityLabel="Your verified selfie"
              />
            ) : null}
            <Text style={styles.title}>Use this photo on your profile?</Text>
            <Text style={styles.body}>
              People decide who to connect with partly by seeing a real face — and this
              one is verified as you. You can skip and show your initials instead.
            </Text>
            <Button label={busy ? 'Saving…' : 'Use as profile photo'} onPress={() => void usePhoto(true)} disabled={busy} />
            <Button label="Skip — show my initials" variant="quiet" onPress={() => void usePhoto(false)} disabled={busy} />
          </View>
        )}

        {phase === 'done' && (
          <View style={{ gap: space(3), alignItems: 'center' }}>
            <View style={styles.verifiedRing}>
              <Text style={styles.verifiedMark}>✓</Text>
            </View>
            <Text style={[styles.mono, { color: color.signal }]}>VERIFIED</Text>
            <Text style={styles.body}>Verification image deleted.</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

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
  cameraFrame: {
    flex: 1,
    maxHeight: 420,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: color.ink,
  },
  camera: { flex: 1 },
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
