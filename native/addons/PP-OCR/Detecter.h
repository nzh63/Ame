#include <net.h>
#include <opencv2/core/core.hpp>
#include <optional>
#include <string_view>
#include <vector>

class Detecter {
  public:
    Detecter(std::string_view param, std::string_view model, std::optional<int> gpu = std::nullopt);

  public:
    std::vector<cv::RotatedRect> operator()(const cv::Mat &img);

  protected:
    std::tuple<cv::RotatedRect, std::array<cv::Point, 4>, float> getMiniBoxes(const std::vector<cv::Point> &contour);
    double boxScoreFast(cv::Mat bitmap, const std::array<cv::Point, 4> &box);
    cv::RotatedRect unclip(const cv::RotatedRect &box, double unclipRatio);

  protected:
    ncnn::Net net_;
};