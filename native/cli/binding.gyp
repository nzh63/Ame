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
        'copies': [{
            'files': [
                '<(PRODUCT_DIR)/DrEyeCli.exe',
                '<(PRODUCT_DIR)/JBeijingCli.exe'
            ],
            'destination': '<(module_root_dir)/../../build/static/native/bin'
        }]
    }]
}
