#include <Windows.h>
#include <algorithm>
#include <functional>
#include <node_api.h>
#include <vector>
#include <winternl.h>

#include "../utils.h"

napi_value isWow64(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    PID pid;
    std::vector<napi_threadsafe_function>::iterator it;
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, argv, 0, 0), argc == 1, "expect 1 argument.", env);
    NAPI_CALL(napi_get_value_uint32(env, argv[0], (uint32_t *)&pid));
    auto handle = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid);
    ULONG_PTR ret = 0;
    unsigned long retLen;
    NtQueryInformationProcess(handle, ProcessWow64Information, &ret, sizeof ret, &retLen);
    bool isWow64 = ret != 0;

    napi_value result;
    NAPI_CALL(napi_get_boolean(env, isWow64, &result));

    return result;
err:
    return throwError(env);
}

struct WaitData {
    std::vector<PID> pids;
    std::vector<HANDLE> handles;
    napi_deferred deferred;
    napi_value promise;
    napi_threadsafe_function tsfn;
};

void waitCallback(void *_data, BOOLEAN isTimedOut) {
    auto *data = (WaitData *)_data;
    if (!isTimedOut) {
        data->handles.pop_back();
    }
    if (data->handles.size()) {
        auto handle = data->handles.back();
        HANDLE waitHandle;
        RegisterWaitForSingleObject(&waitHandle, handle, waitCallback, (void *)data, INFINITE, WT_EXECUTEONLYONCE);
    } else {
        napi_call_threadsafe_function(data->tsfn, nullptr, napi_tsfn_nonblocking);
    }
}
void resolvePromise(napi_env env, napi_value js_cb, void *context, void *_data) {
    auto *data = (WaitData *)context;
    napi_value undefined;
    NAPI_CALL(napi_get_undefined(env, &undefined));
    NAPI_CALL(napi_resolve_deferred(env, data->deferred, undefined));
err:
    napi_release_threadsafe_function(data->tsfn, napi_tsfn_release);
    delete data;
    return;
}

napi_value waitProcessForExit(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value n_pids;
    auto *data = new WaitData();
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, &n_pids, 0, 0), argc == 1, "expect one argument.", env);

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
        auto handle = OpenProcess(SYNCHRONIZE, false, pid);
        data->handles.push_back(handle);
    }
    napi_value resource_name;
    NAPI_CALL(napi_create_promise(env, &data->deferred, &data->promise));
    NAPI_CALL(napi_create_string_utf8(env, "WaitCallback", NAPI_AUTO_LENGTH, &resource_name));
    napi_create_threadsafe_function(env, nullptr, nullptr, resource_name, 0, 1, nullptr, nullptr, data, resolvePromise,
                                    &data->tsfn);
    NAPI_CALL(napi_acquire_threadsafe_function(data->tsfn));

    if (data->handles.size()) {
        auto handle = data->handles.back();
        HANDLE waitHandle;
        RegisterWaitForSingleObject(&waitHandle, handle, waitCallback, (void *)data, INFINITE, WT_EXECUTEONLYONCE);
    } else {
        napi_value undefined;
        NAPI_CALL(napi_get_undefined(env, &undefined));
        NAPI_CALL(napi_resolve_deferred(env, data->deferred, undefined));
    }

    return data->promise;
err:
    return throwError(env);
}

NAPI_MODULE_INIT() {
    napi_property_descriptor desc[] = {
        {"isWow64", nullptr, isWow64, nullptr, nullptr, nullptr, napi_enumerable, nullptr},
        {"waitProcessForExit", nullptr, waitProcessForExit, nullptr, nullptr, nullptr, napi_enumerable, nullptr}};
    napi_define_properties(env, exports, 2, desc);
    return exports;
}
