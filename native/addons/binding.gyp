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
        'actions': [{
            'action_name': 'copy .node',
            'inputs': [
                '<(PRODUCT_DIR)/ScreenCapturer.node',
                '<(PRODUCT_DIR)/WindowEventHook.node',
                '<(PRODUCT_DIR)/WindowsHook.node',
            ],
            'outputs': [
                '../../dist/addons/ScreenCapturer.node',
                '../../dist/addons/WindowEventHook.node',
                '../../dist/addons/WindowsHook.node',
            ],
            'action': [
                'copy',
                '<(PRODUCT_DIR)/*.node',
                '../../dist/addons'
            ]
        }]
    }]
}