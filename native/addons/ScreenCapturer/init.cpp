#include <Windows.h>
#include <dwmapi.h>
#include <napi.h>

#include <algorithm>
#include <vector>

Napi::Value findWindow(const Napi::CallbackInfo &info);
Napi::Value capture(const Napi::CallbackInfo &info);

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("findWindow", Napi::Function::New(env, findWindow));
    exports.Set("capture", Napi::Function::New(env, capture));
    return exports;
}

NODE_API_MODULE(ScreenCapturer, Init)
