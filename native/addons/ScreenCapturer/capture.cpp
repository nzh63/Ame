#include <Windows.h>
#include <algorithm>
#include <dwmapi.h>
#include <node_api.h>
#include <vector>

#include "../utils.h"

struct CaptureData {
    HWND hwnd = nullptr;
    bool error = false;
    int width = 0;
    int height = 0;
    uint8_t *buffer = nullptr;
    int bufferSize = 0;
    napi_deferred deferred = nullptr;
    napi_value promise = nullptr;
    napi_async_work work = nullptr;
};

void executeCapture(napi_env env, void *_data) {
    auto &data = *(CaptureData *)_data;
    RECT rect{0, 0, 0, 0};
    DwmGetWindowAttribute(data.hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &rect, sizeof rect);
    const int width = rect.right - rect.left;
    const int height = rect.bottom - rect.top;
    if (height == 0 || width == 0) {
        data.error = true;
        return;
    }
    data.width = width;
    data.height = height;
    const auto hwndDC = GetWindowDC(data.hwnd);
    const auto saveDC = CreateCompatibleDC(hwndDC);
    const auto saveBitmap = CreateCompatibleBitmap(hwndDC, width, height);
    SelectObject(saveDC, saveBitmap);
    PrintWindow(data.hwnd, saveDC, PW_RENDERFULLCONTENT);
    data.bufferSize = width * height * 4;
    data.buffer = new uint8_t[data.bufferSize];
    GetBitmapBits(saveBitmap, data.bufferSize, data.buffer);
    DeleteObject(saveBitmap);
    DeleteDC(saveDC);
    ReleaseDC(data.hwnd, hwndDC);
    DeleteObject(saveBitmap);
}
void completeCapture(napi_env env, napi_status status, void *_data) {
    const auto &data = *(CaptureData *)_data;
    if (data.error) {
        NAPI_CALL(napi_reject_deferred(env, data.deferred, createError(env, nullptr, "Capture error")));
        return;
    }
    napi_value result, width, height, buffer;
    NAPI_CALL(napi_create_uint32(env, data.width, &width));
    NAPI_CALL(napi_create_uint32(env, data.height, &height));
    NAPI_CALL(napi_create_external_buffer(
        env, data.bufferSize, data.buffer,
        [](napi_env env, void *finalize_data, void *finalize_hint) { delete[](uint8_t *) finalize_hint; },
        (void *)data.buffer, &buffer));
    napi_property_descriptor desc[3] = {
        {"width", nullptr, nullptr, nullptr, nullptr, width, napi_enumerable, nullptr},
        {"height", nullptr, nullptr, nullptr, nullptr, height, napi_enumerable, nullptr},
        {"buffer", nullptr, nullptr, nullptr, nullptr, buffer, napi_enumerable, nullptr}};
    NAPI_CALL(napi_create_object(env, &result));
    NAPI_CALL(napi_define_properties(env, result, 3, desc));
    NAPI_CALL(napi_resolve_deferred(env, data.deferred, result));
    NAPI_CALL(napi_delete_async_work(env, data.work));

    delete (CaptureData *)_data;
    return;
err:
    napi_delete_async_work(env, data.work);
    napi_reject_deferred(env, data.deferred, handelError(env));
    if (data.buffer)
        delete[] data.buffer;
    delete (CaptureData *)_data;
}

napi_value capture(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value n_hwnd;
    auto *data = new CaptureData();
    NAPI_CALL_EXPECT(napi_get_cb_info(env, info, &argc, &n_hwnd, nullptr, nullptr), argc == 1, "expect one argument.",
                     env);
    bool lossless;
    NAPI_CALL(napi_get_value_bigint_uint64(env, n_hwnd, (uint64_t *)&data->hwnd, &lossless));

    NAPI_CALL(napi_create_promise(env, &data->deferred, &data->promise));

    napi_value resource_name;
    NAPI_CALL(napi_create_string_utf8(env, "capture", NAPI_AUTO_LENGTH, &resource_name));
    NAPI_CALL(napi_create_async_work(env, nullptr, resource_name, executeCapture, completeCapture, data, &data->work));
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