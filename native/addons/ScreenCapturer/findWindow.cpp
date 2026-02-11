#include <Windows.h>
#include <napi.h>

#include <algorithm>
#include <vector>

using PID = DWORD;

struct CheckWindowData {
    std::vector<PID> pids;
    HWND result = nullptr;
};

BOOL CALLBACK checkWindow(HWND hwnd, LPARAM data) {
    const auto &pids = reinterpret_cast<CheckWindowData *>(data)->pids;
    PID windowPid;
    GetWindowThreadProcessId(hwnd, &windowPid);
    if (std::find(pids.begin(), pids.end(), windowPid) != pids.end()) {
        if (IsWindowEnabled(hwnd) && IsWindowVisible(hwnd)) {
            reinterpret_cast<CheckWindowData *>(data)->result = hwnd;
            return FALSE;  // Stop enumeration
        }
    }
    return TRUE;  // Continue enumeration
}

// AsyncWorker for finding window
class FindWindowWorker : public Napi::AsyncWorker {
  public:
    FindWindowWorker(Napi::Env env, std::vector<PID> &&pids)
        : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)), pids_(std::move(pids)) {}

    Napi::Promise Promise() { return deferred_.Promise(); }

  protected:
    void Execute() override {
        CheckWindowData data;
        data.pids = pids_;
        EnumWindows(checkWindow, reinterpret_cast<LPARAM>(&data));
        result_ = data.result;
    }

    void OnOK() override {
        if (result_ != nullptr) {
            deferred_.Resolve(Napi::BigInt::New(Env(), reinterpret_cast<uint64_t>(result_)));
        } else {
            deferred_.Resolve(Env().Undefined());
        }
    }

    void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

  private:
    Napi::Promise::Deferred deferred_;
    std::vector<PID> pids_;
    HWND result_ = nullptr;
};

Napi::Value findWindow(const Napi::CallbackInfo &info) {
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

    auto *worker = new FindWindowWorker(env, std::move(pids));
    worker->Queue();

    return worker->Promise();
}
