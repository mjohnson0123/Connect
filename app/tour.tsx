import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui';
import { useStore } from '../src/store/useStore';
import { color, font, space, type } from '../src/theme/tokens';

/**
 * First-run feature tour: horizontally paged, skippable, shown once after
 * account creation and re-openable anytime from the You tab. Ink surface —
 * this is a "board" moment, matching the welcome screen's world.
 */

const SLIDES: { glyph: string; eyebrow: string; title: string; body: string }[] = [
  {
    glyph: '▤',
    eyebrow: 'THE BOARD',
    title: 'Add the trips you already take',
    body: 'A train line, a flight route, a terminal you pass through. Your board reads like a departure board — each row is a route you ride, and how many people on it are open to talking.',
  },
  {
    glyph: '⇌',
    eyebrow: 'CHECK IN',
    title: 'Visible only when you say so',
    body: 'Tap “I’m traveling now” and you’re discoverable to people on that route — for up to 3 hours, ending automatically. It never uses your location, and it never runs in the background. Set a reminder and you’ll get a nudge before your usual travel time.',
  },
  {
    glyph: '◇',
    eyebrow: 'CONNECT',
    title: 'Find people, by route or by field',
    body: 'Search people who share your industry, or see who’s on your line right now. Everyone appears as initials — no names, no photos — until you both say yes. Requests need a reason; pitches aren’t allowed.',
  },
  {
    glyph: '#',
    eyebrow: 'MEET SAFELY',
    title: 'Chat in-app, verify in person',
    body: 'Conversations stay text-only in the app — phone numbers and emails can’t be sent, by either of you. Meeting up? One of you shows a 6-digit code, the other types it in — so you know it’s really them.',
  },
  {
    glyph: '●',
    eyebrow: 'YOUR CONTROLS',
    title: 'You run your visibility',
    body: 'Block instantly and silently. Report anything — a person reviews every report. End check-ins early, edit your profile, or delete your account anytime from the You tab.',
  },
];

export default function Tour() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const insets = useSafeAreaInsets();
  const setTourSeen = useStore((s) => s.setTourSeen);
  const [page, setPage] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const scrollRef = useRef<Animated.FlatList<(typeof SLIDES)[number]>>(null);
  const width = Dimensions.get('window').width;

  // Re-opened from the You tab → return there. Otherwise this is first-run
  // onboarding: route deterministically through the index gate (which sends
  // brand-new accounts on to verification). Never router.back() here — the
  // stack under the tour can be the welcome screen, and popping to it threw
  // freshly signed-up users out of the app.
  const fromYouTab = from === 'you';
  const finish = () => {
    setTourSeen();
    if (fromYouTab && router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (page >= SLIDES.length - 1) {
      finish();
      return;
    }
    // Advance state directly: programmatic scrolls don't reliably fire
    // momentum-end on every platform, so the button must not depend on it.
    const target = page + 1;
    setPage(target);
    scrollRef.current?.scrollToOffset({ offset: target * width, animated: true });
  };

  const last = page === SLIDES.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(6) }]}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>COMMUTER CONNECT</Text>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Skip tour">
          <Text style={styles.skip}>SKIP</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}>
      <Animated.FlatList
        ref={scrollRef}
        data={SLIDES}
        keyExtractor={(s) => s.eyebrow}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, height: listHeight || undefined }]}>
            <View style={styles.glyphTile}>
              <Text style={styles.glyph}>{item.glyph}</Text>
            </View>
            <Text style={styles.eyebrow}>{item.eyebrow}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      </View>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Button label={last ? (fromYouTab ? 'Done' : 'Continue') : 'Next'} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(6),
  },
  wordmark: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.5, color: color.textMutedOnInk },
  skip: { fontFamily: font.mono, fontSize: 12, letterSpacing: 1, color: color.amberOnInk, padding: space(2) },
  slide: {
    paddingHorizontal: space(6),
    justifyContent: 'center',
    paddingBottom: space(12), // optical center: sit slightly above true middle
    gap: space(4),
  },
  glyphTile: {
    width: 72,
    height: 88,
    borderRadius: 14,
    backgroundColor: color.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontFamily: font.mono, fontSize: 34, color: color.amberOnInk },
  eyebrow: { ...type.monoSmall, color: color.amberOnInk },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 33, color: color.chalk },
  body: { ...type.body, fontSize: 16, lineHeight: 24, color: color.textMutedOnInk },
  footer: { paddingHorizontal: space(6), gap: space(5) },
  dots: { flexDirection: 'row', gap: space(2), justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.inkSoft },
  dotActive: { backgroundColor: color.amber, width: 20 },
});
