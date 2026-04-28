#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FCMTokenModule, NSObject)

RCT_EXTERN_METHOD(
  getFCMToken:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
