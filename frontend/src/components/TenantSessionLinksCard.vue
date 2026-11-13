<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Link2,
  Maximize2,
  Plus,
  Share2,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-vue-next';
import { formatSessionLabel, sessionBadgeClasses } from '../utils/eventSessions';

const props = defineProps<{
  selectedEvent: any;
  links: any[];
  qrByToken: Record<string, string>;
  loading: boolean;
  copiedKey: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: 'copy', link: any): void;
  (e: 'share', link: any): void;
  (e: 'zoom', link: any): void;
  (e: 'vip-card', link: any): void;
  (e: 'refresh'): void;
  (e: 'create-new'): void;
  (e: 'go-invites'): void;
}>();

const isSplit = computed(() => props.selectedEvent?.session_mode === 'SPLIT_SESSIONS');
</script>

<template>
  <section
    class="card bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 rounded-3xl border border-slate-200/90 space-y-3.5"
    :class="compact ? 'p-4 sm:p-5 shadow-2xs' : 'p-4 sm:p-6 shadow-sm space-y-4'"
  >
    <div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-bold">
          <Sparkles :size="13" class="text-primary-600" />
          <span>{{ isSplit ? '2 Link Sáng & Chiều + Mã QR Chính Thức' : 'Mã QR & Link Mời Chính Thức' }}</span>
        </span>
      </div>

      <button
        v-if="compact"
        type="button"
        @click="emit('go-invites')"
        class="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 cursor-pointer"
      >
        Xem chi tiết <ArrowRight :size="13" />
      </button>
      <button
        v-else
        type="button"
        @click="emit('create-new')"
        class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
      >
        <Plus :size="14" />
        <span>Tạo link mới</span>
      </button>
    </div>

    <div
      class="grid gap-3.5"
      :class="isSplit ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'"
    >
      <div
        v-for="link in links"
        :key="link.token || link.session_type"
        class="p-3.5 rounded-2xl border space-y-3"
        :class="link.session_type === 'MORNING'
          ? 'bg-amber-50/45 border-amber-200/90'
          : link.session_type === 'AFTERNOON'
          ? 'bg-indigo-50/45 border-indigo-200/90'
          : 'bg-white/80 border-slate-200'"
      >
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border"
            :class="sessionBadgeClasses(link.session_type)"
          >
            <Sunrise v-if="link.session_type === 'MORNING'" :size="13" />
            <Sunset v-else-if="link.session_type === 'AFTERNOON'" :size="13" />
            <Sun v-else :size="13" />
            <span>Link {{ formatSessionLabel(link.session_type) }}</span>
          </span>

          <span class="text-[11px] font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
            {{ link.session_registered ?? link.current_registrations ?? 0 }} / {{ link.session_capacity ?? link.max_registrations ?? selectedEvent?.capacity }} khách
          </span>
        </div>

        <div class="grid sm:grid-cols-[126px_1fr] gap-3 items-center">
          <!-- QR Code Mini Box -->
          <div class="flex flex-col items-center gap-1.5 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div
              @click="emit('zoom', link)"
              class="relative p-1 bg-white rounded-xl cursor-pointer hover:scale-102 transition group"
              title="Chạm để phóng to mã QR"
            >
              <img
                v-if="qrByToken[link.token]"
                :src="qrByToken[link.token]"
                :alt="`QR ${formatSessionLabel(link.session_type)}`"
                class="w-24 h-24 object-contain rounded-lg"
              />
              <div v-else class="w-24 h-24 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                <span v-if="loading">Đang tạo...</span>
                <button v-else type="button" @click.stop="emit('refresh')" class="text-primary-600 font-bold underline">Tạo QR</button>
              </div>
              <div v-if="qrByToken[link.token]" class="absolute inset-0 bg-primary-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold gap-1 pointer-events-none">
                <Maximize2 :size="12" /> Phóng to
              </div>
            </div>

            <div class="flex items-center gap-1 w-full">
              <button
                type="button"
                @click="emit('zoom', link)"
                :disabled="!qrByToken[link.token]"
                class="flex-1 py-1 px-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[10px] font-bold flex items-center justify-center gap-0.5 transition cursor-pointer"
              >
                <Maximize2 :size="10" /> Phóng to
              </button>
              <a
                v-if="!compact && qrByToken[link.token]"
                :href="qrByToken[link.token]"
                :download="`QR-${selectedEvent?.name || 'sukien'}-${link.session_type || 'FULL'}.png`"
                class="flex-1 py-1 px-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-0.5 transition cursor-pointer"
              >
                <Download :size="10" /> Tải
              </a>
            </div>
          </div>

          <!-- Link Input & Actions -->
          <div class="space-y-2 min-w-0">
            <div class="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span class="pl-2 text-slate-400 shrink-0"><Link2 :size="14" /></span>
              <input
                readonly
                :value="link.invite_url || (loading ? 'Đang tạo link mời...' : 'Đang lấy link...')"
                class="flex-1 text-xs font-mono font-bold text-primary-700 bg-transparent border-0 outline-none select-all truncate py-1.5"
              />
              <button
                type="button"
                @click="emit('copy', link)"
                :disabled="!link.invite_url"
                class="px-3 py-1.5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer"
              >
                <Check v-if="copiedKey === (link.session_type || 'FULL_DAY')" :size="13" />
                <Copy v-else :size="13" />
                <span>{{ copiedKey === (link.session_type || 'FULL_DAY') ? 'Đã chép' : 'Sao chép' }}</span>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="emit('share', link)"
                :disabled="!link.invite_url"
                class="py-2 px-2.5 rounded-xl bg-white border border-slate-200 hover:border-primary-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
              >
                <Share2 :size="13" class="text-primary-600" />
                <span>Chia sẻ</span>
              </button>
              <button
                type="button"
                @click="emit('vip-card', link)"
                class="py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
              >
                <Sparkles :size="13" />
                <span>Thiệp VIP</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
