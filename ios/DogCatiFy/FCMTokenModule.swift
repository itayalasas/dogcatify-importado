import FirebaseMessaging
import Foundation
import UIKit

private let latestFCMTokenDefaultsKey = "DogCatiFy.latestFCMToken"
private let maxFCMTokenAttempts = 4
private let fcmRetryDelaySeconds = 0.75

@objc(FCMTokenModule)
class FCMTokenModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(getFCMToken:rejecter:)
  func getFCMToken(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      UIApplication.shared.registerForRemoteNotifications()
      self.requestFCMToken(attempt: 1, resolve: resolve, reject: reject)
    }
  }

  private func requestFCMToken(
    attempt: Int,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Messaging.messaging().token { token, error in
      if let token, !token.isEmpty {
        UserDefaults.standard.set(token, forKey: latestFCMTokenDefaultsKey)
        resolve(token)
        return
      }

      if attempt < maxFCMTokenAttempts {
        DispatchQueue.main.asyncAfter(deadline: .now() + fcmRetryDelaySeconds) {
          self.requestFCMToken(attempt: attempt + 1, resolve: resolve, reject: reject)
        }
        return
      }

      if let cachedToken = UserDefaults.standard.string(forKey: latestFCMTokenDefaultsKey), !cachedToken.isEmpty {
        resolve(cachedToken)
        return
      }

      let nsError = error as NSError?
      reject(
        "fcm_token_unavailable",
        nsError?.localizedDescription ?? "FCM token is not available on iOS.",
        nsError
      )
    }
  }
}
