import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
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
  const completeVerification = useStore((s) => s.completeVerification);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'intro' | 'camera' | 'checking' | 'done'>('intro');
  const cameraRef = useRef<CameraView>(null);

  const finish = () => {
    setPhase('checking');
    // Simulated liveness service round-trip; the verified flag is set
    // server-side (complete_verification RPC). Production: capture → encrypted
    // upload → vendor liveness + face-match → delete image → webhook sets flag.
    setTimeout(() => {
      void completeVerification().then(() => {
        setPhase('done');
        setTimeout(() => router.replace('/onboarding/profile'), 900);
      });
    }, 1800);
  };

  const capture = async () => {
    try {
      await cameraRef.current?.takePictureAsync({ skipProcessing: true });
    } catch {
      // Capture can fail on simulators/web — the simulated check proceeds regardless.
    }
    finish();
  };

  const start = async () => {
    if (Platform.OS === 'web') {
      // Web preview build: camera capture isn't part of the product surface.
      finish();
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
            <Button label="Capture" onPress={capture} />
          </View>
        )}

        {phase === 'checking' && (
          <View style={{ gap: space(4), alignItems: 'center' }}>
            <ActivityIndicator color={color.ink} size="large" />
            <Text style={styles.mono}>RUNNING LIVENESS CHECK…</Text>
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
