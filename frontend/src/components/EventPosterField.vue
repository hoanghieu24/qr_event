<script setup lang="ts">
import { ref, computed } from 'vue';
import { Image as ImageIcon, Upload, Link2, RotateCcw, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  modelValue?: string | null;
  eventName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80';

const PRESET_POSTERS = [
  {
    label: '🎉 Khai trương / Lễ kỷ niệm',
    url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80',
  },
  {
    label: '🏢 Hội nghị / Tọa đàm',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
  },
  {
    label: '🥂 Gala / Tiệc VIP',
    url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1600&q=80',
  },
  {
    label: '🚀 Ra mắt sản phẩm',
    url: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&q=80',
  },
  {
    label: '🎊 Sân khấu sự kiện',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80',
  },
];

const fileInputRef = ref<HTMLInputElement | null>(null);
const processingImage = ref(false);
const uploadError = ref('');
const showUrlInput = ref(false);

const previewUrl = computed(() => {
  const v = String(props.modelValue || '').trim();
  return v || DEFAULT_POSTER;
});

const isDataUrl = computed(() => String(props.modelValue || '').startsWith('data:image/'));

const urlInputValue = computed({
  get: () => (isDataUrl.value ? '' : String(props.modelValue || '')),
  set: (val: string) => emit('update:modelValue', val.trim()),
});

const triggerFileSelect = () => {
  uploadError.value = '';
  fileInputRef.value?.click();
};

const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ.'));
      img.onload = () => {
        const maxWidth = 1280;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressed);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
};

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Vui lòng chọn file hình ảnh (JPG, PNG, WEBP...).';
    input.value = '';
    return;
  }

  processingImage.value = true;
  uploadError.value = '';
  try {
    const dataUrl = await compressImageFile(file);
    emit('update:modelValue', dataUrl);
  } catch (err: any) {
    uploadError.value = err?.message || 'Không thể xử lý ảnh.';
  } finally {
    processingImage.value = false;
    input.value = '';
  }
};
</script>

<template>
  <div class="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-1.5">
        <ImageIcon :size="15" class="text-primary-600" />
        <span class="text-xs font-bold text-slate-800">Ảnh nền / Ảnh bìa trang thư mời</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          @click="triggerFileSelect"
          :disabled="processingImage"
          class="px-2.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
        >
          <Upload :size="13" />
          <span>{{ processingImage ? 'Đang xử lý...' : 'Tải ảnh từ máy / ĐT' }}</span>
        </button>
        <button
          type="button"
          @click="showUrlInput = !showUrlInput"
          class="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
        >
          <Link2 :size="13" />
          <span>Dán link ảnh</span>
        </button>
        <button
          v-if="modelValue"
          type="button"
          @click="emit('update:modelValue', '')"
          class="px-2 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
          title="Khôi phục ảnh mặc định"
        >
          <RotateCcw :size="12" />
        </button>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />

    <!-- Live Preview Card (giống giao diện trang thư mời) -->
    <div
      class="relative overflow-hidden rounded-2xl border border-slate-200/90 h-36 sm:h-40 bg-slate-900 group cursor-pointer"
      @click="triggerFileSelect"
      title="Bấm để tải ảnh nền mới từ thiết bị"
    >
      <img
        :src="previewUrl"
        alt="Ảnh nền sự kiện"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
      <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
        <span class="px-2 py-0.5 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-[10px] font-bold border border-white/15">
          EventGo
        </span>
        <span class="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold">
          Xem trước trang thư mời
        </span>
      </div>
      <div class="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
        <p class="text-white font-black text-sm sm:text-base leading-snug line-clamp-2 drop-shadow">
          {{ eventName || 'Tên sự kiện sẽ hiển thị tại đây' }}
        </p>
        <span class="shrink-0 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold border border-white/20">
          📷 Đổi ảnh
        </span>
      </div>
    </div>

    <p v-if="uploadError" class="text-[11px] text-rose-600 font-semibold">{{ uploadError }}</p>
    <p v-else-if="isDataUrl" class="text-[11px] text-emerald-700 font-semibold">
      ✓ Đã chọn ảnh tải lên từ thiết bị (tự động tối ưu dung lượng chuẩn HD).
    </p>

    <!-- Dán link ảnh trực tiếp -->
    <div v-if="showUrlInput" class="pt-1">
      <input
        v-model="urlInputValue"
        type="url"
        placeholder="Dán đường dẫn ảnh trực tiếp (https://.../banner.jpg)"
        class="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
      />
    </div>

    <!-- Chọn nhanh mẫu ảnh nền đẹp -->
    <div class="space-y-1.5">
      <div class="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
        <Sparkles :size="12" class="text-amber-500" />
        <span>Hoặc chọn nhanh mẫu ảnh nền theo chủ đề:</span>
      </div>
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          v-for="preset in PRESET_POSTERS"
          :key="preset.url"
          type="button"
          @click="emit('update:modelValue', preset.url)"
          class="px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap shrink-0 transition cursor-pointer"
          :class="previewUrl === preset.url ? 'bg-primary-600 text-white border-primary-600 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>
  </div>
</template>
