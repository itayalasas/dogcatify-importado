const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withAndroidManifest,
  withXcodeProject,
  IOSConfig,
} = require('expo/config-plugins');

// Hand-written native code for push notifications that isn't captured by
// any Expo module/plugin, so a full `expo prebuild` (which fully wipes and
// regenerates android/ and ios/ whenever the native project structure
// changes across an Expo SDK bump) silently deletes it unless something
// re-adds it every time. Source of truth lives in plugins/native/, outside
// the folders prebuild manages, and this plugin copies + re-registers it
// on every prebuild:
//
// - Android: MyFirebaseMessagingService.kt (handles FCM messages received
//   while the app is backgrounded) + its <service> entry in
//   AndroidManifest.xml.
// - iOS: FCMTokenModule.swift/.m (native module exposing getFCMToken() to
//   JS — see contexts/NotificationContext.tsx) + their entries in the
//   Xcode project so they actually get compiled, not just copied.

const ANDROID_SERVICE_NAME = 'MyFirebaseMessagingService';
const IOS_SOURCE_FILES = ['FCMTokenModule.swift', 'FCMTokenModule.m'];

function withAndroidFcmService(config) {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const packagePath = (config.android?.package || '').split('.').join(path.sep);
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath
      );
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(
        path.join(config.modRequest.projectRoot, 'plugins', 'native', 'android', `${ANDROID_SERVICE_NAME}.kt`),
        path.join(destDir, `${ANDROID_SERVICE_NAME}.kt`)
      );
      return config;
    },
  ]);

  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    if (!application.service) {
      application.service = [];
    }

    const alreadyRegistered = application.service.some(
      (service) => service.$?.['android:name'] === `.${ANDROID_SERVICE_NAME}`
    );

    if (!alreadyRegistered) {
      application.service.push({
        $: {
          'android:name': `.${ANDROID_SERVICE_NAME}`,
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }],
          },
        ],
      });
    }

    return config;
  });
}

function withIosFcmTokenModule(config) {
  return withXcodeProject(config, (config) => {
    const iosDir = config.modRequest.platformProjectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const destDir = path.join(iosDir, projectName);
    fs.mkdirSync(destDir, { recursive: true });

    const project = config.modResults;

    for (const fileName of IOS_SOURCE_FILES) {
      fs.copyFileSync(
        path.join(config.modRequest.projectRoot, 'plugins', 'native', 'ios', fileName),
        path.join(destDir, fileName)
      );

      // addBuildSourceFileToGroup already skips gracefully (with a warning)
      // if the file is already linked in the group, so no need to
      // duplicate that check here.
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: `${projectName}/${fileName}`,
        groupName: projectName,
        project,
      });
    }

    return config;
  });
}

module.exports = function withNativePushModules(config) {
  config = withAndroidFcmService(config);
  config = withIosFcmTokenModule(config);
  return config;
};
