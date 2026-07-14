import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Remote push registration (messages / requests / accepts). The server's
 * notify_user() posts to Expo's push API; this side just registers the
 * device token. Requires FCM credentials on the EAS project — until those
 * exist, getExpoPushTokenAsync throws and we return null so the app runs
 * normally, only quieter.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return null;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('social', {
        name: 'Messages & requests',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200],
      });
    }
    const projectId: string | undefined =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId ?? undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data ?? null;
  } catch {
    return null;
  }
}
