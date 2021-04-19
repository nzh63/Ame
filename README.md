# Ame - Visual Novel Translator

## 功能
* 从正在运行的游戏中提取文本，支持Hook方式与OCR方式。
* 从翻译器中获取机器翻译结果，包括：
  * 离线翻译器（JBeijing与Dr.eye）
  * 若干在线翻译器
* 使用语音合成朗读原文、译文。
* 图形化的、易于配置的设置界面。

## 我们似乎已经有了VNR与[YUKI](https://github.com/project-yuki/YUKI)？
* VNR的启动速度慢，运行卡顿。
* VNR已经许久未见官方维护了。
* YUKI需要手工编辑JSON文件来镜像程序配置。
* YUKI不支持语音合成。
* YUKI自从2020年之后似乎就不再维护了。

## 编译与运行
你首先需要安装[node.js](https://nodejs.org/en/)(v12+)、[yarn](https://yarnpkg.com/)、[CMake](https://cmake.org/)和[Visual Studio](https://visualstudio.microsoft.com/)，然后执行以下命令即可进行开发与调试。
```powershell
git clone https://github.com/nzh63/Ame
cd Ame
yarn
yarn dev
yarn build
```

## 贡献
遵循一般的fork，branch，commit ，Pull request的流程。

## 想要添加新的翻译器？
请参考[贡献](#贡献)一节，翻译器相关代码在[src/main/providers](./src/main/providers)下，实现相关逻辑即可，程序会自动根据选项的schema生成配置界面。

## License
MIT
