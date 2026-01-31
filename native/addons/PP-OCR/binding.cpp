#include "Detector.h"
#include "Recognizer.h"
#include <napi.h>

struct InstanceData {
    Napi::FunctionReference DetectorWraapper, RecognizerWraapper;
};

static bool isImage(const Napi::Value &val) {
    if (!val.IsObject()) {
        return false;
    }
    auto obj = val.ToObject();
    auto info = obj["info"].AsValue();
    auto data = obj["data"].AsValue();
    if (!info.IsObject() || !data.IsBuffer()) {
        return false;
    }
    obj = info.ToObject();
    auto width = obj["width"].AsValue();
    auto height = obj["height"].AsValue();
    if (!width.IsNumber() || !height.IsNumber()) {
        return false;
    }
    return true;
}

static cv::Mat toMat(const Napi::Value &val) {
    auto img = val.ToObject();
    uint32_t width = img["info"].AsValue().ToObject()["width"].AsValue().ToNumber();
    uint32_t height = img["info"].AsValue().ToObject()["height"].AsValue().ToNumber();
    auto buffer = img["data"].AsValue().As<Napi::Buffer<uint8_t>>();

    return cv::Mat(height, width, CV_8UC3, buffer.Data());
}

class DetectorWraapper : public Napi::ObjectWrap<DetectorWraapper> {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    DetectorWraapper(const Napi::CallbackInfo &info);

  protected:
    static Napi::Value create(const Napi::CallbackInfo &info);
    Napi::Value detect(const Napi::CallbackInfo &info);

  protected:
    std::unique_ptr<Detector> detector_ = nullptr;

    static constexpr napi_type_tag prtTag = {0x65ee77ab6a7dec90, 0xf9815d82541a3a89};
};

Napi::Object DetectorWraapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(
        env, "Detector",
        {InstanceMethod("detect", &DetectorWraapper::detect), StaticMethod("create", &DetectorWraapper::create)});

    env.GetInstanceData<InstanceData>()->DetectorWraapper = Napi::Persistent(func);

    exports.Set("Detector", func);
    return exports;
}

DetectorWraapper::DetectorWraapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<DetectorWraapper>(info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsExternal() || !info[0].As<Napi::External<Detector>>().CheckTypeTag(&prtTag)) {
        Napi::TypeError::New(env, "use Detector.create instead.").ThrowAsJavaScriptException();
        return;
    }
    auto detector = info[0].As<Napi::External<Detector>>().Data();
    detector_ = std::unique_ptr<Detector>(detector);
}

Napi::Value DetectorWraapper::create(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    std::string param = info[0].ToString(), model = info[1].ToString();
    std::optional<int> gpu = std::nullopt;
    if (info.Length() >= 3) {
        auto option = info[2].ToObject();
        auto gpuValue = option["gpu"].AsValue();
        if (gpuValue.IsNumber()) {
            gpu = gpuValue.ToNumber().Int32Value();
        }
        if (gpuValue.IsString()) {
            std::string str = gpuValue.ToString();
            if (str == "auto") {
                gpu = ncnn::get_default_gpu_index();
            }
        }
    }

    class Task : public Napi::AsyncWorker {
      public:
        Task(Napi::Env env, std::string &&param, std::string &&model, std::optional<int> gpu,
             Napi::Promise::Deferred deferred)
            : Napi::AsyncWorker(env), param_(std::move(param)), model_(std::move(model)), deferred_(deferred) {
            gpu_.store(gpu, std::memory_order_seq_cst);
        }

      protected:
        void Execute() override {
            try {
                result_ = new Detector(param_, model_, gpu_);
            } catch (std::exception e) {
                SetError(e.what());
            }
        }
        void OnOK() override {
            auto detector = Napi::External<Detector>::New(Env(), result_);
            detector.TypeTag(&prtTag);
            deferred_.Resolve(Env().GetInstanceData<InstanceData>()->DetectorWraapper.New({detector}));
        }
        void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

      protected:
        std::string param_, model_;
        std::atomic<std::optional<int>> gpu_;
        Napi::Promise::Deferred deferred_;
        Detector *result_ = nullptr;
    };

    auto deferred = Napi::Promise::Deferred::New(env);
    Task *task = new Task(env, std::move(param), std::move(model), gpu, deferred);
    task->Queue();

    return deferred.Promise();
}

Napi::Value DetectorWraapper::detect(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    auto length = info.Length();
    if (length == 0 || !isImage(info[0])) {
        Napi::TypeError::New(env, "Image expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    class Task : public Napi::AsyncWorker {
      public:
        Task(Napi::Env env, Detector &detector, cv::Mat &&img, Napi::Promise::Deferred deferred)
            : Napi::AsyncWorker(env), detector_(detector), img_(std::move(img)), deferred_(deferred) {}

      protected:
        void Execute() override { result_ = detector_(img_); }
        void OnOK() override {
            auto array = Napi::Array::New(Env(), result_.size());
            for (uint32_t i = 0; i < result_.size(); i++) {
                auto &box = result_[i];
                auto obj = Napi::Object::New(Env());
                auto center = Napi::Object::New(Env());
                obj["center"] = center;
                center["x"] = box.center.x;
                center["y"] = box.center.y;
                auto size = Napi::Object::New(Env());
                obj["size"] = size;
                size["width"] = box.size.width;
                size["height"] = box.size.height;
                obj["angle"] = box.angle;
                array.Set(i, obj);
            }
            deferred_.Resolve(array);
        }
        void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

      protected:
        Detector &detector_;
        cv::Mat img_;
        Napi::Promise::Deferred deferred_;
        std::vector<cv::RotatedRect> result_;
    };

    cv::Mat mat = toMat(info[0]);
    auto deferred = Napi::Promise::Deferred::New(env);
    Task *task = new Task(env, *detector_, std::move(mat), deferred);
    task->Queue();

    return deferred.Promise();
}

class RecognizerWraapper : public Napi::ObjectWrap<RecognizerWraapper> {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    RecognizerWraapper(const Napi::CallbackInfo &info);

  protected:
    static Napi::Value create(const Napi::CallbackInfo &info);
    Napi::Value recognize(const Napi::CallbackInfo &info);

  protected:
    std::unique_ptr<Recognizer> recognizer_ = nullptr;

    static constexpr napi_type_tag prtTag = {0x308356a1a07ad35a, 0xc0d9a3e163515096};
};

Napi::Object RecognizerWraapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Recognizer",
                                      {InstanceMethod("recognize", &RecognizerWraapper::recognize),
                                       StaticMethod("create", &RecognizerWraapper::create)});

    env.GetInstanceData<InstanceData>()->RecognizerWraapper = Napi::Persistent(func);

    exports.Set("Recognizer", func);
    return exports;
}

RecognizerWraapper::RecognizerWraapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<RecognizerWraapper>(info) {
    auto env = info.Env();
    if (info.Length() < 1 || !info[0].IsExternal() || !info[0].As<Napi::External<Recognizer>>().CheckTypeTag(&prtTag)) {
        Napi::TypeError::New(env, "use Detector.create instead.").ThrowAsJavaScriptException();
        return;
    }
    auto recognizer = info[0].As<Napi::External<Recognizer>>().Data();
    recognizer_ = std::unique_ptr<Recognizer>(recognizer);
}

Napi::Value RecognizerWraapper::create(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    std::string param = info[0].ToString(), model = info[1].ToString();
    std::optional<int> gpu = std::nullopt;
    if (info.Length() >= 3) {
        auto option = info[2].ToObject();
        auto gpuValue = option["gpu"].AsValue();
        if (gpuValue.IsNumber()) {
            gpu = gpuValue.ToNumber().Int32Value();
        }
        if (gpuValue.IsString()) {
            std::string str = gpuValue.ToString();
            if (str == "auto") {
                gpu = ncnn::get_default_gpu_index();
            }
        }
    }

    class Task : public Napi::AsyncWorker {
      public:
        Task(Napi::Env env, std::string &&param, std::string &&model, std::optional<int> gpu,
             Napi::Promise::Deferred deferred)
            : Napi::AsyncWorker(env), param_(std::move(param)), model_(std::move(model)), deferred_(deferred) {
            gpu_.store(gpu, std::memory_order_seq_cst);
        }

      protected:
        void Execute() override {
            try {
                result_ = new Recognizer(param_, model_, gpu_);
            } catch (std::exception e) {
                SetError(e.what());
            }
        }
        void OnOK() override {
            auto recognizer = Napi::External<Recognizer>::New(Env(), result_);
            recognizer.TypeTag(&prtTag);
            deferred_.Resolve(Env().GetInstanceData<InstanceData>()->RecognizerWraapper.New({recognizer}));
        }
        void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

      protected:
        std::string param_, model_;
        std::atomic<std::optional<int>> gpu_;
        Napi::Promise::Deferred deferred_;
        Recognizer *result_ = nullptr;
    };

    auto deferred = Napi::Promise::Deferred::New(env);
    Task *task = new Task(env, std::move(param), std::move(model), gpu, deferred);
    task->Queue();

    return deferred.Promise();
}

Napi::Value RecognizerWraapper::recognize(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    auto length = info.Length();
    if (length < 2) {
        Napi::TypeError::New(env, "2 Args expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!isImage(info[0])) {
        Napi::TypeError::New(env, "image expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[1].IsArray()) {
        Napi::TypeError::New(env, "Array expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    auto img = toMat(info[0]);
    auto array = info[1].As<Napi::Array>();
    std::vector<cv::RotatedRect> boxes;
    for (uint32_t i = 0; i < array.Length(); i++) {
        if (!array[i].AsValue().IsObject()) {
            Napi::TypeError::New(env, "RotatedRect expected").ThrowAsJavaScriptException();
            return env.Null();
        }
        auto obj = array[i].AsValue().ToObject();
        if (!obj.Has("center") || !obj["center"].AsValue().IsObject() || !obj.Has("size") ||
            !obj["size"].AsValue().IsObject() || !obj.Has("angle") || !obj["angle"].AsValue().IsNumber()) {
            Napi::TypeError::New(env, "RotatedRect expected").ThrowAsJavaScriptException();
            return env.Null();
        }
        auto center = obj["center"].AsValue().ToObject();
        auto size = obj["size"].AsValue().ToObject();
        auto angle = obj["angle"].AsValue().ToNumber();
        if (!center.Has("x") || !center["x"].AsValue().IsNumber() || !center.Has("y") ||
            !center["y"].AsValue().IsNumber() || !size.Has("width") || !size["width"].AsValue().IsNumber() ||
            !size.Has("height") || !size["height"].AsValue().IsNumber()) {
            Napi::TypeError::New(env, "RotatedRect expected").ThrowAsJavaScriptException();
            return env.Null();
        }
        boxes.emplace_back(cv::Point2f(center["x"].AsValue().ToNumber(), center["y"].AsValue().ToNumber()),
                           cv::Size2f(size["width"].AsValue().ToNumber(), size["height"].AsValue().ToNumber()), angle);
    }

    class Task : public Napi::AsyncWorker {
      public:
        Task(Napi::Env env, Recognizer &recognizer, cv::Mat &&img, std::vector<cv::RotatedRect> &&boxes,
             Napi::Promise::Deferred deferred)
            : Napi::AsyncWorker(env), recognizer_(recognizer), img_(std::move(img)), boxes_(std::move(boxes)),
              deferred_(deferred) {}

      protected:
        void Execute() override { result_ = recognizer_(img_, boxes_); }
        void OnOK() override {
            auto array = Napi::Array::New(Env(), result_.size());
            for (uint32_t i = 0; i < result_.size(); i++) {
                array.Set(i, Napi::String::From(Env(), result_[i]));
            }
            deferred_.Resolve(array);
        }
        void OnError(const Napi::Error &e) override { deferred_.Reject(e.Value()); }

      protected:
        Recognizer &recognizer_;
        cv::Mat img_;
        std::vector<cv::RotatedRect> boxes_;
        Napi::Promise::Deferred deferred_;
        std::vector<std::string> result_;
    };

    auto deferred = Napi::Promise::Deferred::New(env);
    Task *task = new Task(env, *recognizer_, std::move(img), std::move(boxes), deferred);
    task->Queue();

    return deferred.Promise();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    env.SetInstanceData(new InstanceData);
    exports = DetectorWraapper::Init(env, exports);
    exports = RecognizerWraapper::Init(env, exports);

    auto gpu = Napi::Object::New(env);
    auto name = Napi::Array::New(env);
    gpu.Set("devices", name);
    auto count = ncnn::get_gpu_count();
    for (int i = 0; i < count; i++) {
        auto &info = ncnn::get_gpu_info(i);
        name.Set(i, Napi::String::From(env, info.device_name()));
    }
    name.Seal();
    gpu.Seal();
    exports.Set("GPU", gpu);

    return exports;
}

NODE_API_MODULE(addon, InitAll)
