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
    void *data = nullptr;
    napi_ref buffer = nullptr;
    napi_deferred deferred = nullptr;
    napi_value promise = nullptr;
    napi_async_work work = nullptr;
};

void queryWindowSize(napi_env env, void *_data);
void mallocBuffer(napi_env env, napi_status status, void *_data);
void executeCapture(napi_env env, void *_data);
void completeCapture(napi_env env, napi_status status, void *_data);

void queryWindowSize(napi_env env, void *_data) {
    auto &data = *(CaptureData *)_data;
    RECT rect{0, 0, 0, 0};
    DwmGetWindowAttribute(data.hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &rect, sizeof rect);
    const int width = rect.right - rect.left;
    const int height = rect.bottom - rect.top;
    if (height <= 0 || width <= 0) {
        data.error = true;
        return;
    }
    data.width = width;
    data.height = height;
}

void mallocBuffer(napi_env env, napi_status status, void *_data) {
    auto &data = *(CaptureData *)_data;
    if (data.error) {
        if (data.deferred) napi_reject_deferred(env, data.deferred, createError(env, nullptr, "Capture error"));
        if (data.work) napi_delete_async_work(env, data.work);
        if (data.buffer) napi_delete_reference(env, data.buffer);
        delete (CaptureData *)_data;
        return;
    }
    napi_value buffer = nullptr;
    NAPI_CALL(napi_create_buffer(env, data.width * data.height * 4, &data.data, &buffer));
    NAPI_CALL(napi_create_reference(env, buffer, 1, &data.buffer));

    NAPI_CALL(napi_delete_async_work(env, data.work));
    data.work = nullptr;
    napi_value resource_name;
    NAPI_CALL(napi_create_string_utf8(env, "capture", NAPI_AUTO_LENGTH, &resource_name));
    NAPI_CALL(napi_create_async_work(env, nullptr, resource_name, executeCapture, completeCapture, &data, &data.work));
    NAPI_CALL(napi_queue_async_work(env, data.work));
    return;
err:
    if (data.deferred) napi_reject_deferred(env, data.deferred, handelError(env));
    if (data.work) napi_delete_async_work(env, data.work);
    if (data.buffer) napi_delete_reference(env, data.buffer);
    delete (CaptureData *)_data;
}

void executeCapture(napi_env env, void *_data) {
    auto &data = *(CaptureData *)_data;
    const auto hwndDC = GetWindowDC(data.hwnd);
    const auto saveDC = CreateCompatibleDC(hwndDC);
    const auto saveBitmap = CreateCompatibleBitmap(hwndDC, data.width, data.height);
    SelectObject(saveDC, saveBitmap);
    PrintWindow(data.hwnd, saveDC, PW_RENDERFULLCONTENT);
    BITMAPINFOHEADER bi;
    bi.biSize = sizeof(BITMAPINFOHEADER);
    bi.biWidth = data.width;
    bi.biHeight = data.height;
    bi.biPlanes = 1;
    bi.biBitCount = 32;
    bi.biCompression = BI_RGB;
    bi.biSizeImage = 0;
    bi.biXPelsPerMeter = 0;
    bi.biYPelsPerMeter = 0;
    bi.biClrUsed = 0;
    bi.biClrImportant = 0;
    GetDIBits(hwndDC, saveBitmap, 0, data.height, data.data, (BITMAPINFO *)&bi, DIB_RGB_COLORS);
    DeleteObject(saveBitmap);
    DeleteDC(saveDC);
    ReleaseDC(data.hwnd, hwndDC);
}

void completeCapture(napi_env env, napi_status status, void *_data) {
    auto &data = *(CaptureData *)_data;
    napi_value result, width, height, buffer;
    NAPI_CALL(napi_create_uint32(env, data.width, &width));
    NAPI_CALL(napi_create_uint32(env, data.height, &height));
    NAPI_CALL(napi_get_reference_value(env, data.buffer, &buffer));
    napi_property_descriptor desc[3] = {
        {"width", nullptr, nullptr, nullptr, nullptr, width, napi_enumerable, nullptr},
        {"height", nullptr, nullptr, nullptr, nullptr, height, napi_enumerable, nullptr},
        {"buffer", nullptr, nullptr, nullptr, nullptr, buffer, napi_enumerable, nullptr}};
    NAPI_CALL(napi_create_object(env, &result));
    NAPI_CALL(napi_define_properties(env, result, 3, desc));
    NAPI_CALL(napi_resolve_deferred(env, data.deferred, result));
    data.deferred = nullptr;
    NAPI_CALL(napi_delete_async_work(env, data.work));
    data.work = nullptr;
    NAPI_CALL(napi_delete_reference(env, data.buffer));
    data.buffer = nullptr;

    delete (CaptureData *)_data;
    return;
err:
    if (data.deferred) napi_reject_deferred(env, data.deferred, handelError(env));
    if (data.work) napi_delete_async_work(env, data.work);
    if (data.buffer) napi_delete_reference(env, data.buffer);
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
    NAPI_CALL(napi_create_async_work(env, nullptr, resource_name, queryWindowSize, mallocBuffer, data, &data->work));
    NAPI_CALL(napi_queue_async_work(env, data->work));

    return data->promise;
err:
    if (data->deferred) {
        const napi_extended_error_info *error_info = nullptr;
        napi_get_last_error_info(env, &error_info);
        const char* msg = error_info->error_message ? error_info->error_message : "";
        napi_reject_deferred(env, data->deferred, createError(env, nullptr, msg));
    }
    if (data->work) napi_delete_async_work(env, data->work);
    delete data;
    return throwError(env);
}