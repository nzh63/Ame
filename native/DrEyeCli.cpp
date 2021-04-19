#include <Windows.h>
#include <array>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>

using namespace std;

constexpr auto BUFFER_SIZE = 4096;

array<char, BUFFER_SIZE> input;
array<char, BUFFER_SIZE> output;

int(__cdecl *MTInit)(int dat_index);
int(__cdecl *MTEnd)();
int(__cdecl *TranTextFlow)(void *src, void *dest, int dest_size, int dat_index);

int main(int argc, char **argv) {
    HMODULE dll = LoadLibrary(argv[1]);
    if (!dll) {
        cout << "dll open fail" << endl;
        return 1;
    }
    MTInit = (int(__cdecl *)(int))GetProcAddress(dll, argv[2]);
    MTEnd = (int(__cdecl *)())GetProcAddress(dll, argv[3]);
    TranTextFlow = (int(__cdecl *)(void *, void *, int, int))GetProcAddress(dll, argv[4]);
    if (!MTInit || !MTEnd || !TranTextFlow) {
        cout << "dll open fail" << endl;
        return 1;
    }
    int dat_index = atoi(argv[5]);
    MTInit(dat_index);

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
        TranTextFlow(input.data(), output.data(), BUFFER_SIZE, dat_index);
        uint16_t outputSize = 0;
        for (int i = 0; i < BUFFER_SIZE; i++) {
            if (output[i] == 0) {
                outputSize = i;
                break;
            }
        }
        cout.put(*(uint8_t *)&outputSize);
        cout.put(*((uint8_t *)&outputSize + 1));
        for (int i = 0; i < outputSize; i++) {
            cout.put(output[i]);
        }
    }
    MTEnd();
    return 0;
}
