#include "Detecter.h"
#include <gpu.h>
#include <iostream>
#include <net.h>
#include <opencv2/core/core.hpp>
#include <opencv2/imgproc.hpp>

Detecter::Detecter(std::string_view param, std::string_view model, std::optional<int> gpu) {
    if (gpu.has_value()) {
        net_.opt.use_vulkan_compute = true;
        net_.set_vulkan_device(*gpu);
    }
    if (net_.load_param(param.data()) != 0) {
        throw std::runtime_error("unable to load " + std::string(param));
    }
    if (net_.load_model(model.data()) != 0) {
        throw std::runtime_error("unable to load " + std::string(model));
    }
}

std::vector<cv::RotatedRect> Detecter::operator()(const cv::Mat &img) {
    // https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det/blob/main/inference.yml
    // https://github.com/PaddlePaddle/PaddleOCR/blob/v3.1.0/ppocr/data/imaug/operators.py#L198
    constexpr size_t inputSize = 736;
    size_t w = img.cols, h = img.rows;
    double ratio = static_cast<double>(inputSize) / std::max(w, h);
    size_t resizeW = w * ratio, resizeH = h * ratio;
    size_t padW = 0, padH = 0;

    constexpr size_t maxStride = 128;
    if (resizeW & (maxStride - 1)) {
        padW = maxStride - (resizeW & (maxStride - 1));
    }
    if (resizeH & (maxStride - 1)) {
        padH = maxStride - (resizeH & (maxStride - 1));
    }

    cv::Mat resized;
    cv::resize(img, resized, cv::Size(resizeW, resizeH));
    cv::Mat bordered;
    cv::copyMakeBorder(resized, bordered, padH / 2, padH - (padH / 2), padW / 2, padW - (padW / 2), cv::BORDER_CONSTANT,
                       0);

    // https://github.com/PaddlePaddle/PaddleOCR/blob/v2.6.0/ppocr/data/imaug/operators.py#L71
    ncnn::Mat in = ncnn::Mat::from_pixels(bordered.data, ncnn::Mat::PIXEL_RGB2BGR, bordered.cols, bordered.rows);
    float mean[] = {0.485 * 255.0, 0.456 * 255.0, 0.406 * 255.0};
    float norm[] = {1.0 / 255.0 / 0.229, 1.0 / 255.0 / 0.224, 1.0 / 255.0 / 0.225};
    in.substract_mean_normalize(mean, norm);

    auto ex = net_.create_extractor();
    ex.input("in0", in);

    ncnn::Mat out;
    ex.extract("out0", out);
    const float denorm[1] = {255.f};
    out.substract_mean_normalize(nullptr, denorm);

    cv::Mat pred(out.h, out.w, CV_8UC1);
    out.to_pixels(pred.data, ncnn::Mat::PIXEL_GRAY);

    // https://github.com/PaddlePaddle/PaddleOCR/blob/v3.1.0/ppocr/postprocess/db_postprocess.py#L29
    constexpr double thresh = 0.3;
    constexpr double boxThresh = 0.6;
    constexpr size_t maxCandidates = 1000;
    constexpr double unclipRatio = 1.5;
    constexpr float minSize = 3.0;

    cv::Mat segmentation;
    cv::threshold(pred, segmentation, thresh * 255, 255, cv::THRESH_BINARY);

    // boxes_from_bitmap
    std::vector<std::vector<cv::Point>> contours;
    std::vector<cv::Vec4i> hierarchy = {};
    cv::findContours(segmentation, contours, hierarchy, cv::RETR_LIST, cv::CHAIN_APPROX_SIMPLE);
    std::vector<cv::RotatedRect> boxes;
    for (int i = 0; i < contours.size() && i < maxCandidates; i++) {
        auto contour = contours[i];
        auto [box, points, sside] = getMiniBoxes(contour);
        if (sside < minSize) {
            continue;
        }
        auto score = boxScoreFast(segmentation, points);
        if (score < boxThresh) {
            continue;
        }
        box = unclip(box, unclipRatio);

        std::vector<cv::Point2f> p2f;
        box.points(p2f);
        std::vector<cv::Point> p;
        std::copy(p2f.begin(), p2f.end(), std::back_inserter(p));
        std::tie(box, points, sside) = getMiniBoxes(p);
        if (sside < minSize + 2) {
            continue;
        }
        auto center = box.center;
        auto size = box.size;
        center.x = (center.x - padW / 2) / ratio;
        center.y = (center.y - padH / 2) / ratio;
        size.width /= ratio;
        size.height /= ratio;
        auto angle = box.angle;
        if (size.height > size.width * 1.2) {
            angle += 90;
            std::swap(size.height, size.width);
        }
        angle = fmod(angle + 45 + 360, 180) - 45;
        boxes.emplace_back(center, size, angle);
    }

    return boxes;
}

std::tuple<cv::RotatedRect, std::array<cv::Point, 4>, float>
Detecter::getMiniBoxes(const std::vector<cv::Point> &contour) {
    auto boundingBox = cv::minAreaRect(contour);
    std::vector<cv::Point2f> points;
    boundingBox.points(points);
    std::sort(points.begin(), points.end(), [](auto &a, auto &b) { return a.x < b.x; });
    int index1 = 0, index2 = 1, index3 = 2, index4 = 3;
    if (points[1].y > points[0].y) {
        index1 = 0;
        index4 = 1;
    } else {
        index1 = 1;
        index4 = 0;
    }
    if (points[3].y > points[2].y) {
        index2 = 2;
        index3 = 3;
    } else {
        index2 = 3;
        index3 = 2;
    }

    return std::make_tuple(boundingBox,
                           std::array<cv::Point, 4>{points[index1], points[index2], points[index3], points[index4]},
                           std::min(boundingBox.size.width, boundingBox.size.height));
}

double Detecter::boxScoreFast(cv::Mat bitmap, const std::array<cv::Point, 4> &box) {
    auto xmin = std::min_element(box.begin(), box.end(), [](auto &a, auto &b) { return a.x < b.x; })->x;
    auto xmax = std::max_element(box.begin(), box.end(), [](auto &a, auto &b) { return a.x < b.x; })->x;
    auto ymin = std::min_element(box.begin(), box.end(), [](auto &a, auto &b) { return a.y < b.y; })->y;
    auto ymax = std::max_element(box.begin(), box.end(), [](auto &a, auto &b) { return a.y < b.y; })->y;
    auto w = bitmap.cols, h = bitmap.rows;
    xmin = std::max<float>(0, std::min<float>(xmin, w - 1));
    xmax = std::max<float>(0, std::min<float>(xmax, w - 1));
    ymin = std::max<float>(0, std::min<float>(ymin, h - 1));
    ymax = std::max<float>(0, std::min<float>(ymax, h - 1));

    cv::Mat mask(h, w, CV_8UC1, cv::Scalar(0));
    cv::fillPoly(mask, box, cv::Scalar(1));

    return cv::mean(bitmap, mask)[0];
}

cv::RotatedRect Detecter::unclip(const cv::RotatedRect &box, double unclipRatio) {
    auto size = box.size;
    float area = size.area();
    float distance = area * unclipRatio / (2 * (size.width + size.height));
    size.width += 2 * distance;
    size.height += 2 * distance;
    return cv::RotatedRect(box.center, size, box.angle);
}