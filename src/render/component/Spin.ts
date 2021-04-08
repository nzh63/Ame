import { defineComponent, h } from 'vue';
import { Spin } from 'ant-design-vue';
import { LoadingOutlined } from '@ant-design/icons-vue';

export default defineComponent({
    render() {
        return h(Spin, {
            spinning: this.spinning,
            indicator: h(LoadingOutlined, { spin: true })
        }, {
            default: () => {
                return this.$slots.default?.();
            }
        });
    },
    props: {
        spinning: {
            type: Boolean,
            default: true
        }
    }
});
