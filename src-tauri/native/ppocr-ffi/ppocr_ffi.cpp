/**
 * C ABI wrapper implementation for PP-OCR.
 * Bridges the C++ Detector/Recognizer (ncnn + opencv) to Rust FFI.
 */

#include "ppocr_ffi.h"

#include "Detector.h"
#include "Recognizer.h"

#include <cstring>
#include <opencv2/core/core.hpp>
#include <opencv2/imgproc.hpp>
#include <string>
#include <vector>

struct PpOcrDetector {
    Detector detector;
};

struct PpOcrRecognizer {
    Recognizer recognizer;
};

namespace {
// Convert BGRA buffer to a BGR cv::Mat (drop alpha).
cv::Mat bgraToBgr(const uint8_t *data, int32_t width, int32_t height) {
    cv::Mat bgra(height, width, CV_8UC4, const_cast<uint8_t *>(data));
    cv::Mat bgr;
    cv::cvtColor(bgra, bgr, cv::COLOR_BGRA2BGR);
    return bgr;
}

PpOcrBox toFfiBox(const cv::RotatedRect &r) {
    return PpOcrBox{r.center.x, r.center.y, r.size.width, r.size.height, r.angle};
}

cv::RotatedRect fromFfiBox(const PpOcrBox &b) {
    return cv::RotatedRect(cv::Point2f(b.center_x, b.center_y), cv::Size2f(b.width, b.height), b.angle);
}
}  // namespace

extern "C" {

PpOcrDetector *ppocr_detector_create(const char *param, const char *model, int gpu) {
    try {
        auto *det = new PpOcrDetector{
            Detector(std::string_view(param), std::string_view(model), gpu < 0 ? std::nullopt : std::optional<int>(gpu))};
        return det;
    } catch (...) {
        return nullptr;
    }
}

int32_t ppocr_detector_detect(PpOcrDetector *det, const uint8_t *data, int32_t width, int32_t height,
                              PpOcrBox **out_boxes) {
    if (!det || !data || !out_boxes)
        return -1;
    try {
        cv::Mat bgr = bgraToBgr(data, width, height);
        auto rects = det->detector(bgr);
        auto *boxes = static_cast<PpOcrBox *>(malloc(sizeof(PpOcrBox) * rects.size()));
        for (size_t i = 0; i < rects.size(); ++i) {
            boxes[i] = toFfiBox(rects[i]);
        }
        *out_boxes = boxes;
        return static_cast<int32_t>(rects.size());
    } catch (...) {
        return -1;
    }
}

void ppocr_free_boxes(PpOcrBox *boxes) { free(boxes); }

void ppocr_detector_destroy(PpOcrDetector *det) { delete det; }

PpOcrRecognizer *ppocr_recognizer_create(const char *param, const char *model, int gpu) {
    try {
        auto *rec = new PpOcrRecognizer{Recognizer(std::string_view(param), std::string_view(model),
                                                   gpu < 0 ? std::nullopt : std::optional<int>(gpu))};
        return rec;
    } catch (...) {
        return nullptr;
    }
}

int32_t ppocr_recognizer_recognize(PpOcrRecognizer *rec, const uint8_t *data, int32_t width, int32_t height,
                                   const PpOcrBox *boxes, int32_t n_boxes, char ***out_texts) {
    if (!rec || !data || !out_texts)
        return -1;
    try {
        cv::Mat bgr = bgraToBgr(data, width, height);
        std::vector<cv::RotatedRect> rects;
        rects.reserve(n_boxes);
        for (int32_t i = 0; i < n_boxes; ++i) {
            rects.push_back(fromFfiBox(boxes[i]));
        }
        auto texts = rec->recognizer(bgr, rects);

        auto **out = static_cast<char **>(malloc(sizeof(char *) * texts.size()));
        for (size_t i = 0; i < texts.size(); ++i) {
            out[i] = static_cast<char *>(malloc(texts[i].size() + 1));
            std::memcpy(out[i], texts[i].c_str(), texts[i].size() + 1);
        }
        *out_texts = out;
        return static_cast<int32_t>(texts.size());
    } catch (...) {
        return -1;
    }
}

void ppocr_free_texts(char **texts, int32_t n) {
    if (!texts)
        return;
    for (int32_t i = 0; i < n; ++i) {
        free(texts[i]);
    }
    free(texts);
}

void ppocr_recognizer_destroy(PpOcrRecognizer *rec) { delete rec; }

}  // extern "C"
