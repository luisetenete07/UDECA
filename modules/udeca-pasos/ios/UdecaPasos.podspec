Pod::Spec.new do |s|
  s.name           = 'UdecaPasos'
  s.version        = '1.0.0'
  s.summary        = 'Pasos del día desde Salud (HealthKit), con el Apple Watch incluido.'
  s.description    = 'Pasos del día desde Salud (HealthKit), con el Apple Watch incluido.'
  s.license        = 'UNLICENSED'
  s.author         = 'UDECA'
  s.homepage       = 'https://udeca.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/luisetenete07/app-calistenia.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
