{
    'targets': [{
        'type': 'executable',
        'target_name': 'DrEyeCli',
        'sources': ['DrEyeCli.cpp']
    }, {
        'type': 'executable',
        'target_name': 'JBeijingCli',
        'sources': ['JBeijingCli.cpp']
    }, {
        'type': 'none',
        'target_name': 'copy',
        'dependencies': [
            'DrEyeCli',
            'JBeijingCli',
        ],
        'actions': [{
            'action_name': 'copy executable to static/native/bin',
            'inputs': [
                '<(PRODUCT_DIR)/DrEyeCli.exe',
                '<(PRODUCT_DIR)/JBeijingCli.exe'
            ],
            'outputs': [
                '<(module_root_dir)/../../static/native/bin/DrEyeCli.exe',
                '<(module_root_dir)/../../static/native/bin/JBeijingCli.exe'
            ],
            'action': [
                'copy',
                '<(PRODUCT_DIR)/*.exe',
                '<(module_root_dir)/../../static/native/bin'
            ]
        }]
    }]
}
