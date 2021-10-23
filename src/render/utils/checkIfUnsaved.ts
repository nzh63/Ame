import type { RouteLocationNormalized, Router } from 'vue-router';
import { h } from 'vue';
import notification from 'ant-design-vue/es/notification';
import Button from 'ant-design-vue/es/button';
import Space from 'ant-design-vue/es/space';

export function checkIfUnsaved(hasChange: () => boolean, router: Router) {
    let skipCheck = false;
    return (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
        if (hasChange()) {
            if (skipCheck) {
                skipCheck = true;
                return true;
            }
            const key = 'ask-to-save';
            notification.info({
                key,
                duration: null,
                message: h('div', [
                    '您有未保存的内容，确定要离开吗？'
                ]),
                description: h('div', [
                    h(Space, {}, {
                        default: () => [
                            h(Button, {
                                type: 'primary',
                                onClick: () => notification.close(key)
                            }, () => '不要离开'),
                            h(Button, {
                                onClick: () => {
                                    skipCheck = true;
                                    notification.close(key);
                                    router.push(to);
                                }
                            }, () => '离开，且不要保存')
                        ]
                    })
                ])
            });
            return false;
        }
        return true;
    };
}
