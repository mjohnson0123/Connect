import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TripPattern } from '../domain/types';

/**
 * Check-in window reminders — the trust-safe version of "how does Waze know."
 *
 * Everything here is on-device: the user declared the window, so the phone
 * schedules weekly LOCAL notifications from that declaration. No server, no
 * push infrastructure, no location — the data never leaves the device, and
 * notification copy stays at the "your window" abstraction (PRD §5.8).
 */

const LEAD_MINUTES = 15;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function remindersSupported(): boolean {
  return Platform.OS !== 'web';
}

/** Request permission contextually (PRD §9.3) — only when the user flips the toggle. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported()) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Schedule one weekly reminder per pattern day, LEAD_MINUTES before the window opens. */
export async function schedulePatternReminders(pattern: TripPattern): Promise<string[]> {
  if (!remindersSupported()) return [];
  const [h, m] = pattern.windowStart.split(':').map(Number);
  const total = h * 60 + m - LEAD_MINUTES;
  const hour = ((Math.floor(total / 60) % 24) + 24) % 24;
  const minute = ((total % 60) + 60) % 60;

  const ids: string[] = [];
  for (const day of pattern.daysOfWeek) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Your window opens soon',
          body: `${pattern.routeOrLine} · ${pattern.windowStart}–${pattern.windowEnd}. Check in when you're traveling to be discoverable.`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo-notifications: 1 = Sunday
          hour,
          minute,
        },
      });
      ids.push(id);
    } catch {
      // Notification scheduling can be unavailable (e.g. Expo Go on Android);
      // the toggle simply stays off rather than crashing the flow.
    }
  }
  return ids;
}

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  await Promise.all(
    notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}
