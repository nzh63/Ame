#include <node_api.h>

using PID = DWORD;

#define NAPI_CALL_EXPECT_GOTOERR(f, err, expect, errorMsg, env)                                                        \
    do {                                                                                                               \
        napi_status status;                                                                                            \
        status = (f);                                                                                                  \
        if (status != napi_ok)                                                                                         \
            goto err;                                                                                                  \
        if (!(expect))                                                                                                 \
            napi_throw_error((env), nullptr, (errorMsg));                                                              \
    } while (0)
#define NAPI_CALL_GOTOERR(f, err) NAPI_CALL_EXPECT_GOTOERR(f, err, true, "", nullptr)
#define NAPI_CALL_EXPECT(f, expect, errorMsg, env) NAPI_CALL_EXPECT_GOTOERR(f, err, expect, errorMsg, env)
#define NAPI_CALL(f) NAPI_CALL_GOTOERR(f, err)

inline napi_value createError(napi_env env, const char *code, const char *msg) {
    napi_value error, _code, _msg;
    if (code)
        napi_create_string_utf8(env, code, -1, &_code);
    else
        _code = nullptr;
    napi_create_string_utf8(env, msg == nullptr ? "" : msg, -1, &_msg);
    napi_create_error(env, _code, _msg, &error);
    return error;
}
inline napi_value handelError(napi_env env) {
    const napi_extended_error_info *error_info = nullptr;
    NAPI_CALL(napi_get_last_error_info(env, &error_info));
    bool is_pending;
    NAPI_CALL(napi_is_exception_pending(env, &is_pending));
    if (!is_pending) {
        const char *message = (error_info == nullptr || error_info->error_message == nullptr)
                                  ? "empty error message"
                                  : error_info->error_message;
        return createError(env, nullptr, message);
    }
err:
    return createError(env, nullptr, "unknown error");
}

inline napi_value throwError(napi_env env) {
    auto error = handelError(env);
    napi_throw(env, error);
    return nullptr;
}