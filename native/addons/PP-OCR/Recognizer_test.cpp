#include "Recognizer.h"
#include <gtest/gtest.h>
#include <opencv2/core/core.hpp>
#include <opencv2/imgproc.hpp>

// Test helper class that uses the protected default constructor
class RecognizerTestHelper : public Recognizer {
  public:
    // Use protected default constructor for testing
    RecognizerTestHelper() {}

    // Expose protected methods for testing
    using Recognizer::cutAndResize;
};

class RecognizerTest : public ::testing::Test {
  protected:
    std::unique_ptr<RecognizerTestHelper> recognizer_;

    void SetUp() override { recognizer_ = std::make_unique<RecognizerTestHelper>(); }
};

// Test cutAndResize - tiny box
TEST_F(RecognizerTest, CutAndResize_TinyBox) {
    cv::Mat img(100, 100, CV_8UC3, cv::Scalar(50, 50, 50));
    cv::RotatedRect box(cv::Point2f(50, 50), cv::Size2f(4, 2), 0);

    cv::Mat result = recognizer_->cutAndResize(img, box);

    EXPECT_FALSE(result.empty());
    EXPECT_EQ(result.rows, 48);
    EXPECT_EQ(result.cols, 96);

    // Verify content - all pixels should be the original color (50, 50, 50)
    // Even though source is tiny, resize should fill with source content
    cv::Vec3b pixel = result.at<cv::Vec3b>(result.rows / 2, result.cols / 2);
    EXPECT_EQ(pixel[0], 50); // Blue channel
    EXPECT_EQ(pixel[1], 50); // Green channel
    EXPECT_EQ(pixel[2], 50); // Red channel
}

// Test cutAndResize - large box
TEST_F(RecognizerTest, CutAndResize_LargeBox) {
    cv::Mat img(500, 500, CV_8UC3, cv::Scalar(100, 200, 50));
    cv::RotatedRect box(cv::Point2f(250, 250), cv::Size2f(200, 100), 0);

    cv::Mat result = recognizer_->cutAndResize(img, box);

    EXPECT_FALSE(result.empty());
    EXPECT_EQ(result.rows, 48);
    EXPECT_EQ(result.cols, 96);

    // Verify content - all pixels should be the original color (100, 200, 50)
    cv::Vec3b pixel = result.at<cv::Vec3b>(result.rows / 2, result.cols / 2);
    EXPECT_EQ(pixel[0], 100); // Blue channel
    EXPECT_EQ(pixel[1], 200); // Green channel
    EXPECT_EQ(pixel[2], 50);  // Red channel
}

// Structure to hold test parameters for CutAndResize tests
// Tests geometric mapping using colored corners
struct CutAndResizeTestParam {
    std::string name;
    cv::Point2f center;
    cv::Size2f size;
    float angle;
    cv::Size imageSize; // Image size to accommodate the box
};

// Test fixture for parameterized CutAndResize tests
class CutAndResizeTest : public ::testing::TestWithParam<CutAndResizeTestParam> {
  protected:
    std::unique_ptr<RecognizerTestHelper> recognizer_;

    void SetUp() override { recognizer_ = std::make_unique<RecognizerTestHelper>(); }
};

// Define test cases for CutAndResize tests using RotatedRect parameters
INSTANTIATE_TEST_SUITE_P(
    CutAndResizeTests, CutAndResizeTest,
    ::testing::Values(
        // Horizontal box (width > height): replaces CutAndResize_HorizontalBox
        CutAndResizeTestParam{"horizontal_box", cv::Point2f(100, 50), cv::Size2f(80, 40), 0.0f, cv::Size(200, 100)},
        // Vertical box (height > width): replaces CutAndResize_VerticalBox
        CutAndResizeTestParam{"vertical_box", cv::Point2f(50, 100), cv::Size2f(30, 60), 0.0f, cv::Size(100, 200)},
        // Square box: replaces CutAndResize_SquareBox
        CutAndResizeTestParam{"square_box", cv::Point2f(75, 75), cv::Size2f(50, 50), 0.0f, cv::Size(150, 150)},
        // 45 degree rotation
        CutAndResizeTestParam{"45_degree", cv::Point2f(100, 100), cv::Size2f(80, 40), 45.0f, cv::Size(200, 200)},
        // 90 degree rotation
        CutAndResizeTestParam{"90_degree", cv::Point2f(100, 100), cv::Size2f(60, 30), 90.0f, cv::Size(200, 200)},
        // -45 degree rotation
        CutAndResizeTestParam{"negative_45_degree", cv::Point2f(100, 100), cv::Size2f(80, 40), -45.0f,
                              cv::Size(200, 200)},
        // 30 degree rotation
        CutAndResizeTestParam{"30_degree", cv::Point2f(100, 100), cv::Size2f(80, 40), 30.0f, cv::Size(200, 200)},
        // 135 degree rotation
        CutAndResizeTestParam{"135_degree", cv::Point2f(100, 100), cv::Size2f(80, 40), 135.0f, cv::Size(200, 200)}),
    [](const testing::TestParamInfo<CutAndResizeTestParam> &info) { return info.param.name; });

// Parameterized test for CutAndResize with corner mapping verification
TEST_P(CutAndResizeTest, CornerMapping) {
    const auto &param = GetParam();

    // Create gray background image
    cv::Mat img(param.imageSize, CV_8UC3, cv::Scalar(128, 128, 128));

    // Create rotated rect from parameters
    cv::RotatedRect box(param.center, param.size, param.angle);

    // Get the four corners from OpenCV
    cv::Point2f corners[4];
    box.points(corners);

    // Paint 5x5 squares at each corner with distinct colors
    // Mapping after transform: corners[1]->TL(green), corners[2]->TR(red), corners[3]->BR(yellow), corners[0]->BL(blue)
    cv::rectangle(img, cv::Point(corners[0].x - 2, corners[0].y - 2), cv::Point(corners[0].x + 2, corners[0].y + 2),
                  cv::Scalar(255, 0, 0), -1); // Blue -> bottom-left
    cv::rectangle(img, cv::Point(corners[1].x - 2, corners[1].y - 2), cv::Point(corners[1].x + 2, corners[1].y + 2),
                  cv::Scalar(0, 255, 0), -1); // Green -> top-left
    cv::rectangle(img, cv::Point(corners[2].x - 2, corners[2].y - 2), cv::Point(corners[2].x + 2, corners[2].y + 2),
                  cv::Scalar(0, 0, 255), -1); // Red -> top-right
    cv::rectangle(img, cv::Point(corners[3].x - 2, corners[3].y - 2), cv::Point(corners[3].x + 2, corners[3].y + 2),
                  cv::Scalar(0, 255, 255), -1); // Yellow -> bottom-right

    cv::Mat result = recognizer_->cutAndResize(img, box);

    // Calculate expected width
    int expectedWidth = static_cast<int>(param.size.width * 48.0f / param.size.height);

    EXPECT_EQ(result.rows, 48);
    EXPECT_EQ(result.cols, expectedWidth);
    EXPECT_FALSE(result.empty());
    EXPECT_EQ(result.channels(), 3);

    // Verify corner colors at output corners
    // Top-left should be green [0, 255, 0] (from corners[1])
    cv::Vec3b topLeft = result.at<cv::Vec3b>(0, 0);
    EXPECT_EQ(topLeft[0], 0) << "Top-left should be green";
    EXPECT_EQ(topLeft[1], 255) << "Top-left should be green";
    EXPECT_EQ(topLeft[2], 0) << "Top-left should be green";

    // Top-right should be red [0, 0, 255] (from corners[2])
    cv::Vec3b topRight = result.at<cv::Vec3b>(0, result.cols - 1);
    EXPECT_EQ(topRight[0], 0) << "Top-right should be red";
    EXPECT_EQ(topRight[1], 0) << "Top-right should be red";
    EXPECT_EQ(topRight[2], 255) << "Top-right should be red";

    // Bottom-right should be yellow [0, 255, 255] (from corners[3])
    cv::Vec3b bottomRight = result.at<cv::Vec3b>(result.rows - 1, result.cols - 1);
    EXPECT_EQ(bottomRight[0], 0) << "Bottom-right should be yellow";
    EXPECT_EQ(bottomRight[1], 255) << "Bottom-right should be yellow";
    EXPECT_EQ(bottomRight[2], 255) << "Bottom-right should be yellow";

    // Bottom-left should be blue [255, 0, 0] (from corners[0])
    cv::Vec3b bottomLeft = result.at<cv::Vec3b>(result.rows - 1, 0);
    EXPECT_EQ(bottomLeft[0], 255) << "Bottom-left should be blue";
    EXPECT_EQ(bottomLeft[1], 0) << "Bottom-left should be blue";
    EXPECT_EQ(bottomLeft[2], 0) << "Bottom-left should be blue";

    // Center should remain gray background
    cv::Vec3b center = result.at<cv::Vec3b>(result.rows / 2, result.cols / 2);
    EXPECT_EQ(center[0], 128);
    EXPECT_EQ(center[1], 128);
    EXPECT_EQ(center[2], 128);
}

int main(int argc, char **argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
