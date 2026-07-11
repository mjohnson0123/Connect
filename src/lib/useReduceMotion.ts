import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** OS reduce-motion preference; animated components degrade to fades/static. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => mounted && setReduce(!!v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduce(!!v));
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}
