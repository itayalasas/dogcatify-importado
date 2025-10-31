package com.dogcatify.app

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

// DataDog imports comentados - @datadog/mobile-react-native maneja la inicialización desde JS
// import com.datadog.android.Datadog
// import com.datadog.android.DatadogSite
// import com.datadog.android.core.configuration.Configuration
// import com.datadog.android.core.configuration.Credentials
// import com.datadog.android.log.Logs
// import com.datadog.android.log.LogsConfiguration

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()

    // DataDog initialization REMOVIDA - @datadog/mobile-react-native se encarga desde JavaScript
    // La inicialización nativa causaba conflictos de clases duplicadas
    // Ver utils/datadogLogger.ts para la configuración actual

    /*
    val credentials = Credentials(
      clientToken = "068208a98b131a96831ca92a86d4f158",
      envName = "production",
      variant = "",
      rumApplicationId = "dogcatify-app"
    )

    val configuration = Configuration.Builder(
      logsEnabled = true,
      tracesEnabled = true,
      crashReportsEnabled = true,
      rumEnabled = false
    )
      .useSite(DatadogSite.US1)
      .build()

    Datadog.initialize(this, credentials, configuration, trackingConsent = com.datadog.android.privacy.TrackingConsent.GRANTED)

    val logsConfig = LogsConfiguration.Builder()
      .setNetworkInfoEnabled(true)
      .setLogcatLogsEnabled(true)
      .build()
    Logs.enable(logsConfig)
    */

    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
