<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Sun, Sunrise, Sunset } from 'lucide-vue-next';
import { splitDefaultCapacities } from '../utils/eventSessions';

const props = defineProps<{
  sessionMode: 'FULL_DAY' | 'SPLIT_SESSIONS';
  morningCapacity: number | null;
  afternoonCapacity: number | null;
  capacity: number;
}>();

const emit = defineEmits<{
  (e: 'update:sessionMode', val: 'FULL_DAY' | 'SPLIT_SESSIONS'): void;
  (e: 'update:morningCapacity', val: number): void;
  (e: 'update:afternoonCapacity', val: number): void;
}>();

const activeTab = ref<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>(
  props.sessionMode === 'SPLIT_SESSIONS' ? 'MORNING' : 'FULL_DAY'
);

watch(
  () => props.sessionMode,
  (mode) => {
    if (mode === 'FULL_DAY') {
      activeTab.value = 'FULL_DAY';
    } else if (activeTab.value === 'FULL_DAY') {
      activeTab.value = 'MORNING';
    }
  }
);

const safeCap = computed(() => Math.max(1, Math.floor(Number(props.capacity) || 1)));
const morningVal = computed(() => Math.max(0, Math.floor(Number(props.morningCapacity ?? 0))));
const afternoonVal = computed(() => Math.max(0, Math.floor(Number(props.afternoonCapacity ?? 0))));
const allocatedTotal = computed(() => morningVal.value + afternoonVal.value);
const isOverLimit = computed(() => allocatedTotal.value > safeCap.value);
const isZeroTotal = computed(() => allocatedTotal.value <= 0);

const applyEvenSplit = () => {
  const { morning, afternoon } = splitDefaultCapacities(safeCap.value);
  emit('update:morningCapacity', morning);
  emit('update:afternoonCapacity', afternoon);
};

const selectOption = (opt: 'FULL_DAY' | 'MORNING' | 'AFTERNOON') => {
  activeTab.value = opt;
  if (opt === 'FULL_DAY') {
    emit('update:sessionMode', 'FULL_DAY');
    return;
  }

  emit('update:sessionMode', 'SPLIT_SESSIONS');
  const currentSum = morningVal.value + afternoonVal.value;
  if (
    props.morningCapacity === null ||
    props.afternoonCapacity === null ||
    currentSum <= 0 ||
    currentSum > safeCap.value
  ) {
    applyEvenSplit();
  }
};

const onMorningInput = (event: Event) => {
  const raw = Number((event.target as HTMLInputElement).value);
  emit('update:morningCapacity', Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0);
};

const onAfternoonInput = (event: Event) => {
  const raw = Number((event.target as HTMLInputElement).value);
  emit('update:afternoonCapacity', Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0);
};
</script>

<template>
  <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <label class="block text-xs font-black text-slate-900">
        Tùy chọn khung buổi & Link đăng ký
      </label>
      <span
        class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
        :class="sessionMode === 'SPLIT_SESSIONS'
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : 'bg-sky-50 text-sky-700 border-sky-200'"
      >
        {{ sessionMode === 'SPLIT_SESSIONS' ? 'Tạo 2 link: Sáng & Chiều' : 'Tạo 1 link Cả ngày' }}
      </span>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <button
        type="button"
        @click="selectOption('FULL_DAY')"
        class="p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer"
        :class="activeTab === 'FULL_DAY'
          ? 'border-primary-500 bg-primary-50 text-primary-900 ring-2 ring-primary-500/40 font-bold'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
      >
        <div class="flex items-center gap-1.5 text-xs font-bold">
          <Sun class="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Cả ngày</span>
        </div>
        <span class="text-[10px] text-slate-500 font-normal">1 link chung</span>
      </button>

      <button
        type="button"
        @click="selectOption('MORNING')"
        class="p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer"
        :class="sessionMode === 'SPLIT_SESSIONS' && activeTab === 'MORNING'
          ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-400/50 font-bold'
          : sessionMode === 'SPLIT_SESSIONS'
          ? 'border-amber-300 bg-amber-50/40 text-amber-900'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
      >
        <div class="flex items-center gap-1.5 text-xs font-bold">
          <Sunrise class="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Sáng</span>
        </div>
        <span class="text-[10px] text-slate-500 font-normal">Chia 2 link</span>
      </button>

      <button
        type="button"
        @click="selectOption('AFTERNOON')"
        class="p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer"
        :class="sessionMode === 'SPLIT_SESSIONS' && activeTab === 'AFTERNOON'
          ? 'border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-400/50 font-bold'
          : sessionMode === 'SPLIT_SESSIONS'
          ? 'border-indigo-300 bg-indigo-50/40 text-indigo-900'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
      >
        <div class="flex items-center gap-1.5 text-xs font-bold">
          <Sunset class="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Chiều</span>
        </div>
        <span class="text-[10px] text-slate-500 font-normal">Chia 2 link</span>
      </button>
    </div>

    <div v-if="sessionMode === 'SPLIT_SESSIONS'" class="pt-1 space-y-2.5 border-t border-slate-200/80">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="p-2.5 bg-white rounded-xl border border-amber-200">
          <label class="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 mb-1">
            <Sunrise class="w-3.5 h-3.5 text-amber-600" />
            <span>Số lượng Buổi Sáng</span>
          </label>
          <input
            :value="morningVal"
            @input="onMorningInput"
            type="number"
            min="0"
            :max="safeCap"
            required
            class="w-full p-2 bg-amber-50/50 border border-amber-200 rounded-lg text-sm font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div class="p-2.5 bg-white rounded-xl border border-indigo-200">
          <label class="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 mb-1">
            <Sunset class="w-3.5 h-3.5 text-indigo-600" />
            <span>Số lượng Buổi Chiều</span>
          </label>
          <input
            :value="afternoonVal"
            @input="onAfternoonInput"
            type="number"
            min="0"
            :max="safeCap"
            required
            class="w-full p-2 bg-indigo-50/50 border border-indigo-200 rounded-lg text-sm font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 flex-wrap text-[11px]">
        <div
          class="font-bold"
          :class="isOverLimit || isZeroTotal ? 'text-rose-600' : 'text-emerald-700'"
        >
          Đã chia: {{ allocatedTotal }} / {{ safeCap }} khách
          <span v-if="isOverLimit">(Vượt quá giới hạn tối đa!)</span>
          <span v-else-if="isZeroTotal">(Tổng Sáng + Chiều phải lớn hơn 0)</span>
        </div>
        <button
          type="button"
          @click="applyEvenSplit"
          class="text-primary-700 hover:text-primary-900 font-bold underline cursor-pointer"
        >
          Chia đều 50/50
        </button>
      </div>

      <p class="text-[11px] text-slate-500 leading-relaxed">
        Khi chọn Sáng hoặc Chiều, hệ thống sẽ tạo <b>2 link riêng</b> (Link Buổi Sáng: <b>{{ morningVal }} khách</b> &amp; Link Buổi Chiều: <b>{{ afternoonVal }} khách</b>). Mỗi khách chỉ được đăng ký tối đa 1 vé (Sáng hoặc Chiều).
      </p>
    </div>

    <p v-else class="text-[11px] text-slate-500 leading-relaxed">
      Hệ thống tạo <b>1 link đăng ký duy nhất</b> dùng cho cả ngày với tối đa <b>{{ safeCap }} khách</b>.
    </p>
  </div>
</template>
