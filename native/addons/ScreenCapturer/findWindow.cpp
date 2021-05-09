#include <Windows.h>
#include <algorithm>
#include <dwmapi.h>
#include <node_api.h>
#include <vector>

#include "../utils.h"

struct CheckWindowData {
    std::vector<PID> pids;
    HWND result = nullptr;
    napi_deferred deferred = nullptr;
    napi_value promise = nullptr;
    napi_async_work work = nullptr;
};

BOOL CALLBACK checkWindow(HWND hwnd, LPARAM data) {
    const auto &pids = ((CheckWindowData *)data)->pids;
    PID windowPid;
    GetWindowThreadProcessId(hwnd, &windowPid);
    if (std::find(pids.begin(), pids.end(), windowPid) != pids.end()) {
        if (IsWindowEnabled(hwnd) && IsWindowVisible(hwnd)) {
            ((CheckWindowData *)data)->result = hwnd;
            return 0;
        }
    }
    return 1;
}

void executeCheckWindow(napi_env env, void *data) { EnumWindows(checkWindow, (LPARAM)data); }
void completeCheckWindow(napi_env env, napi_status status, void *_data) {
    const auto &data = *(CheckWindowData *)_data;
    napi_value hwnd;
    if (data.result != nullptr) {
        NAPI_CALL(napi_create_bigint_uint64(env, (uint64_t)data.result, &hwnd));
        NAPI_CALL(napi_resolve_deferred(env, data.deferred, hwnd));
    } else {
        NAPI_CALL(napi_get_undefined(env, &hwnd));
        NAPI_CALL(napi_resolve_deferred(env, data.deferred, hwnd));
    }
    NAPI_CALL(napi_delete_async_work(env, data.work));
    delete (CheckWindowData *)_data;
    return;
err:
    napi_delete_async_work(env, data.work);
    napi_reject_deferred(env, data.deferred, handelError(env));
    delete (CheckWindowData *)_data;
}

napi_value findWindow(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value n_pids;
    auto *data = new CheckWindowData();
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, &n_pids, nullptr, nullptr), argc == 1, "expect one argument.",
                     env);

    bool isArray;
    NAPI_CALL_EXPECT(napi_is_array(env, n_pids, &isArray), isArray, "expect array", env);

    uint32_t len;
    NAPI_CALL(napi_get_array_length(env, n_pids, &len));

    for (uint32_t i = 0; i < len; i++) {
        napi_value n_pid;
        NAPI_CALL(napi_get_element(env, n_pids, i, &n_pid));
        uint32_t pid;
        NAPI_CALL(napi_get_value_uint32(env, n_pid, &pid));
        data->pids.push_back(pid);
    }

    NAPI_CALL(napi_create_promise(env, &data->deferred, &data->promise));

    napi_value resource_name;
    NAPI_CALL(napi_create_string_utf8(env, "checkWindow", NAPI_AUTO_LENGTH, &resource_name));
    NAPI_CALL(napi_create_async_work(env, nullptr, resource_name, executeCheckWindow, completeCheckWindow, data,
                                     &data->work));
    NAPI_CALL(napi_queue_async_work(env, data->work));

    return data->promise;
err:
    if (data->deferred)
        napi_reject_deferred(env, data->deferred, createError(env, nullptr, ""));
    if (data->work)
        napi_delete_async_work(env, data->work);
    delete data;
    return throwError(env);
}
