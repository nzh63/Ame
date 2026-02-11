#include <Windows.h>
#include <napi.h>
#include <winternl.h>

#include <algorithm>
#include <functional>
#include <vector>

using PID = DWORD;

Napi::Value isWow64(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "expect 1 argument (pid number).").ThrowAsJavaScriptException();
        return env.Null();
    }

    PID pid = info[0].As<Napi::Number>().Uint32Value();
    HANDLE handle = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid);

    ULONG_PTR ret;
    unsigned long retLen;
    NtQueryInformationProcess(handle, ProcessWow64Information, &ret, sizeof ret, &retLen);
    bool isWow64 = ret != 0;

    return Napi::Boolean::New(env, isWow64);
}

// AsyncWorker for waiting process exit
class WaitProcessWorker : public Napi::AsyncWorker {
  public:
    WaitProcessWorker(Napi::Env env, std::vector<PID> &&pids)
        : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)), pids_(std::move(pids)) {}

    Napi::Promise Promise() { return deferred_.Promise(); }

  protected:
    void Execute() override {
        std::vector<HANDLE> handles;
        for (const auto pid : pids_) {
            auto handle = OpenProcess(SYNCHRONIZE, false, pid);
            if (handle) {
                handles.push_back(handle);
            }
        }

        if (handles.empty()) {
            // No valid processes to wait for, resolve immediately
            return;
        }

        // Wait for all processes to exit
        WaitForMultipleObjects(static_cast<DWORD>(handles.size()), handles.data(), TRUE, INFINITE);

        // Close all handles
        for (auto handle : handles) {
            CloseHandle(handle);
        }
    }

    void OnOK() override { deferred_.Resolve(Env().Undefined()); }

    void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

  private:
    Napi::Promise::Deferred deferred_;
    std::vector<PID> pids_;
};

Napi::Value waitProcessForExit(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "expect 1 argument (pids array).").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array pidsArray = info[0].As<Napi::Array>();
    std::vector<PID> pids;

    uint32_t len = pidsArray.Length();
    for (uint32_t i = 0; i < len; i++) {
        pids.push_back(pidsArray.Get(i).As<Napi::Number>().Uint32Value());
    }

    auto *worker = new WaitProcessWorker(env, std::move(pids));
    worker->Queue();

    return worker->Promise();
}

Napi::Value getPidFromPoint(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "expect 2 arguments (x, y coordinates).").ThrowAsJavaScriptException();
        return env.Null();
    }

    int64_t x = info[0].As<Napi::Number>().Int64Value();
    int64_t y = info[1].As<Napi::Number>().Int64Value();

    POINT pt;
    pt.x = static_cast<LONG>(x);
    pt.y = static_cast<LONG>(y);
    HWND hwnd = WindowFromPoint(pt);
    if (hwnd == nullptr) {
        return env.Undefined();
    }

    PID windowPid;
    GetWindowThreadProcessId(hwnd, &windowPid);
    return Napi::Number::From(env, windowPid);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("isWow64", Napi::Function::New(env, isWow64));
    exports.Set("waitProcessForExit", Napi::Function::New(env, waitProcessForExit));
    exports.Set("getPidFromPoint", Napi::Function::New(env, getPidFromPoint));
    return exports;
}

NODE_API_MODULE(Process, Init)
