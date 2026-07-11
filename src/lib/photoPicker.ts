import * as ImagePicker from 'expo-image-picker';

/**
 * System photo picker for profile pictures. Returns base64 JPEG or null if
 * the user cancels. Square crop keeps avatars consistent everywhere.
 */
export async function pickProfilePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (result.canceled) return null;
  return result.assets[0]?.base64 ?? null;
}
