#include <Windows.h>
#include <algorithm>
#include <functional>
#include <map>
#include <node_api.h>
#include <vector>

#include "../utils.h"

struct MoveDiff {
    int32_t diffLeft, diffTop;
};

std::map<HWINEVENTHOOK, napi_threadsafe_function> callbacks;
std::map<HWINEVENTHOOK, RECT> lastRect;

void callWindowMinimizeJsCallback(napi_env env, napi_value js_cb, void *context, void *data) {
    DWORD event = (DWORD)(uint64_t)data;
    if (env != nullptr) {
        napi_value undefined, isMinimize;
        NAPI_CALL(napi_get_undefined(env, &undefined));
        NAPI_CALL(napi_get_boolean(env, event == EVENT_SYSTEM_MINIMIZESTART, &isMinimize));
        NAPI_CALL(napi_call_function(env, undefined, js_cb, 1, &isMinimize, nullptr));
    }
err:
    return;
}

void CALLBACK windowsMinimizeCallback(HWINEVENTHOOK hWinEventHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild,
                                      DWORD idEventThread, DWORD dwmsEventTime) {
    auto it = callbacks.find(hWinEventHook);
    if (it != callbacks.end()) {
        auto &tsfn = it->second;
        NAPI_CALL(napi_call_threadsafe_function(tsfn, (void *)(uint64_t)event, napi_tsfn_nonblocking));
    }
err:
    return;
}

void callWindowMoveJsCallback(napi_env env, napi_value js_cb, void *context, void *data) {
    MoveDiff *diff = (MoveDiff *)data;
    if (env != nullptr) {
        napi_value undefined, arg, diffTop, diffLeft;
        NAPI_CALL(napi_get_undefined(env, &undefined));
        NAPI_CALL(napi_create_object(env, &arg));
        NAPI_CALL(napi_create_int32(env, diff->diffTop, &diffTop));
        NAPI_CALL(napi_create_int32(env, diff->diffLeft, &diffLeft));
        napi_property_descriptor desc[] = {
            {"diffTop", nullptr, nullptr, nullptr, nullptr, diffTop, napi_enumerable, nullptr},
            {"diffLeft", nullptr, nullptr, nullptr, nullptr, diffLeft, napi_enumerable, nullptr}};
        NAPI_CALL(napi_define_properties(env, arg, 2, desc));
        NAPI_CALL(napi_call_function(env, undefined, js_cb, 1, &arg, nullptr));
    }
err:
    delete diff;
}

void CALLBACK windowsMoveCallback(HWINEVENTHOOK hWinEventHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild,
                                  DWORD idEventThread, DWORD dwmsEventTime) {
    auto it = callbacks.find(hWinEventHook);
    if (it != callbacks.end()) {
        if (event == EVENT_SYSTEM_MOVESIZESTART) {
            RECT rect{0, 0, 0, 0};
            GetWindowRect(hwnd, &rect);
            lastRect[hWinEventHook] = rect;
        } else if (event == EVENT_SYSTEM_MOVESIZEEND) {
            auto it2 = lastRect.find(hWinEventHook);
            if (it2 == lastRect.end())
                return;
            RECT rect{0, 0, 0, 0};
            GetWindowRect(hwnd, &rect);
            auto diff = new MoveDiff();
            diff->diffLeft = rect.left - it2->second.left;
            diff->diffTop = rect.top - it2->second.top;
            auto &tsfn = it->second;
            NAPI_CALL_GOTOERR(napi_call_threadsafe_function(tsfn, diff, napi_tsfn_nonblocking), err2);
            return;
        err2:
            delete diff;
            goto err;
        }
    }
err:
    return;
}

napi_value startWindowEventHook(napi_env env, napi_callback_info info, std::function<HWINEVENTHOOK(PID)> createHook,
                                napi_threadsafe_function_call_js callJsCallback) {
    size_t argc = 2;
    napi_value argv[2];
    std::vector<PID> pids;
    std::vector<HWINEVENTHOOK> hooks;
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr), argc == 2, "expect 2 argument.", env);

    bool isArray;
    NAPI_CALL_EXPECT(napi_is_array(env, argv[0], &isArray), isArray, "expect array", env);

    uint32_t len;
    NAPI_CALL(napi_get_array_length(env, argv[0], &len));

    for (uint32_t i = 0; i < len; i++) {
        napi_value n_pid;
        NAPI_CALL(napi_get_element(env, argv[0], i, &n_pid));
        uint32_t pid;
        NAPI_CALL(napi_get_value_uint32(env, n_pid, &pid));
        pids.push_back(pid);
    }

    napi_value resource_name;
    napi_threadsafe_function tsfn;
    tsfn = nullptr;
    NAPI_CALL(napi_create_string_utf8(env, "WindowEventHookCallback", NAPI_AUTO_LENGTH, &resource_name));
    NAPI_CALL(napi_create_threadsafe_function(env, argv[1], nullptr, resource_name, 0, 1, nullptr, nullptr, nullptr,
                                              callJsCallback, &tsfn));
    for (const auto pid : pids) {
        auto hook = createHook(pid);
        callbacks[hook] = tsfn;
        hooks.push_back(hook);
    }

    napi_value result;
    NAPI_CALL(napi_create_array_with_length(env, hooks.size(), &result));
    for (std::size_t i = 0; i < hooks.size(); i++) {
        napi_value hook;
        NAPI_CALL(napi_create_bigint_uint64(env, (uint64_t)(void *)hooks[i], &hook));
        NAPI_CALL(napi_set_element(env, result, i, hook));
    }
    return result;
err:
    if (tsfn)
        napi_release_threadsafe_function(tsfn, napi_tsfn_abort);
    return throwError(env);
}

napi_value startWindowMinimizeHook(napi_env env, napi_callback_info info) {
    return startWindowEventHook(
        env, info,
        [](PID pid) {
            return SetWinEventHook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND, nullptr,
                                   windowsMinimizeCallback, pid, 0, WINEVENT_OUTOFCONTEXT);
        },
        callWindowMinimizeJsCallback);
}

napi_value startWindowMoveHook(napi_env env, napi_callback_info info) {
    return startWindowEventHook(
        env, info,
        [](PID pid) {
            return SetWinEventHook(EVENT_SYSTEM_MOVESIZESTART, EVENT_SYSTEM_MOVESIZEEND, nullptr, windowsMoveCallback,
                                   pid, 0, WINEVENT_OUTOFCONTEXT);
        },
        callWindowMoveJsCallback);
}

napi_value stopWindowEventHook(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    std::vector<HWINEVENTHOOK> hooks;
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr), argc == 1, "expect 1 argument.", env);

    bool isArray;
    NAPI_CALL_EXPECT(napi_is_array(env, argv[0], &isArray), isArray, "expect array", env);

    uint32_t len;
    NAPI_CALL(napi_get_array_length(env, argv[0], &len));

    for (uint32_t i = 0; i < len; i++) {
        napi_value n_hook;
        NAPI_CALL(napi_get_element(env, argv[0], i, &n_hook));
        HWINEVENTHOOK hook;
        bool lossless;
        NAPI_CALL(napi_get_value_bigint_uint64(env, n_hook, (uint64_t *)(void *)&hook, &lossless));
        hooks.push_back(hook);
    }
    for (const auto hook : hooks) {
        UnhookWinEvent(hook);
        auto it = callbacks.find(hook);
        if (it != callbacks.end()) {
            napi_release_threadsafe_function(it->second, napi_tsfn_release);
            callbacks.erase(it);
        }
        auto it2 = lastRect.find(hook);
        if (it2 != lastRect.end()) {
            lastRect.erase(it2);
        }
    }
    return nullptr;
err:
    return throwError(env);
}

NAPI_MODULE_INIT() {
    napi_property_descriptor desc[] = {
        {"startWindowMinimizeHook", nullptr, startWindowMinimizeHook, nullptr, nullptr, nullptr, napi_enumerable,
         nullptr},
        {"startWindowMoveHook", nullptr, startWindowMoveHook, nullptr, nullptr, nullptr, napi_enumerable, nullptr},
        {"stopWindowEventHook", nullptr, stopWindowEventHook, nullptr, nullptr, nullptr, napi_enumerable, nullptr}};
    napi_define_properties(env, exports, 3, desc);
    return exports;
}
