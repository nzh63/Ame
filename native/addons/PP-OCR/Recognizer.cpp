#include "Recognizer.h"
#include "dict.hpp"
#include <net.h>
#include <omp.h>
#include <opencv2/core/core.hpp>
#include <opencv2/imgproc.hpp>

Recognizer::Recognizer(std::string_view param, std::string_view model, std::optional<int> gpu): gpu_(gpu) {
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

std::string Recognizer::operator()(const cv::Mat &img) {
    // https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec/blob/main/inference.yml
    ncnn::Mat in = ncnn::Mat::from_pixels(img.data, ncnn::Mat::PIXEL_RGB2BGR, img.cols, img.rows);
    float mean[] = {127.5, 127.5, 127.5};
    float norm[] = {1.0 / 127.5, 1.0 / 127.5, 1.0 / 127.5};
    in.substract_mean_normalize(mean, norm);

    auto ex = net_.create_extractor();
    ex.input("in0", in);

    ncnn::Mat out;
    ex.extract("out0", out);

    std::string str;

    for (int i = 0; i < out.h; i++) {
        const float *p = out.row(i);
        int index = 0;
        float max_score = *p;
        for (int j = 0; j < out.w; j++) {
            float score = p[j];
            if (score > max_score) {
                max_score = score;
                index = j;
            }
        }
        if (index != 0 && index <= std::size(dict)) {
            auto ch = dict[index - 1];
            str += ch;
        }
    }
    return str;
}

std::vector<std::string> Recognizer::operator()(const cv::Mat &img, const std::vector<cv::RotatedRect> &boxes) {
    std::vector<cv::Mat> cut;
    for (auto &i : boxes) {
        cut.emplace_back(cutAndResize(img, i));
    }
    return operator()(cut);
}

std::vector<std::string> Recognizer::operator()(const std::vector<cv::Mat> &imgs) {
    std::vector<std::string> ret;
    ret.resize(imgs.size());
    if (gpu_.has_value()) {
        auto n = 1;
        auto gpu = ncnn::get_gpu_device(*gpu_);
        if (gpu) n = gpu->info.compute_queue_count();
#pragma omp parallel for num_threads(n)
        for (int i = 0; i < imgs.size(); i++) {
            ret[i] = operator()(imgs[i]);
        }
    } else {
        for (int i = 0; i < imgs.size(); i++) {
            ret[i] = operator()(imgs[i]);
        }
    }
    return ret;
}

cv::Mat Recognizer::cutAndResize(const cv::Mat &img, const cv::RotatedRect &box) {
    float targetHeight = 48;
    float targetWidth = box.size.width * targetHeight / box.size.height;

    cv::Point2f points[4];
    box.points(points);

    //  points[1]----------points[2]      (0, 0)----------(w, 0)
    //     |                  |             |               |
    //     |                  |       ->    |               |
    //     |                  |             |               |
    //  points[0]----------points[3]      (h, 0))----------(w, h)

    std::array<cv::Point2f, 3> src = {points[1], points[2], points[0]};
    std::array<cv::Point2f, 3> dst = {cv::Point2f(0, 0), cv::Point2f(targetWidth, 0), cv::Point2f(0, targetHeight)};

    cv::Mat affine = cv::getAffineTransform(src, dst);
    cv::Mat out;
    cv::warpAffine(img, out, affine, cv::Size(targetWidth, targetHeight), cv::INTER_LINEAR, cv::BORDER_REPLICATE);

    return out;
}
