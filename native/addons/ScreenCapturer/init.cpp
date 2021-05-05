#include <Windows.h>
#include <algorithm>
#include <dwmapi.h>
#include <node_api.h>
#include <vector>

#include "../utils.h"

napi_value findWindow(napi_env env, napi_callback_info info);
napi_value capture(napi_env env, napi_callback_info info);

NAPI_MODULE_INIT() {
    napi_property_descriptor desc[] = {
        {"findWindow", nullptr, findWindow, nullptr, nullptr, nullptr, napi_enumerable, nullptr},
        {"capture", nullptr, capture, nullptr, nullptr, nullptr, napi_enumerable, nullptr}};
    napi_define_properties(env, exports, 2, desc);
    return exports;
}
