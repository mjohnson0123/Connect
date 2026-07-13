const { withGradleProperties } = require('expo/config-plugins');

/**
 * Shrinks the installable APK by dropping the two emulator-only CPU
 * architectures (x86, x86_64) from the native build. Real Android phones run
 * arm64-v8a (modern) or armeabi-v7a (older); x86/x86_64 only exist on
 * emulators, so removing them cannot affect any physical device — it just
 * stops bundling ~40–50 MB of unusable machine code.
 *
 * React Native's build.gradle reads `reactNativeArchitectures` to decide which
 * ABIs to compile and include, so setting it here is the supported knob.
 */
module.exports = function withReducedApkSize(config) {
  return withGradleProperties(config, (cfg) => {
    const KEY = 'reactNativeArchitectures';
    const VALUE = 'arm64-v8a,armeabi-v7a';
    const existing = cfg.modResults.find((p) => p.type === 'property' && p.key === KEY);
    if (existing) existing.value = VALUE;
    else cfg.modResults.push({ type: 'property', key: KEY, value: VALUE });
    return cfg;
  });
};
