import type { RouteLocationNormalized, Router } from 'vue-router';
import type { Ref } from 'vue';
import { NotifyPlugin, Button, Space } from 'tdesign-vue-next';

export function checkIfUnsaved(hasChange: Ref<boolean>, router: Router) {
    let skipCheck = false;
    return (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
        if (hasChange.value) {
            if (skipCheck) {
                skipCheck = false;
                hasChange.value = false;
                return true;
            }
            const n = NotifyPlugin.info({
                duration: 0,
                offset: [0, 30],
                title: '您有未保存的内容，确定要离开吗？',
                closeBtn: true,
                footer: h => h(Space, {}, {
                    default: () => [
                        h(Button, {
                            theme: 'primary',
                            onClick: () => NotifyPlugin.close(n)
                        }, () => '不要离开'),
                        h(Button, {
                            theme: 'default',
                            onClick: () => {
                                skipCheck = true;
                                NotifyPlugin.close(n);
                                router.push(to);
                            }
                        }, () => '离开，且不要保存')
                    ]
                })
            });
            return false;
        }
        hasChange.value = false;
        return true;
    };
}
