#include <Windows.h>
#include <napi.h>

#include <algorithm>
#include <functional>
#include <map>
#include <memory>
#include <vector>

struct MoveDiff {
    int32_t diffLeft, diffTop;
};

// Context type for threadsafe function
using Context = std::nullptr_t;

// Base data type for callbacks
struct CallbackData {
    virtual ~CallbackData() = default;
};

struct MinimizeData : CallbackData {
    bool isMinimize;

    MinimizeData(bool min) : isMinimize(min) {}
};

struct MoveData : CallbackData {
    int32_t diffLeft, diffTop;

    MoveData(int32_t left, int32_t top) : diffLeft(left), diffTop(top) {}
};

// Forward declarations for CallJs callbacks
void CallMinimizeJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data);
void CallMoveJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data);

// TypedThreadSafeFunction type aliases
template <void (*CallJs)(Napi::Env, Napi::Function, Context *, CallbackData *)>
using TSFN = Napi::TypedThreadSafeFunction<Context, CallbackData, CallJs>;

// Storage for callbacks and state
std::map<HWINEVENTHOOK, std::shared_ptr<TSFN<CallMinimizeJs>>> minimizeCallbacks;
std::map<HWINEVENTHOOK, std::shared_ptr<TSFN<CallMoveJs>>> moveCallbacks;
std::map<HWINEVENTHOOK, RECT> lastRect;

// CallJs callback for minimize events
void CallMinimizeJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data) {
    auto *minData = static_cast<MinimizeData *>(data);
    if (env != nullptr && jsCallback != nullptr && minData != nullptr) {
        jsCallback.Call({Napi::Boolean::New(env, minData->isMinimize)});
    }
    delete minData;
}

// CallJs callback for move events
void CallMoveJs(Napi::Env env, Napi::Function jsCallback, Context *context, CallbackData *data) {
    auto *moveData = static_cast<MoveData *>(data);
    if (env != nullptr && jsCallback != nullptr && moveData != nullptr) {
        auto arg = Napi::Object::New(env);
        arg.Set("diffTop", moveData->diffTop);
        arg.Set("diffLeft", moveData->diffLeft);
        jsCallback.Call({arg});
    }
    delete moveData;
}

void CALLBACK windowsMinimizeCallback(HWINEVENTHOOK hWinEventHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild,
                                      DWORD idEventThread, DWORD dwmsEventTime) {
    auto it = minimizeCallbacks.find(hWinEventHook);
    if (it != minimizeCallbacks.end()) {
        auto *data = new MinimizeData(event == EVENT_SYSTEM_MINIMIZESTART);
        it->second->NonBlockingCall(data);
    }
}

void CALLBACK windowsMoveCallback(HWINEVENTHOOK hWinEventHook, DWORD event, HWND hwnd, LONG idObject, LONG idChild,
                                  DWORD idEventThread, DWORD dwmsEventTime) {
    auto it = moveCallbacks.find(hWinEventHook);
    if (it != moveCallbacks.end()) {
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
            auto *data = new MoveData(rect.left - it2->second.left, rect.top - it2->second.top);
            it->second->NonBlockingCall(data);
        }
    }
}

using PID = DWORD;

Napi::Value startWindowMinimizeHook(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "expect 2 arguments (pids array, callback function).").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsArray()) {
        Napi::TypeError::New(env, "expect array for first argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[1].IsFunction()) {
        Napi::TypeError::New(env, "expect function for second argument").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array pidsArray = info[0].As<Napi::Array>();
    Napi::Function jsCallback = info[1].As<Napi::Function>();

    std::vector<PID> pids;
    std::vector<HWINEVENTHOOK> hooks;

    uint32_t len = pidsArray.Length();
    for (uint32_t i = 0; i < len; i++) {
        pids.push_back(pidsArray.Get(i).As<Napi::Number>().Uint32Value());
    }

    // Create threadsafe function
    TSFN<CallMinimizeJs> tsfn = TSFN<CallMinimizeJs>::New(env, jsCallback, "WindowMinimizeHook", 0, 1, nullptr,
                                                          [](Napi::Env, void *, Context *ctx) {});

    auto tsfnPtr = std::make_shared<TSFN<CallMinimizeJs>>(std::move(tsfn));

    for (const auto pid : pids) {
        auto hook = SetWinEventHook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND, nullptr,
                                    windowsMinimizeCallback, pid, 0, WINEVENT_OUTOFCONTEXT);
        if (hook) {
            minimizeCallbacks[hook] = tsfnPtr;
            hooks.push_back(hook);
        }
    }

    Napi::Array result = Napi::Array::New(env, hooks.size());
    for (std::size_t i = 0; i < hooks.size(); i++) {
        result.Set(i, Napi::BigInt::New(env, reinterpret_cast<uint64_t>(hooks[i])));
    }
    return result;
}

Napi::Value startWindowMoveHook(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "expect 2 arguments (pids array, callback function).").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsArray()) {
        Napi::TypeError::New(env, "expect array for first argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[1].IsFunction()) {
        Napi::TypeError::New(env, "expect function for second argument").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array pidsArray = info[0].As<Napi::Array>();
    Napi::Function jsCallback = info[1].As<Napi::Function>();

    std::vector<PID> pids;
    std::vector<HWINEVENTHOOK> hooks;

    uint32_t len = pidsArray.Length();
    for (uint32_t i = 0; i < len; i++) {
        pids.push_back(pidsArray.Get(i).As<Napi::Number>().Uint32Value());
    }

    // Create threadsafe function
    TSFN<CallMoveJs> tsfn = TSFN<CallMoveJs>::New(env, jsCallback, "WindowMoveHook", 0, 1, nullptr,
                                                  [](Napi::Env, void *, Context *ctx) {});

    auto tsfnPtr = std::make_shared<TSFN<CallMoveJs>>(std::move(tsfn));

    for (const auto pid : pids) {
        auto hook = SetWinEventHook(EVENT_SYSTEM_MOVESIZESTART, EVENT_SYSTEM_MOVESIZEEND, nullptr, windowsMoveCallback,
                                    pid, 0, WINEVENT_OUTOFCONTEXT);
        if (hook) {
            moveCallbacks[hook] = tsfnPtr;
            hooks.push_back(hook);
        }
    }

    Napi::Array result = Napi::Array::New(env, hooks.size());
    for (std::size_t i = 0; i < hooks.size(); i++) {
        result.Set(i, Napi::BigInt::New(env, reinterpret_cast<uint64_t>(hooks[i])));
    }
    return result;
}

Napi::Value stopWindowEventHook(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "expect 1 argument (hooks array).").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array hooksArray = info[0].As<Napi::Array>();
    uint32_t len = hooksArray.Length();

    for (uint32_t i = 0; i < len; i++) {
        bool lossless;
        uint64_t hookValue = hooksArray.Get(i).As<Napi::BigInt>().Uint64Value(&lossless);
        HWINEVENTHOOK hook = reinterpret_cast<HWINEVENTHOOK>(hookValue);

        UnhookWinEvent(hook);

        // Remove from minimize callbacks
        auto it = minimizeCallbacks.find(hook);
        if (it != minimizeCallbacks.end()) {
            minimizeCallbacks.erase(it);
        }

        // Remove from move callbacks
        auto it2 = moveCallbacks.find(hook);
        if (it2 != moveCallbacks.end()) {
            moveCallbacks.erase(it2);
        }

        // Remove from lastRect
        auto it3 = lastRect.find(hook);
        if (it3 != lastRect.end()) {
            lastRect.erase(it3);
        }
    }

    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startWindowMinimizeHook", Napi::Function::New(env, startWindowMinimizeHook));
    exports.Set("startWindowMoveHook", Napi::Function::New(env, startWindowMoveHook));
    exports.Set("stopWindowEventHook", Napi::Function::New(env, stopWindowEventHook));
    return exports;
}

NODE_API_MODULE(WindowEventHook, Init)
