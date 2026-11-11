/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'SleepWidget',
  displayName: 'Сон',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#7C8CFF',
    $widgetBackground: '#0B1020',
  },
  entitlements: {
    // Тот же App Group, что и у приложения: через него виджет получает данные.
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
