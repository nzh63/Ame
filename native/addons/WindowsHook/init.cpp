#include <Windows.h>
#include <napi.h>

#include <algorithm>
#include <functional>
#include <memory>
#include <vector>

struct CallbackData {
    virtual ~CallbackData() = default;
};

struct KeyboardData : CallbackData {
    WPARAM wParam;
    DWORD vkCode;

    KeyboardData(WPARAM w, DWORD v) : wParam(w), vkCode(v) {}
};

struct MouseData : CallbackData {
    WPARAM wParam;
    POINT pt;

    MouseData(WPARAM w, POINT p) : wParam(w), pt(p) {}
};

// Context type for threadsafe function
using Context = std::nullptr_t;

// Forward declarations for CallJs callbacks
void CallKeyboardJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data);
void CallMouseJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data);

// TypedThreadSafeFunction type alias
template <void (*CallJs)(Napi::Env, Napi::Function, Context *, CallbackData *)>
using TSFN = Napi::TypedThreadSafeFunction<Context, CallbackData, CallJs>;

// Use unique_ptr to manage TSFN lifetime
std::vector<std::unique_ptr<TSFN<CallKeyboardJs>>> keyboardCallbacks;
HHOOK keyboardHookHandle = nullptr;

std::vector<std::unique_ptr<TSFN<CallMouseJs>>> mouseCallbacks;
HHOOK mouseHookHandle = nullptr;

// CallJs callback for keyboard events
void CallKeyboardJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data) {
    auto *kbdData = static_cast<KeyboardData *>(data);
    if (env != nullptr && jsCallback != nullptr) {
        jsCallback.Call({Napi::Number::From(env, kbdData->wParam), Napi::Number::From(env, kbdData->vkCode)});
    }
    delete kbdData;
}

// CallJs callback for mouse events
void CallMouseJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data) {
    auto *mouseData = static_cast<MouseData *>(data);
    if (env != nullptr && jsCallback != nullptr) {
        auto point = Napi::Object::New(env);
        point.Set("x", mouseData->pt.x);
        point.Set("y", mouseData->pt.y);
        jsCallback.Call({Napi::Number::From(env, mouseData->wParam), point});
    }
    delete mouseData;
}

LRESULT CALLBACK globalKeyboardHookCallback(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) {
        auto *kb = reinterpret_cast<KBDLLHOOKSTRUCT *>(lParam);
        for (auto &tsfn : keyboardCallbacks) {
            auto *data = new KeyboardData(wParam, kb->vkCode);
            tsfn->NonBlockingCall(data);
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

LRESULT CALLBACK globalMouseHookCallback(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) {
        if (wParam == WM_LBUTTONDOWN || wParam == WM_LBUTTONUP || wParam == WM_MOUSEWHEEL) {
            for (auto &tsfn : mouseCallbacks) {
                auto *data = new MouseData(wParam, reinterpret_cast<MSLLHOOKSTRUCT *>(lParam)->pt);
                tsfn->NonBlockingCall(data);
            }
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

template <void (*CallJs)(Napi::Env, Napi::Function, Context *, CallbackData *)>
Napi::Value startHook(const Napi::CallbackInfo &info, const std::function<HHOOK()> &createHook,
                      std::vector<std::unique_ptr<TSFN<CallJs>>> &callbacks, HHOOK &handle) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "expect 1 argument (callback function).").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Function jsCallback = info[0].As<Napi::Function>();

    // Create typed threadsafe function
    auto tsfn =
        TSFN<CallJs>::New(env, jsCallback, "WindowHookCallback", 0, 1, nullptr, [](Napi::Env, void *, Context *ctx) {});

    if (!handle) {
        handle = createHook();
        if (!handle) {
            DWORD errorCode = GetLastError();
            Napi::Error::New(env, "Failed to create hook, error code: " + std::to_string(errorCode))
                .ThrowAsJavaScriptException();
            return env.Null();
        }
    }

    // Store in vector and get pointer
    callbacks.push_back(std::make_unique<TSFN<CallJs>>(std::move(tsfn)));
    TSFN<CallJs> *rawPtr = callbacks.back().get();

    // Return the pointer value as BigInt for later identification
    return Napi::BigInt::New(env, reinterpret_cast<uint64_t>(rawPtr));
}

Napi::Value startGlobalKeyboardHook(const Napi::CallbackInfo &info) {
    return startHook<CallKeyboardJs>(
        info, []() { return SetWindowsHookExA(WH_KEYBOARD_LL, globalKeyboardHookCallback, nullptr, 0); },
        keyboardCallbacks, keyboardHookHandle);
}

Napi::Value startGlobalMouseHook(const Napi::CallbackInfo &info) {
    return startHook<CallMouseJs>(
        info, []() { return SetWindowsHookExA(WH_MOUSE_LL, globalMouseHookCallback, nullptr, 0); }, mouseCallbacks,
        mouseHookHandle);
}

template <void (*CallJs)(Napi::Env, Napi::Function, Context *, CallbackData *)>
void findAndRemoveCallback(std::vector<std::unique_ptr<TSFN<CallJs>>> &callbacks, TSFN<CallJs> *targetPtr) {
    auto it = std::find_if(callbacks.begin(), callbacks.end(),
                           [targetPtr](const std::unique_ptr<TSFN<CallJs>> &tsfn) { return tsfn.get() == targetPtr; });
    if (it != callbacks.end()) {
        (*it)->Abort();
        callbacks.erase(it);
    }
}

Napi::Value stopHook(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBigInt()) {
        Napi::TypeError::New(env, "expect 1 argument (BigInt).").ThrowAsJavaScriptException();
        return env.Null();
    }

    bool lossless;
    uint64_t ptrValue = info[0].As<Napi::BigInt>().Uint64Value(&lossless);

    // Try to find in keyboard callbacks
    auto *kbdPtr = reinterpret_cast<TSFN<CallKeyboardJs> *>(ptrValue);
    findAndRemoveCallback(keyboardCallbacks, kbdPtr);

    // Try to find in mouse callbacks
    auto *mousePtr = reinterpret_cast<TSFN<CallMouseJs> *>(ptrValue);
    findAndRemoveCallback(mouseCallbacks, mousePtr);

    // Unhook if no more callbacks
    if (keyboardCallbacks.empty() && keyboardHookHandle) {
        UnhookWindowsHookEx(keyboardHookHandle);
        keyboardHookHandle = nullptr;
    }
    if (mouseCallbacks.empty() && mouseHookHandle) {
        UnhookWindowsHookEx(mouseHookHandle);
        mouseHookHandle = nullptr;
    }

    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startGlobalKeyboardHook", Napi::Function::New(env, startGlobalKeyboardHook));
    exports.Set("startGlobalMouseHook", Napi::Function::New(env, startGlobalMouseHook));
    exports.Set("stopHook", Napi::Function::New(env, stopHook));
    return exports;
}

NODE_API_MODULE(WindowsHook, Init)
