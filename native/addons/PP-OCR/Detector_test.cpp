#include "Detector.h"
#include <gtest/gtest.h>
#include <opencv2/core/core.hpp>
#include <opencv2/imgproc.hpp>

// Test helper class that uses the protected default constructor
class DetectorTestHelper : public Detector {
  public:
    // Use protected default constructor for testing
    DetectorTestHelper() {}

    // Expose protected methods for testing
    using Detector::boxScoreFast;
    using Detector::getMiniBoxes;
    using Detector::unclip;
};

class DetectorTest : public ::testing::Test {
  protected:
    std::unique_ptr<DetectorTestHelper> detector_;

    void SetUp() override { detector_ = std::make_unique<DetectorTestHelper>(); }
};

// Test getMiniBoxes - normal rectangle contour
TEST_F(DetectorTest, GetMiniBoxes_NormalRectangle) {
    std::vector<cv::Point> contour = {cv::Point(10, 10), cv::Point(100, 10), cv::Point(100, 50), cv::Point(10, 50)};

    auto result = detector_->getMiniBoxes(contour);
    auto &box = std::get<0>(result);
    auto &points = std::get<1>(result);
    float sside = std::get<2>(result);

    EXPECT_NEAR(box.center.x, 55, 1.0);
    EXPECT_NEAR(box.center.y, 30, 1.0);
    // Width and height might be swapped depending on rotation, but sum should be constant
    EXPECT_NEAR(box.size.width + box.size.height, 130, 2.0);
    // sside should be the shorter dimension
    EXPECT_GT(sside, 35.0f);
    EXPECT_LT(sside, 45.0f);
    EXPECT_EQ(points.size(), 4);
}

// Test getMiniBoxes - square contour
TEST_F(DetectorTest, GetMiniBoxes_Square) {
    std::vector<cv::Point> contour = {cv::Point(0, 0), cv::Point(50, 0), cv::Point(50, 50), cv::Point(0, 50)};

    auto result = detector_->getMiniBoxes(contour);
    auto &box = std::get<0>(result);
    float sside = std::get<2>(result);

    EXPECT_NEAR(box.center.x, 25, 1.0);
    EXPECT_NEAR(box.center.y, 25, 1.0);
    EXPECT_NEAR(box.size.width, box.size.height, 2.0);
    // sside should be approximately the side length for a square
    EXPECT_NEAR(sside, 50.0f, 5.0f);
}

// Test getMiniBoxes - triangle contour
TEST_F(DetectorTest, GetMiniBoxes_Triangle) {
    std::vector<cv::Point> contour = {cv::Point(0, 0), cv::Point(100, 0), cv::Point(50, 50)};

    auto result = detector_->getMiniBoxes(contour);
    auto &box = std::get<0>(result);
    auto &points = std::get<1>(result);
    float sside = std::get<2>(result);

    EXPECT_GT(box.center.x, -1.0);
    EXPECT_GT(box.center.y, -0.001);
    EXPECT_EQ(points.size(), 4);
    EXPECT_GT(sside, 0);
}

// Test boxScoreFast - all white mask
TEST_F(DetectorTest, BoxScoreFast_AllWhite) {
    cv::Mat bitmap(100, 100, CV_8UC1, cv::Scalar(255));
    std::array<cv::Point, 4> box = {cv::Point(10, 10), cv::Point(10, 40), cv::Point(40, 40), cv::Point(40, 10)};

    double score = detector_->boxScoreFast(bitmap, box);
    EXPECT_DOUBLE_EQ(score, 255.0);
}

// Test boxScoreFast - all black mask
TEST_F(DetectorTest, BoxScoreFast_AllBlack) {
    cv::Mat bitmap(100, 100, CV_8UC1, cv::Scalar(0));
    std::array<cv::Point, 4> box = {cv::Point(10, 10), cv::Point(10, 40), cv::Point(40, 40), cv::Point(40, 10)};

    double score = detector_->boxScoreFast(bitmap, box);
    EXPECT_DOUBLE_EQ(score, 0.0);
}

// Test boxScoreFast - half white half black mask
TEST_F(DetectorTest, BoxScoreFast_HalfWhiteHalfBlack) {
    cv::Mat bitmap(100, 100, CV_8UC1, cv::Scalar(0));
    cv::rectangle(bitmap, cv::Point(0, 0), cv::Point(50, 100), cv::Scalar(255), -1);

    // Box spans both white (left of x=50) and black (right of x=50) regions
    std::array<cv::Point, 4> box = {cv::Point(40, 10), cv::Point(40, 40), cv::Point(60, 40), cv::Point(60, 10)};

    double score = detector_->boxScoreFast(bitmap, box);
    // Box area is 20x30 pixels, half in white (~300px) and half in black (~300px)
    // Expected average ~127.5, allow some margin
    EXPECT_GT(score, 120.0);
    EXPECT_LT(score, 140.0);
}

// Test boxScoreFast - cross boundary
TEST_F(DetectorTest, BoxScoreFast_CrossBoundary) {
    cv::Mat bitmap(100, 100, CV_8UC1, cv::Scalar(0));
    cv::rectangle(bitmap, cv::Point(0, 0), cv::Point(50, 100), cv::Scalar(255), -1);

    std::array<cv::Point, 4> box = {cv::Point(25, 25), cv::Point(25, 75), cv::Point(75, 75), cv::Point(75, 25)};

    double score = detector_->boxScoreFast(bitmap, box);
    // Box spans both white (left half) and black (right half) regions
    // Area = 50x50 = 2500 pixels, half white = ~1250 -> score ~127.5
    EXPECT_GT(score, 120.0);
    EXPECT_LT(score, 140.0);
}

// Test boxScoreFast - partial out of bounds
TEST_F(DetectorTest, BoxScoreFast_PartialOutOfBounds) {
    cv::Mat bitmap(50, 50, CV_8UC1, cv::Scalar(255));
    std::array<cv::Point, 4> box = {cv::Point(40, 40), cv::Point(40, 80), cv::Point(80, 80), cv::Point(80, 40)};

    double score = detector_->boxScoreFast(bitmap, box);
    EXPECT_DOUBLE_EQ(score, 255.0);
}

// Test unclip - normal expansion
TEST_F(DetectorTest, Unclip_NormalExpansion) {
    cv::RotatedRect box(cv::Point2f(50, 50), cv::Size2f(40, 20), 0);
    double unclipRatio = 1.5;

    cv::RotatedRect expanded = detector_->unclip(box, unclipRatio);

    EXPECT_FLOAT_EQ(expanded.center.x, box.center.x);
    EXPECT_FLOAT_EQ(expanded.center.y, box.center.y);
    EXPECT_FLOAT_EQ(expanded.angle, box.angle);
    EXPECT_GT(expanded.size.width, box.size.width);
    EXPECT_GT(expanded.size.height, box.size.height);
}

// Test unclip - no expansion with ratio 1.0
TEST_F(DetectorTest, Unclip_NoExpansion) {
    cv::RotatedRect box(cv::Point2f(50, 50), cv::Size2f(40, 20), 30);
    double unclipRatio = 1.0;

    cv::RotatedRect expanded = detector_->unclip(box, unclipRatio);

    EXPECT_FLOAT_EQ(expanded.center.x, box.center.x);
    EXPECT_FLOAT_EQ(expanded.center.y, box.center.y);
    EXPECT_FLOAT_EQ(expanded.angle, box.angle);
    EXPECT_GT(expanded.size.width, box.size.width);
}

// Test unclip - large box
TEST_F(DetectorTest, Unclip_LargeBox) {
    cv::RotatedRect box(cv::Point2f(100, 100), cv::Size2f(200, 100), 45);
    double unclipRatio = 2.0;

    cv::RotatedRect expanded = detector_->unclip(box, unclipRatio);

    EXPECT_FLOAT_EQ(expanded.center.x, box.center.x);
    EXPECT_FLOAT_EQ(expanded.center.y, box.center.y);
    EXPECT_FLOAT_EQ(expanded.angle, box.angle);
    EXPECT_GT(expanded.size.width, box.size.width);
    EXPECT_GT(expanded.size.height, box.size.height);
}

// Test unclip - small box
TEST_F(DetectorTest, Unclip_SmallBox) {
    cv::RotatedRect box(cv::Point2f(10, 10), cv::Size2f(4, 2), 0);
    double unclipRatio = 1.5;

    cv::RotatedRect expanded = detector_->unclip(box, unclipRatio);

    float area = box.size.width * box.size.height;
    float expandedArea = expanded.size.width * expanded.size.height;
    EXPECT_GT(expandedArea, area);
}

int main(int argc, char **argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
