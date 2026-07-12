import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Profile photo sources. All return base64 JPEG or null on cancel.
 * Square crop keeps avatars consistent everywhere.
 */

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  base64: true,
};

export async function pickProfilePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (result.canceled) return null;
  return result.assets[0]?.base64 ?? null;
}

export async function takeProfilePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ ...OPTIONS, cameraType: ImagePicker.CameraType.front });
  if (result.canceled) return null;
  return result.assets[0]?.base64 ?? null;
}

/** Tap-the-avatar flow: choose camera or library, resolve to base64 or null. */
export function chooseProfilePhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Profile photo', undefined, [
      { text: 'Take a new photo', onPress: () => void takeProfilePhoto().then(resolve) },
      { text: 'Choose from library', onPress: () => void pickProfilePhoto().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
