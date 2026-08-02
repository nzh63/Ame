#include <Windows.h>
#include <array>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <io.h>
#include <iostream>
#include <stdio.h>
#include <string>

using namespace std;

constexpr auto BUFFER_SIZE = 4096;
int bufferSize = BUFFER_SIZE;
int bufferSize2 = BUFFER_SIZE;

constexpr auto USER_DICT_PATH_SIZE = 0x204;
constexpr auto MAX_USER_DICT_COUNT = 3;
constexpr auto USER_DICT_BUFFER_SIZE = USER_DICT_PATH_SIZE * MAX_USER_DICT_COUNT;

array<wchar_t, USER_DICT_BUFFER_SIZE> userDictBuffer{0};
array<char, BUFFER_SIZE> input;
array<char, BUFFER_SIZE> output;
array<char, BUFFER_SIZE> buf;

int(__cdecl *DJC_OpenAllUserDic_Unicode)(LPWSTR, int);
int(__cdecl *DJC_CloseAllUserDic)(int);
int(__cdecl *JC_Transfer_Unicode)(HWND hwnd, UINT fromCodePage, UINT toCodePage, int unknown1, int unknown2, void *from,
                                  void *to, int *toCapacity, void *buffer, int *bufferCapacity);

int main() {
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
    int argc;
    wchar_t **argv;
    argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (argv == nullptr) {
        cout << "CommandLineToArgvW fail" << endl;
        return 1;
    }
    HMODULE dll = LoadLibraryW(argv[1]);
    if (!dll) {
        cout << "dll open fail" << endl;
        return 1;
    }
    DJC_OpenAllUserDic_Unicode = (int(__cdecl *)(LPWSTR, int))GetProcAddress(dll, "DJC_OpenAllUserDic_Unicode");
    DJC_CloseAllUserDic = (int(__cdecl *)(int))GetProcAddress(dll, "DJC_CloseAllUserDic");
    JC_Transfer_Unicode = (int(__cdecl *)(HWND, UINT, UINT, int, int, void *, void *, int *, void *,
                                          int *))GetProcAddress(dll, "JC_Transfer_Unicode");
    if (!DJC_OpenAllUserDic_Unicode || !DJC_CloseAllUserDic || !JC_Transfer_Unicode) {
        cout << "dll open fail" << endl;
        return 1;
    }
    for (int i = 0; i < 3; i++) {
        auto len = wcslen(argv[i + 2]) + 1;
        if (len > BUFFER_SIZE)
            len = BUFFER_SIZE;
        wcscpy_s(userDictBuffer.data() + i * USER_DICT_PATH_SIZE, len, argv[i + 2]);
    }
    DJC_OpenAllUserDic_Unicode(userDictBuffer.data(), 0);
    // cout << "ok" << endl;

    while (1) {
        memset(input.data(), 0, sizeof(input));
        uint16_t s;
        *(uint8_t *)&s = cin.get();
        *((uint8_t *)&s + 1) = cin.get();
        if (s == 0)
            break;
        for (int i = 0; i < s; i++) {
            char c = cin.get();
            if (i < BUFFER_SIZE)
                input[i] = c;
        }
        bufferSize = bufferSize2 = BUFFER_SIZE;
        JC_Transfer_Unicode(NULL, 932, 950, 1, 1, input.data(), output.data(), &bufferSize, buf.data(), &bufferSize2);
        uint16_t outputSize = 0;
        for (int i = 0; i < BUFFER_SIZE; i += 2) {
            if (output[i] == 0 && output[i + 1] == 0) {
                outputSize = i;
                break;
            }
        }
        cout.put(*(uint8_t *)&outputSize);
        cout.put(*((uint8_t *)&outputSize + 1));
        for (int i = 0; i < outputSize; i++) {
            cout.put(output[i]);
        }
        cout.flush();
    }
    DJC_CloseAllUserDic(1);
    return 0;
}
