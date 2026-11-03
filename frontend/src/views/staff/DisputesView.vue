<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import {
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  UserCheck,
  AlertTriangle,
  RotateCw,
  Search,
  MessageSquare,
  X,
  Send,
  Ticket
} from 'lucide-vue-next';

const disputes = ref<any[]>([]);
const filterDecision = ref<string>('');
const searchQuery = ref('');
const loading = ref(false);

// Modal decision state
const selectedDispute = ref<any>(null);
const decisionAction = ref<'ALLOW' | 'DENY'>('ALLOW');
const decisionNote = ref('');
const submitting = ref(false);

const loadDisputes = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filterDecision.value) params.decision = filterDecision.value;
    const res = await api.get('/disputes', { params });
    disputes.value = res.data.data;
  } catch (e: any) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const filteredDisputes = computed(() => {
  if (!searchQuery.value.trim()) return disputes.value;
  const q = searchQuery.value.toLowerCase().trim();
  return disputes.value.filter((d: any) =>
    d.ticket_code?.toLowerCase().includes(q) ||
    d.original_attendee_name?.toLowerCase().includes(q) ||
    d.claimant_name?.toLowerCase().includes(q) ||
    d.event_name?.toLowerCase().includes(q) ||
    d.claimant_phone?.includes(q)
  );
});

const openResolveModal = (item: any, decision: 'ALLOW' | 'DENY') => {
  selectedDispute.value = item;
  decisionAction.value = decision;
  decisionNote.value = '';
};

const closeResolveModal = () => {
  selectedDispute.value = null;
  decisionNote.value = '';
};

const submitDecision = async () => {
  if (!selectedDispute.value) return;
  submitting.value = true;
  try {
    await api.put(`/disputes/${selectedDispute.value.id}/resolve`, {
      decision: decisionAction.value,
      decision_note: decisionNote.value,
    });
    closeResolveModal();
    await loadDisputes();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  loadDisputes();

  const socket = getSocket();
  socket.on('dispute:updated', () => {
    loadDisputes();
  });
});

onUnmounted(() => {
  const socket = getSocket();
  socket.off('dispute:updated');
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-4 space-y-6 animate-page-in">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <Scale class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Ban Trọng Tài & Tranh Chấp Vé
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Xử lý các trường hợp quét trùng mã QR vé hoặc giải trình tại cổng soát vé
            </p>
          </div>
        </div>
      </div>

      <button
        @click="loadDisputes"
        class="btn btn-secondary text-xs self-stretch sm:self-auto"
        :disabled="loading"
      >
        <RotateCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        <span>Làm mới</span>
      </button>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="card p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
      <!-- Segmented filter buttons -->
      <div class="flex bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar">
        <button
          @click="filterDecision = ''; loadDisputes()"
          :class="filterDecision === '' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'"
          class="px-3.5 py-1.5 rounded-lg transition whitespace-nowrap"
        >
          Tất cả
        </button>
        <button
          @click="filterDecision = 'PENDING'; loadDisputes()"
          :class="filterDecision === 'PENDING' ? 'bg-white shadow-xs text-amber-700' : 'text-slate-600 hover:text-slate-900'"
          class="px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5"
        >
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Chờ xử lý</span>
        </button>
        <button
          @click="filterDecision = 'ALLOW'; loadDisputes()"
          :class="filterDecision === 'ALLOW' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-600 hover:text-slate-900'"
          class="px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Cho vào</span>
        </button>
        <button
          @click="filterDecision = 'DENY'; loadDisputes()"
          :class="filterDecision === 'DENY' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-600 hover:text-slate-900'"
          class="px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5"
        >
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Từ chối</span>
        </button>
      </div>

      <!-- Search input -->
      <div class="relative flex-1 max-w-sm">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm tên khách, mã vé, SĐT..."
          class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
        />
      </div>
    </div>

    <!-- Disputes List -->
    <div class="space-y-4">
      <div v-if="loading && disputes.length === 0" class="card p-12 text-center text-slate-400 text-xs">
        <RotateCw class="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
        <span>Đang tải danh sách hồ sơ tranh chấp...</span>
      </div>

      <div v-else-if="filteredDisputes.length === 0" class="card p-12 text-center text-slate-400 text-xs space-y-2">
        <Scale class="w-8 h-8 mx-auto text-slate-300" />
        <div class="font-bold text-slate-600">Không có hồ sơ nào phù hợp</div>
        <p class="text-[11px] text-slate-400">Các ca quét trùng mã vé từ cổng check-in sẽ hiển thị tại đây.</p>
      </div>

      <div
        v-for="item in filteredDisputes"
        :key="item.id"
        class="card p-5 sm:p-6 space-y-4 hover:shadow-card transition"
      >
        <!-- Card Top Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-mono font-bold">
              #{{ item.id }}
            </span>
            <span class="max-w-full truncate font-black text-sm text-slate-900">{{ item.event_name }}</span>
            <span class="chip chip-slate text-[11px] font-mono">
              <Ticket class="w-3 h-3 text-slate-500" />
              {{ item.ticket_code }}
            </span>
          </div>

          <span
            :class="{
              'chip-amber': item.decision === 'PENDING',
              'chip-success': item.decision === 'ALLOW',
              'chip-danger': item.decision === 'DENY',
            }"
            class="chip text-xs"
          >
            <Clock v-if="item.decision === 'PENDING'" class="w-3 h-3" />
            <CheckCircle2 v-else-if="item.decision === 'ALLOW'" class="w-3 h-3" />
            <XCircle v-else class="w-3 h-3" />
            <span>{{ item.decision === 'PENDING' ? 'Chờ xử lý' : item.decision === 'ALLOW' ? 'Đã cho vào thủ công' : 'Đã từ chối vào' }}</span>
          </span>
        </div>

        <!-- 2-Column Comparison Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <!-- Col 1: Original attendee & first scan -->
          <div class="p-4 bg-slate-50/80 rounded-2xl space-y-2.5 border border-slate-200/80">
            <div class="font-bold text-slate-500 uppercase text-[10px] flex items-center gap-1">
              <User class="w-3 h-3 text-slate-400" />
              <span>1. Khách đăng ký vé gốc</span>
            </div>
            <div>
              <div class="font-extrabold text-sm text-slate-900">{{ item.original_attendee_name }}</div>
              <div class="text-slate-500 font-mono text-[11px] mt-0.5">{{ item.original_phone }}</div>
            </div>
            <div class="text-slate-500 text-[11px] flex items-center gap-1">
              <UserCheck class="w-3.5 h-3.5 text-primary-600" />
              <span>Người giới thiệu: <strong class="text-primary-700">{{ item.referrer_name }}</strong></span>
            </div>
            <div class="pt-2 border-t border-slate-200/70 text-amber-800 text-[11px] flex items-center gap-1.5 font-medium">
              <Clock class="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Quét lần 1: {{ new Date(item.first_used_at).toLocaleString('vi-VN') }}</span>
            </div>
          </div>

          <!-- Col 2: Second claimant & explanation -->
          <div class="p-4 bg-amber-50/60 rounded-2xl space-y-2.5 border border-amber-200/80">
            <div class="font-bold text-amber-800 uppercase text-[10px] flex items-center gap-1">
              <AlertTriangle class="w-3 h-3 text-amber-600" />
              <span>2. Người thứ hai xuất trình vé</span>
            </div>
            <div>
              <div class="font-extrabold text-sm text-slate-900">{{ item.claimant_name }}</div>
              <div class="text-slate-600 font-mono text-[11px] mt-0.5">{{ item.claimant_phone }}</div>
            </div>
            <div class="text-slate-800 bg-white p-3 rounded-xl border border-amber-200/80 text-[11px] italic leading-relaxed">
              "{{ item.explanation }}"
            </div>
            <div class="text-slate-400 text-[10px] pt-1 flex items-center justify-between">
              <span>Ghi nhận bởi: <strong class="text-slate-600">{{ item.recorder_name }}</strong></span>
              <span>{{ new Date(item.created_at).toLocaleTimeString('vi-VN') }}</span>
            </div>
          </div>
        </div>

        <!-- Decision Box / Action Buttons -->
        <div v-if="item.decision === 'PENDING'" class="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            @click="openResolveModal(item, 'DENY')"
            class="btn btn-danger py-2.5 text-xs font-bold"
          >
            <XCircle class="w-3.5 h-3.5" />
            <span>Từ chối vào cổng</span>
          </button>
          <button
            @click="openResolveModal(item, 'ALLOW')"
            class="btn py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
          >
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>Cho phép vào thủ công</span>
          </button>
        </div>

        <!-- Resolved Summary Footer -->
        <div v-else class="pt-2 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
          <div>
            Xử lý bởi: <strong class="text-slate-800">{{ item.decider_name }}</strong> vào {{ new Date(item.decided_at).toLocaleString('vi-VN') }}
          </div>
          <div v-if="item.decision_note" class="italic text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            Ghi chú: "{{ item.decision_note }}"
          </div>
        </div>
      </div>
    </div>

    <!-- RESOLVE DECISION MODAL (Replaces intrusive browser prompt) -->
    <div
      v-if="selectedDispute"
      class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="card my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto p-4 shadow-2xl animate-scale-in sm:p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div
              :class="decisionAction === 'ALLOW' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'"
              class="w-9 h-9 rounded-xl flex items-center justify-center"
            >
              <CheckCircle2 v-if="decisionAction === 'ALLOW'" class="w-5 h-5" />
              <XCircle v-else class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">
                {{ decisionAction === 'ALLOW' ? 'Phê Duyệt Cho Vào Thủ Công' : 'Từ Chối Cho Vào Cổng' }}
              </h3>
              <p class="text-xs text-slate-500">Ca tranh chấp #{{ selectedDispute.id }} • {{ selectedDispute.ticket_code }}</p>
            </div>
          </div>
          <button @click="closeResolveModal" aria-label="Đóng hộp thoại" class="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100">
          <div>Khách giải trình: <strong class="text-slate-900">{{ selectedDispute.claimant_name }}</strong> ({{ selectedDispute.claimant_phone }})</div>
          <div class="text-slate-500 italic truncate">"{{ selectedDispute.explanation }}"</div>
        </div>

        <div class="space-y-1.5 text-xs">
          <label class="block font-bold text-slate-700">Căn cứ & Ghi chú quyết định (lưu vào Audit Log):</label>
          <textarea
            v-model="decisionNote"
            rows="3"
            placeholder="VD: Đã đối chiếu CCCD, khách là đại biểu chính thức do người giới thiệu bảo lãnh..."
            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
          ></textarea>
        </div>

        <div class="flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            @click="closeResolveModal"
            class="btn btn-secondary w-full text-xs sm:w-auto"
            :disabled="submitting"
          >
            Hủy
          </button>
          <button
            type="button"
            @click="submitDecision"
            :class="decisionAction === 'ALLOW' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'btn-danger'"
            class="btn flex w-full items-center justify-center gap-1.5 text-xs font-black shadow-md sm:w-auto"
            :disabled="submitting"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{{ submitting ? 'Đang xử lý...' : 'Xác nhận quyết định' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
