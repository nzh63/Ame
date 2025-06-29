{
    'targets': [{
        'target_name': 'ScreenCapturer',
        'sources': [
            'ScreenCapturer/init.cpp',
            'ScreenCapturer/findWindow.cpp',
            'ScreenCapturer/capture.cpp',
        ],
        'libraries': ['Dwmapi']
    }, {
        'target_name': 'WindowEventHook',
        'sources': [
            'WindowEventHook/init.cpp',
        ],
    }, {
        'target_name': 'WindowsHook',
        'sources': [
            'WindowsHook/init.cpp',
        ],
    }, {
        'target_name': 'Process',
        'sources': [
            'Process/init.cpp',
        ],
        'libraries': ['Ntdll']
    }, {
        'type': 'none',
        'target_name': 'copy',
        'dependencies': [
            'ScreenCapturer',
            'WindowEventHook',
            'WindowsHook',
        ],
        'copies': [{
            'files': [
                '<(PRODUCT_DIR)/ScreenCapturer.node',
                '<(PRODUCT_DIR)/WindowEventHook.node',
                '<(PRODUCT_DIR)/WindowsHook.node',
                '<(PRODUCT_DIR)/Process.node',
            ],
            'destination': '<(module_root_dir)/../../build/addons/<(target_arch)'
        }]
    }]
}
