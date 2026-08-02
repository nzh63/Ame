#include <net.h>
#include <opencv2/core/core.hpp>
#include <optional>
#include <string>
#include <string_view>

class Recognizer {
  public:
    Recognizer(std::string_view param, std::string_view model, std::optional<int> gpu = std::nullopt);

  public:
    std::string operator()(const cv::Mat &img);
    std::vector<std::string> operator()(const cv::Mat &img, const std::vector<cv::RotatedRect> &boxes);
    std::vector<std::string> operator()(const std::vector<cv::Mat> &imgs);

  protected:
    // Protected default constructor for testing
    Recognizer() = default;

    cv::Mat cutAndResize(const cv::Mat &img, const cv::RotatedRect &box);

  protected:
    ncnn::Net net_;
    std::optional<int> gpu_;
};
