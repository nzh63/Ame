#include "Detector.h"
#include "Recognizer.h"
#include <codecvt>
#include <iostream>
#include <locale>
#include <opencv2/highgui.hpp>
#include <opencv2/imgproc.hpp>

int main(int argc, char **argv) {
    constexpr char locale_name[] = "";
    setlocale(LC_ALL, locale_name);
    std::locale::global(std::locale(locale_name));
    std::wcin.imbue(std::locale()), std::wcout.imbue(std::locale());

    const char *imagepath = "image.png";
    if (argc >= 2) {
        imagepath = argv[1];
    }

    cv::Mat m = cv::imread(imagepath);
    cv::Mat rgb;
    cv::cvtColor(m, rgb, cv::COLOR_BGR2RGB);

    Detector detector("PP-OCRv5_server_det.fp32.ncnn.param", "PP-OCRv5_server_det.fp32.ncnn.bin");
    auto boxes = detector(rgb);

    std::wcout << "boxes.size: " << boxes.size() << std::endl;
    std::sort(boxes.begin(), boxes.end(),
              [](auto &a, auto &b) { return a.center.x / 100 + a.center.y < b.center.x / 100 + b.center.y; });

    Recognizer recognizer("PP-OCRv5_server_rec.fp32.ncnn.param", "PP-OCRv5_server_rec.fp32.ncnn.bin");

    auto textes = recognizer(rgb, boxes);
    for (auto &i : textes) {
        std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> converter;
        std::wstring wstr = converter.from_bytes(i);
        std::wcout << wstr << std::endl;
    }

    return 0;
}