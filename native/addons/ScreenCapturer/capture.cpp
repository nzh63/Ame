#include <Windows.h>
#include <dwmapi.h>
#include <napi.h>

#include <algorithm>
#include <vector>

// AsyncWorker for capturing window
class CaptureWorker : public Napi::AsyncWorker {
  public:
    CaptureWorker(Napi::Env env, HWND hwnd)
        : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)), hwnd_(hwnd) {}

    Napi::Promise Promise() { return deferred_.Promise(); }

  protected:
    void Execute() override {
        // Query window size
        RECT rect{0, 0, 0, 0};
        DwmGetWindowAttribute(hwnd_, DWMWA_EXTENDED_FRAME_BOUNDS, &rect, sizeof rect);
        width_ = rect.right - rect.left;
        height_ = rect.bottom - rect.top;

        if (height_ <= 0 || width_ <= 0) {
            SetError("Invalid window size");
            return;
        }

        // Allocate buffer for capture data
        size_t bufferSize = width_ * height_ * 4;
        buffer_.resize(bufferSize);

        // Capture window
        const auto hwndDC = GetWindowDC(hwnd_);
        const auto saveDC = CreateCompatibleDC(hwndDC);
        const auto saveBitmap = CreateCompatibleBitmap(hwndDC, width_, height_);
        SelectObject(saveDC, saveBitmap);
        PrintWindow(hwnd_, saveDC, PW_RENDERFULLCONTENT);

        BITMAPINFOHEADER bi;
        bi.biSize = sizeof(BITMAPINFOHEADER);
        bi.biWidth = width_;
        bi.biHeight = height_;
        bi.biPlanes = 1;
        bi.biBitCount = 32;
        bi.biCompression = BI_RGB;
        bi.biSizeImage = 0;
        bi.biXPelsPerMeter = 0;
        bi.biYPelsPerMeter = 0;
        bi.biClrUsed = 0;
        bi.biClrImportant = 0;

        GetDIBits(hwndDC, saveBitmap, 0, height_, buffer_.data(), reinterpret_cast<BITMAPINFO *>(&bi), DIB_RGB_COLORS);

        DeleteObject(saveBitmap);
        DeleteDC(saveDC);
        ReleaseDC(hwnd_, hwndDC);
    }

    void OnOK() override {
        Napi::Env env = Env();

        // Create result object
        auto result = Napi::Object::New(env);
        result.Set("width", static_cast<uint32_t>(width_));
        result.Set("height", static_cast<uint32_t>(height_));

        // Create buffer from captured data
        auto buffer = Napi::Buffer<uint8_t>::Copy(env, buffer_.data(), buffer_.size());
        result.Set("buffer", buffer);

        deferred_.Resolve(result);
    }

    void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

  private:
    Napi::Promise::Deferred deferred_;
    HWND hwnd_;
    int width_ = 0;
    int height_ = 0;
    std::vector<uint8_t> buffer_;
};

Napi::Value capture(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBigInt()) {
        Napi::TypeError::New(env, "expect 1 argument (hwnd as BigInt).").ThrowAsJavaScriptException();
        return env.Null();
    }

    bool lossless;
    uint64_t hwndValue = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
    HWND hwnd = reinterpret_cast<HWND>(hwndValue);

    auto *worker = new CaptureWorker(env, hwnd);
    worker->Queue();

    return worker->Promise();
}
