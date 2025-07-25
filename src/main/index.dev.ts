/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */
/* eslint-disable */
// Install `electron-debug` with `devtron`
// Require `main` process to boot app
import './index';
import electronDebug from 'electron-debug';

electronDebug({ showDevTools: true });
