#include <Windows.h>
#include <node_api.h>

#include <algorithm>
#include <functional>
#include <vector>

#include "../utils.h"

napi_value startHook(napi_env env, napi_callback_info info, std::function<HHOOK()> createHook,
                     napi_threadsafe_function_call_js callJsCallback, std::vector<napi_threadsafe_function> &callbacks,
                     HHOOK &handle) {
    size_t argc = 1;
    napi_value argv[1];
    std::vector<PID> pids;
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr), argc == 1, "expect 1 argument.", env);

    napi_value resource_name;
    napi_threadsafe_function tsfn = nullptr;
    NAPI_CALL(napi_create_string_utf8(env, "WindowHookCallback", NAPI_AUTO_LENGTH, &resource_name));
    NAPI_CALL(napi_create_threadsafe_function(env, argv[0], nullptr, resource_name, 0, 1, nullptr, nullptr, nullptr,
                                              callJsCallback, &tsfn));

    if (!handle) {
        handle = createHook();
        if (!handle)
            return throwError(env);
    }
    callbacks.push_back(tsfn);

    napi_value ret;
    NAPI_CALL(napi_create_bigint_uint64(env, (uint64_t)(void *)tsfn, &ret));
    return ret;
err:
    if (tsfn)
        napi_release_threadsafe_function(tsfn, napi_tsfn_abort);
    return throwError(env);
}

std::vector<napi_threadsafe_function> keyboardCallbacks;
HHOOK keyboardHookHandle = nullptr;

struct KeyboardData {
    WPARAM wParam;
    DWORD vkCode;
};

void callKeyboardJsCallback(napi_env env, napi_value js_cb, void *context, void *_data) {
    auto data = (KeyboardData *)_data;
    if (env != nullptr) {
        napi_value undefined, args[2];
        NAPI_CALL(napi_get_undefined(env, &undefined));
        NAPI_CALL(napi_create_uint32(env, data->wParam, &args[0]));
        NAPI_CALL(napi_create_uint32(env, data->vkCode, &args[1]));
        NAPI_CALL(napi_call_function(env, undefined, js_cb, 2, args, nullptr));
    }
err:
    delete data;
}
LRESULT CALLBACK globalKeyboardHookCallback(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) {
        auto *kb = (KBDLLHOOKSTRUCT *)lParam;
        for (const auto tsfn : keyboardCallbacks) {
            auto *data = new KeyboardData{wParam, kb->vkCode};
            NAPI_CALL(napi_call_threadsafe_function(tsfn, data, napi_tsfn_nonblocking));
            continue;
        err:
            delete data;
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

napi_value startGlobalKeyboardHook(napi_env env, napi_callback_info info) {
    return startHook(
        env, info, []() { return SetWindowsHookExA(WH_KEYBOARD_LL, globalKeyboardHookCallback, nullptr, 0); },
        callKeyboardJsCallback, keyboardCallbacks, keyboardHookHandle);
}

std::vector<napi_threadsafe_function> mouseCallbacks;
HHOOK mouseHookHandle = nullptr;

struct MouseData {
    WPARAM wParam;
    POINT pt;
};

void callMouseJsCallback(napi_env env, napi_value js_cb, void *context, void *_data) {
    auto *data = (MouseData *)_data;
    if (env != nullptr) {
        napi_value undefined, args[2], x, y;
        NAPI_CALL(napi_get_undefined(env, &undefined));
        NAPI_CALL(napi_create_uint32(env, data->wParam, &args[0]));
        NAPI_CALL(napi_create_object(env, &args[1]));
        NAPI_CALL(napi_create_uint32(env, data->pt.x, &x));
        NAPI_CALL(napi_create_uint32(env, data->pt.y, &y));
        NAPI_CALL(napi_set_named_property(env, args[1], "x", x));
        NAPI_CALL(napi_set_named_property(env, args[1], "y", y));
        NAPI_CALL(napi_call_function(env, undefined, js_cb, 2, args, nullptr));
    }
err:
    delete data;
    return;
}
LRESULT CALLBACK globalMouseHookCallback(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) {
        if (wParam == WM_LBUTTONDOWN || wParam == WM_LBUTTONUP || wParam == WM_MOUSEWHEEL) {
            for (const auto tsfn : mouseCallbacks) {
                auto *data = new MouseData{wParam, ((MSLLHOOKSTRUCT *)lParam)->pt};
                NAPI_CALL(napi_call_threadsafe_function(tsfn, (void *)data, napi_tsfn_nonblocking));
                continue;
            err:
                delete data;
            }
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

napi_value startGlobalMouseHook(napi_env env, napi_callback_info info) {
    return startHook(
        env, info, []() { return SetWindowsHookExA(WH_MOUSE_LL, globalMouseHookCallback, nullptr, 0); },
        callMouseJsCallback, mouseCallbacks, mouseHookHandle);
}

napi_value stopHook(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_threadsafe_function tsfn;
    bool lossless;
    std::vector<napi_threadsafe_function>::iterator it;
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr), argc == 1, "expect 1 argument.", env);
    NAPI_CALL(napi_get_value_bigint_uint64(env, argv[0], (uint64_t *)(void *)&tsfn, &lossless));
    it = std::find(keyboardCallbacks.begin(), keyboardCallbacks.end(), tsfn);
    if (it != keyboardCallbacks.end())
        keyboardCallbacks.erase(it);

    it = std::find(mouseCallbacks.begin(), mouseCallbacks.end(), tsfn);
    if (it != mouseCallbacks.end())
        mouseCallbacks.erase(it);

    if (keyboardCallbacks.size() == 0) {
        UnhookWindowsHookEx(keyboardHookHandle);
        keyboardHookHandle = nullptr;
    }
    if (mouseCallbacks.size() == 0) {
        UnhookWindowsHookEx(mouseHookHandle);
        mouseHookHandle = nullptr;
    }
    NAPI_CALL(napi_release_threadsafe_function(tsfn, napi_tsfn_abort));
    return nullptr;
err:
    return throwError(env);
}

NAPI_MODULE_INIT() {
    napi_property_descriptor desc[] = {
        {"startGlobalKeyboardHook", nullptr, startGlobalKeyboardHook, nullptr, nullptr, nullptr, napi_enumerable,
         nullptr},
        {"startGlobalMouseHook", nullptr, startGlobalMouseHook, nullptr, nullptr, nullptr, napi_enumerable, nullptr},
        {"stopHook", nullptr, stopHook, nullptr, nullptr, nullptr, napi_enumerable, nullptr}};
    napi_define_properties(env, exports, 3, desc);
    return exports;
}
