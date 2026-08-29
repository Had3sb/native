import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Tactile feedback helpers. Every call is fire-and-forget and swallows
// errors: haptics are a nicety, never a dependency. Callers outside this
// area (SwipeableRow, destructive confirms) should use these rather than
// importing expo-haptics directly so the "off" switch stays in one place.

export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

let enabled = true;

/** Global kill switch (e.g. when the user disables animations). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function haptic(kind: HapticKind = 'light'): void {
  if (!enabled || Platform.OS === 'web') return;
  let promise: Promise<void>;
  try {
    switch (kind) {
      case 'selection':
        promise = Haptics.selectionAsync();
        break;
      case 'medium':
        promise = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        promise = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        promise = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        promise = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        promise = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'light':
      default:
        promise = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
    }
    void promise.catch(() => undefined);
  } catch {
    // native module missing (e.g. web / tests)
  }
}
