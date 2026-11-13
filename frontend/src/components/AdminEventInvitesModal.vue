<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  Link2,
  Plus,
  Share2,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  X,
} from 'lucide-vue-next';
import api from '../api/client';
import { buildInviteUrl, formatSessionLabel, sessionBadgeClasses } from '../utils/eventSessions';

const props = defineProps<{
  show: boolean;
  event: any | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-vip-card', payload: { event: any; inviteUrl: string; sessionType: string }): void;
}>();

const loading = ref(false);
const invites = ref<any[]>([]);
const qrByLinkId = ref<Record<number, string>>({});
const copiedId = ref<number | null>(null);
const showCreateForm = ref(false);
const creating = ref(false);

const newInviteForm = reactive({
  session_type: 'MORNING' as 'MORNING' | 'AFTERNOON' | 'FULL_DAY',
  max_registrations: 100,
  expires_in_days: 60,
});

const isSplitEvent = computed(() => props.event?.session_mode === 'SPLIT_SESSIONS');

const primaryLinks = computed(() => {
  if (!invites.value.length) return [];
  if (!isSplitEvent.value) {
    const full = invites.value.find((l) => !l.session_type || l.session_type === 'FULL_DAY') || invites.value[0];
    return full ? [full] : [];
  }
  const morning = invites.value.find((l) => l.session_type === 'MORNING');
  const afternoon = invites.value.find((l) => l.session_type === 'AFTERNOON');
  return [morning, afternoon].filter(Boolean);
});

const loadInvites = async () => {
  if (!props.show || !props.event?.id) return;
  loading.value = true;
  try {
    const res = await api.get(`/events/${props.event.id}/invites`);
    const rows = (res.data.data || []).map((inv: any) => ({
      ...inv,
      invite_url: buildInviteUrl(inv.token) || inv.invite_url || inv.url || '',
    }));
    invites.value = rows;

    const qrMap: Record<number, string> = {};
    for (const inv of rows) {
      if (inv.invite_url) {
        try {
          qrMap[inv.id] = await QRCode.toDataURL(inv.invite_url, { width: 320, margin: 2 });
        } catch {
          // ignore single QR error
        }
      }
    }
    qrByLinkId.value = qrMap;
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  } finally {
    loading.value = false;
  }
};

watch(
  [() => props.show, () => props.event?.id],
  ([visible, evId]) => {
    if (visible && evId) {
      newInviteForm.session_type = props.event?.session_mode === 'SPLIT_SESSIONS' ? 'MORNING' : 'FULL_DAY';
      newInviteForm.max_registrations =
        props.event?.session_mode === 'SPLIT_SESSIONS'
          ? Number(props.event?.morning_capacity || 100)
          : Number(props.event?.capacity || 500);
      showCreateForm.value = false;
      loadInvites();
    }
  },
  { immediate: true }
);

const copyUrl = async (link: any) => {
  if (!link?.invite_url) return;
  await navigator.clipboard.writeText(link.invite_url);
  copiedId.value = link.id;
  setTimeout(() => {
    if (copiedId.value === link.id) copiedId.value = null;
  }, 2000);
};

const shareUrl = async (link: any) => {
  if (!link?.invite_url) return;
  const sessionText = isSplitEvent.value ? ` (${formatSessionLabel(link.session_type)})` : '';
  const eventName = props.event?.name || 'Sự kiện';
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Thư mời${sessionText}: ${eventName}`,
        text: `Trân trọng kính mời bạn tham gia ${eventName}${sessionText}. Đăng ký nhận vé QR tại: ${link.invite_url}`,
        url: link.invite_url,
      });
      return;
    } catch {
      // fallback copy
    }
  }
  await copyUrl(link);
};

const handleCreateMore = async () => {
  if (!props.event?.id) return;
  creating.value = true;
  try {
    await api.post(`/events/${props.event.id}/invites`, {
      session_type: isSplitEvent.value ? newInviteForm.session_type : 'FULL_DAY',
      max_registrations: Number(newInviteForm.max_registrations || 100),
      expires_in_days: Number(newInviteForm.expires_in_days || 60),
    });
    showCreateForm.value = false;
    await loadInvites();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  } finally {
    creating.value = false;
  }
};
</script>

<template>
  <div v-if="show" class="modal-backdrop">
    <div class="modal-content max-w-3xl max-h-[90vh] overflow-y-auto space-y-5">
      <div class="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-0.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-[10px] font-black uppercase">
              {{ isSplitEvent ? '2 Link Sáng & Chiều' : 'Link mời sự kiện' }}
            </span>
            <span class="text-xs text-slate-400 font-mono">ID: #{{ event?.id }}</span>
          </div>
          <h3 class="text-base font-black text-slate-900 mt-1">{{ event?.name }}</h3>
          <p class="text-xs text-slate-500">
            <template v-if="isSplitEvent">
              Sức chứa tối đa {{ event?.capacity }} khách (Sáng: {{ event?.morning_capacity }} | Chiều: {{ event?.afternoon_capacity }})
            </template>
            <template v-else>
              Link đăng ký dùng chung cho cả ngày (Tối đa: {{ event?.capacity }} khách)
            </template>
          </p>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div v-if="loading" class="py-10 text-center text-xs font-bold text-slate-500">
        Đang tải link mời &amp; mã QR...
      </div>

      <template v-else>
        <!-- Primary Session Link Cards -->
        <div
          class="grid gap-4"
          :class="isSplitEvent ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'"
        >
          <div
            v-for="link in primaryLinks"
            :key="link.id"
            class="p-4 rounded-2xl border space-y-3"
            :class="link.session_type === 'MORNING'
              ? 'bg-amber-50/40 border-amber-200'
              : link.session_type === 'AFTERNOON'
              ? 'bg-indigo-50/40 border-indigo-200'
              : 'bg-slate-50 border-slate-200'"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border"
                :class="sessionBadgeClasses(link.session_type)"
              >
                <Sunrise v-if="link.session_type === 'MORNING'" class="w-3.5 h-3.5" />
                <Sunset v-else-if="link.session_type === 'AFTERNOON'" class="w-3.5 h-3.5" />
                <Sun v-else class="w-3.5 h-3.5" />
                <span>Link {{ formatSessionLabel(link.session_type) }}</span>
              </span>
              <span class="text-[11px] font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                {{ link.session_registered ?? link.current_registrations ?? 0 }} / {{ link.session_capacity ?? link.max_registrations }} khách
              </span>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 items-center">
              <div class="p-2 bg-white rounded-xl border border-slate-200 shrink-0 text-center">
                <img
                  v-if="qrByLinkId[link.id]"
                  :src="qrByLinkId[link.id]"
                  :alt="`QR ${formatSessionLabel(link.session_type)}`"
                  class="w-28 h-28 object-contain"
                />
                <a
                  v-if="qrByLinkId[link.id]"
                  :href="qrByLinkId[link.id]"
                  :download="`QR-${event?.name || 'sukien'}-${link.session_type}.png`"
                  class="mt-1.5 inline-flex items-center justify-center gap-1 text-[10px] font-bold text-primary-700 hover:underline"
                >
                  <Download class="w-3 h-3" /> Tải QR
                </a>
              </div>

              <div class="flex-1 w-full space-y-2.5 min-w-0">
                <div class="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl">
                  <Link2 class="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  <input
                    readonly
                    :value="link.invite_url"
                    class="flex-1 text-xs font-mono font-bold text-primary-700 bg-transparent border-0 outline-none select-all truncate"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    @click="copyUrl(link)"
                    class="btn btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check v-if="copiedId === link.id" class="w-3.5 h-3.5" />
                    <Copy v-else class="w-3.5 h-3.5" />
                    <span>{{ copiedId === link.id ? 'Đã chép' : 'Sao chép' }}</span>
                  </button>
                  <button
                    type="button"
                    @click="shareUrl(link)"
                    class="btn btn-secondary py-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Share2 class="w-3.5 h-3.5" />
                    <span>Chia sẻ</span>
                  </button>
                </div>

                <button
                  type="button"
                  @click="emit('open-vip-card', { event, inviteUrl: link.invite_url, sessionType: link.session_type })"
                  class="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:from-amber-600 hover:to-orange-600"
                >
                  <Sparkles class="w-3.5 h-3.5" />
                  <span>Tạo thiệp VIP ({{ formatSessionLabel(link.session_type) }})</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional links list + create form -->
        <div class="pt-3 border-t border-slate-100 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-700">
              Tất cả link mời đã tạo ({{ invites.length }})
            </span>
            <button
              type="button"
              @click="showCreateForm = !showCreateForm"
              class="btn btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>{{ showCreateForm ? 'Đóng form' : 'Tạo thêm link' }}</span>
            </button>
          </div>

          <form v-if="showCreateForm" @submit.prevent="handleCreateMore" class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 items-end text-xs">
            <div v-if="isSplitEvent">
              <label class="block font-bold text-slate-700 mb-1">Khung buổi</label>
              <select v-model="newInviteForm.session_type" class="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold">
                <option value="MORNING">🌅 Buổi sáng</option>
                <option value="AFTERNOON">🌇 Buổi chiều</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Số khách tối đa (link này)</label>
              <input v-model.number="newInviteForm.max_registrations" type="number" min="1" max="10000" required class="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold" />
            </div>
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="block font-bold text-slate-700 mb-1">Hạn (ngày)</label>
                <input v-model.number="newInviteForm.expires_in_days" type="number" min="1" max="365" required class="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold" />
              </div>
              <button type="submit" :disabled="creating" class="btn btn-primary py-2 px-3 text-xs font-bold self-end cursor-pointer">
                {{ creating ? 'Đang tạo...' : 'Tạo link' }}
              </button>
            </div>
          </form>

          <div v-if="invites.length > primaryLinks.length" class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
            <div v-for="l in invites" :key="l.id" class="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
              <div class="flex items-center gap-2 min-w-0">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0" :class="sessionBadgeClasses(l.session_type)">
                  {{ formatSessionLabel(l.session_type) }}
                </span>
                <span class="font-bold text-slate-800 truncate">{{ l.referrer_name }}</span>
                <span class="font-mono text-[11px] text-slate-400">#{{ l.token }}</span>
              </div>
              <div class="flex items-center gap-2.5 shrink-0">
                <span class="text-[11px] text-slate-500 font-semibold">
                  {{ l.current_registrations }}/{{ l.max_registrations }} khách
                </span>
                <button type="button" @click="copyUrl(l)" class="text-primary-600 font-bold hover:underline cursor-pointer">
                  {{ copiedId === l.id ? 'Đã chép!' : 'Sao chép' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
