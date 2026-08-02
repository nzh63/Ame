/**
 * C ABI wrapper for PP-OCR Detector and Recognizer.
 * This allows Rust to call the C++ ncnn-based OCR via FFI.
 */

#pragma once

#include <cstdint>

#if defined(_WIN32) && defined(PPOCR_BUILDING_DLL)
#define PPOCR_API __declspec(dllexport)
#else
#define PPOCR_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

/** Opaque handle types. */
typedef struct PpOcrDetector PpOcrDetector;
typedef struct PpOcrRecognizer PpOcrRecognizer;

/** A detected text region (rotated rectangle). */
typedef struct {
    float center_x;
    float center_y;
    float width;
    float height;
    float angle; /**< degrees */
} PpOcrBox;

/**
 * Create a Detector.
 * @param param  Path to ncnn .param file (null-terminated UTF-8).
 * @param model  Path to ncnn .bin file (null-terminated UTF-8).
 * @param gpu    GPU device id, or -1 for CPU.
 * @return Handle, or nullptr on failure.
 */
PPOCR_API PpOcrDetector *ppocr_detector_create(const char *param, const char *model, int gpu);

/**
 * Run detection on a BGRA image.
 * @param det     Detector handle.
 * @param data    Pixel data (BGRA, 4 bytes per pixel).
 * @param width   Image width.
 * @param height  Image height.
 * @param out_boxes  Output array of boxes (caller must free with ppocr_free_boxes).
 * @return Number of detected boxes, or -1 on error.
 */
PPOCR_API int32_t ppocr_detector_detect(PpOcrDetector *det, const uint8_t *data, int32_t width,
                                        int32_t height, PpOcrBox **out_boxes);

/** Free boxes returned by ppocr_detector_detect. */
PPOCR_API void ppocr_free_boxes(PpOcrBox *boxes);

/** Destroy a Detector. */
PPOCR_API void ppocr_detector_destroy(PpOcrDetector *det);

/**
 * Create a Recognizer.
 * @param param  Path to ncnn .param file.
 * @param model  Path to ncnn .bin file.
 * @param gpu    GPU device id, or -1 for CPU.
 * @return Handle, or nullptr on failure.
 */
PPOCR_API PpOcrRecognizer *ppocr_recognizer_create(const char *param, const char *model, int gpu);

/**
 * Recognize text in detected boxes.
 * @param rec      Recognizer handle.
 * @param data     Pixel data (BGRA).
 * @param width    Image width.
 * @param height   Image height.
 * @param boxes    Array of boxes from detection.
 * @param n_boxes  Number of boxes.
 * @param out_texts  Output array of null-terminated UTF-8 strings (caller must free).
 * @return Number of results, or -1 on error.
 */
PPOCR_API int32_t ppocr_recognizer_recognize(PpOcrRecognizer *rec, const uint8_t *data, int32_t width,
                                             int32_t height, const PpOcrBox *boxes, int32_t n_boxes,
                                             char ***out_texts);

/** Free texts returned by ppocr_recognizer_recognize. */
PPOCR_API void ppocr_free_texts(char **texts, int32_t n);

/** Destroy a Recognizer. */
PPOCR_API void ppocr_recognizer_destroy(PpOcrRecognizer *rec);

#ifdef __cplusplus
}
#endif
