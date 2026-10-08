const { withAppBuildGradle } = require('expo/config-plugins');

// Expo's default android/app/build.gradle template signs the "release" build
// type with the debug.keystore checked into this repo (well-known public
// credentials android/androiddebugkey/android) — the "Caution! In
// production, you need to generate your own keystore file" comment below is
// the literal, never-customized template text. Every release build has
// therefore always been signed with the debug key, regardless of the real
// dogcatify-release.jks that azure-pipelines.yml downloads and exposes via
// ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS /
// ANDROID_KEY_PASSWORD — nothing in build.gradle ever read those env vars.
// Google Play rejects the upload once the app already has a different
// signing certificate on file. This mod adds a real "release" signingConfig
// sourced from those env vars, falling back to the debug keystore when
// they're absent (e.g. local `expo run:android`) so nothing else breaks.
function withReleaseSigningConfig(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('signingConfigs.release')) {
      return config;
    }

    const debugConfigBlock = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

    const withReleaseConfig = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def envKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (envKeystorePath) {
                storeFile file(envKeystorePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

    if (!contents.includes(debugConfigBlock)) {
      throw new Error(
        'withReleaseSigningConfig: expected signingConfigs block not found in android/app/build.gradle — the Expo template may have changed, update this plugin.'
      );
    }
    contents = contents.replace(debugConfigBlock, withReleaseConfig);

    const releaseBuildTypeAnchor = `release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    const releaseBuildTypeReplacement = `release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.release`;

    if (!contents.includes(releaseBuildTypeAnchor)) {
      throw new Error(
        'withReleaseSigningConfig: expected release buildType block not found in android/app/build.gradle — the Expo template may have changed, update this plugin.'
      );
    }
    contents = contents.replace(releaseBuildTypeAnchor, releaseBuildTypeReplacement);

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withReleaseSigningConfig;
