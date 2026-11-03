<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Building2, Plus, Search, Users, CalendarDays, ShieldCheck, X, Copy, Check, Power, PackageCheck, CircleDollarSign } from 'lucide-vue-next';
import api from '../../api/client';

const tenants = ref<any[]>([]);
const plans = ref<any[]>([]);
const requests = ref<any[]>([]);
const tenantEvents = ref<any[]>([]);
const loadingTenantEvents = ref(false);

const loadTenantEvents = async () => {
  loadingTenantEvents.value = true;
  try {
    const res = await api.get('/tenants/all-events');
    tenantEvents.value = res.data.data || [];
  } catch (e) {
    console.error(e);
  } finally {
    loadingTenantEvents.value = false;
  }
};

const toggleTenantEvent = async (ev: any) => {
  const willClose = ev.status === 'PUBLISHED';
  if (!confirm(`Xác nhận ${willClose ? 'ĐÓNG' : 'MỞ LẠI'} sự kiện "${ev.name}" của bên ${ev.tenant_name}?`)) return;
  try {
    await api.patch(`/events/${ev.id}/toggle-status`);
    await loadTenantEvents();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Không thể thay đổi trạng thái sự kiện.');
  }
};

const confirmTenantEventPayment = async (ev: any) => {
  if (!confirm(`Xác nhận ${ev.tenant_name} đã thanh toán gói cho sự kiện "${ev.name}"?`)) return;
  try {
    await api.patch(`/events/${ev.id}/confirm-payment`);
    alert('Đã xác nhận thanh toán thành công!');
    await loadTenantEvents();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Lỗi khi xác nhận thanh toán.');
  }
};

const loading = ref(false);
const search = ref('');
const showCreate = ref(false);
const saving = ref(false);
const copied = ref(false);
const notice = ref('');
const createError = ref('');
const form = ref({
  name: '', contact_name: '', contact_email: '', phone: '',
  owner_name: '', owner_email: '', owner_password: '',
});
const createdCredentials = ref<{ tenant: string; email: string; password: string } | null>(null);
const blankPlan = () => ({
  id: 0,
  code: '',
  name: '',
  description: '',
  max_attendees: 200,
  max_employees: 13,
  max_referrers: 10,
  max_scanners: 3,
  price_vnd: 200000,
  is_trial: false,
  status: 'ACTIVE',
  for_all_tenants: true,
  tenant_ids: [] as number[],
});
const planForm = ref(blankPlan());
const planAccountSearch = ref('');

const filteredPlanTenants = computed(() => {
  const q = planAccountSearch.value.trim().toLowerCase();
  if (!q) return tenants.value;
  return tenants.value.filter((t) =>
    [t.name, t.contact_name, t.contact_email, t.owner_email].some((v) =>
      String(v || '').toLowerCase().includes(q)
    )
  );
});

const selectAllPlanTenants = () => {
  const ids = filteredPlanTenants.value.map((t) => t.id);
  const current = new Set(planForm.value.tenant_ids);
  ids.forEach((id) => current.add(id));
  planForm.value.tenant_ids = Array.from(current);
};

const deselectAllPlanTenants = () => {
  const idsToRemove = new Set(filteredPlanTenants.value.map((t) => t.id));
  planForm.value.tenant_ids = planForm.value.tenant_ids.filter((id) => !idsToRemove.has(id));
};

const togglePlanTenant = (id: number) => {
  const idx = planForm.value.tenant_ids.indexOf(id);
  if (idx > -1) {
    planForm.value.tenant_ids.splice(idx, 1);
  } else {
    planForm.value.tenant_ids.push(id);
  }
};
const bankSettings = ref({
  bank_code: 'MB',
  bank_name: 'MBBank',
  bank_account: '0386771868',
  bank_account_name: 'KTS QR EVENT'
});
const savingBank = ref(false);
const saveBankSuccess = ref(false);

const loadBankSettings = async () => {
  try {
    const res = await api.get('/dashboard/settings');
    const data = res.data.data;
    if (data.bank_code) bankSettings.value.bank_code = data.bank_code;
    if (data.bank_name) bankSettings.value.bank_name = data.bank_name;
    if (data.bank_account) bankSettings.value.bank_account = data.bank_account;
    if (data.bank_account_name) bankSettings.value.bank_account_name = data.bank_account_name;
  } catch (e) {
    console.error(e);
  }
};

const saveBankSettings = async () => {
  savingBank.value = true;
  saveBankSuccess.value = false;
  try {
    await api.put('/dashboard/settings', {
      bank_code: bankSettings.value.bank_code,
      bank_name: bankSettings.value.bank_name,
      bank_account: bankSettings.value.bank_account,
      bank_account_name: bankSettings.value.bank_account_name
    });
    saveBankSuccess.value = true;
    setTimeout(() => { saveBankSuccess.value = false; }, 3000);
  } catch (err: any) {
    alert(err.response?.data?.message || 'Không thể lưu cài đặt ngân hàng');
  } finally {
    savingBank.value = false;
  }
};


const visibleTenants = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return tenants.value;
  return tenants.value.filter((tenant) =>
    [tenant.name, tenant.contact_name, tenant.contact_email, tenant.owner_email].some((v) => String(v || '').toLowerCase().includes(term))
  );
});

const load = async () => {
  loading.value = true;
  try {
    const [tenantRes, planRes, requestRes] = await Promise.all([
      api.get('/tenants'), api.get('/subscriptions/plans'), api.get('/subscriptions/requests'),
    ]);
    tenants.value = tenantRes.data.data;
    plans.value = planRes.data.data;
    requests.value = requestRes.data.data;
  } catch (error: any) {
    notice.value = error.response?.data?.message || 'Không tải được danh sách khách thuê.';
  } finally {
    loading.value = false;
  }
};

const editPlan = (plan: any) => {
  planForm.value = {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description || '',
    max_attendees: plan.max_attendees,
    max_employees: plan.max_employees,
    max_referrers: plan.max_referrers,
    max_scanners: plan.max_scanners,
    price_vnd: plan.price_vnd,
    is_trial: Boolean(plan.is_trial),
    status: plan.status,
    for_all_tenants: plan.for_all_tenants !== undefined ? Boolean(plan.for_all_tenants) : true,
    tenant_ids: plan.target_tenant_ids ? [...plan.target_tenant_ids] : [],
  };
};

const savePlan = async () => {
  saving.value = true;
  notice.value = '';
  try {
    const payload = { ...planForm.value };
    if (payload.id) await api.patch(`/subscriptions/plans/${payload.id}`, payload);
    else await api.post('/subscriptions/plans', payload);
    planForm.value = blankPlan();
    await load();
  } catch (error: any) {
    notice.value = error.response?.data?.message || 'Không lưu được gói dịch vụ.';
  } finally {
    saving.value = false;
  }
};

const reviewRequest = async (request: any, status: 'APPROVED' | 'REJECTED') => {
  try {
    await api.patch(`/subscriptions/requests/${request.id}`, { status });
    await load();
  } catch (error: any) {
    notice.value = error.response?.data?.message || 'Không cập nhật được yêu cầu mua gói.';
  }
};

const createTenant = async () => {
  saving.value = true;
  createError.value = '';
  try {
    const payload = {
      ...form.value,
      name: form.value.name.trim(),
      contact_name: form.value.contact_name.trim(),
      contact_email: form.value.contact_email.trim().toLowerCase(),
      phone: form.value.phone.trim(),
      owner_name: form.value.owner_name.trim(),
      owner_email: form.value.owner_email.trim().toLowerCase(),
      owner_password: form.value.owner_password,
    };
    const res = await api.post('/tenants', payload);
    createdCredentials.value = {
      tenant: res.data.data.name,
      email: payload.owner_email,
      password: payload.owner_password,
    };
    form.value = { name: '', contact_name: '', contact_email: '', phone: '', owner_name: '', owner_email: '', owner_password: '' };
    showCreate.value = false;
    await load();
  } catch (error: any) {
    createError.value = error.response?.data?.message || 'Không tạo được khách thuê. Vui lòng kiểm tra kết nối và thử lại.';
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (tenant: any) => {
  const next = tenant.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
  try {
    await api.patch(`/tenants/${tenant.id}/status`, { status: next });
    tenant.status = next;
  } catch (error: any) {
    notice.value = error.response?.data?.message || 'Không cập nhật được trạng thái.';
  }
};

const copyCredentials = async () => {
  if (!createdCredentials.value) return;
  const { tenant, email, password } = createdCredentials.value;
  const portalUrl = `${window.location.origin}/tenant`;
  await navigator.clipboard.writeText(`Cổng quản lý sự kiện khách thuê: ${portalUrl}\nĐơn vị: ${tenant}\nEmail: ${email}\nMật khẩu: ${password}`);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1800);
};

onMounted(() => { load(); loadBankSettings(); loadTenantEvents(); });
</script>

<template>
  <main class="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <a href="/admin" class="text-sm font-semibold text-primary-700 hover:text-primary-900">← Trung tâm quản trị</a>
        <div class="mt-4 flex items-center gap-3">
          <div class="grid h-12 w-12 place-items-center rounded-2xl bg-primary-100 text-primary-700"><Building2 class="h-6 w-6" /></div>
          <div>
            <p class="eyebrow">Quản lý đối tác</p>
            <h1 class="text-2xl font-black tracking-tight text-slate-900">Khách thuê</h1>
          </div>
        </div>
        <p class="mt-2 text-sm text-slate-500">Tạo tài khoản quản lý và kết nối đơn vị với các sự kiện.</p>
      </div>
      <button class="btn btn-primary" @click="showCreate = true"><Plus class="h-4 w-4" />Thêm khách thuê</button>
    </header>

    <p class="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">Mỗi tài khoản có 3 sự kiện dùng thử. Cấu hình một gói miễn phí đánh dấu “Gói dùng thử”; sau đó khách mua riêng một gói cho từng sự kiện. Khách thuê tự vận hành sự kiện, admin chỉ quản lý tài khoản, gói và xác nhận thanh toán.</p>

    <section class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form class="card space-y-4 p-5" @submit.prevent="savePlan">
        <div class="flex items-center gap-2"><PackageCheck class="h-5 w-5 text-primary-700" /><div><h2 class="font-bold text-slate-900">{{ planForm.id ? 'Cập nhật gói' : 'Tạo gói sự kiện' }}</h2><p class="text-xs text-slate-500">Mỗi gói áp dụng cho một sự kiện và giới hạn quy mô của sự kiện đó.</p></div></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="field-wrap sm:col-span-2"><span class="field-label">Tên gói</span><input v-model="planForm.name" class="field" required placeholder="200 khách · 3 soát vé" /></label>
          <label class="field-wrap"><span class="field-label">Khách tham gia tối đa</span><input v-model.number="planForm.max_attendees" type="number" min="1" class="field" required /></label>
          <label class="field-wrap"><span class="field-label">Tổng nhân sự được gán tối đa</span><input v-model.number="planForm.max_employees" type="number" min="0" class="field" required /></label>
          <label class="field-wrap"><span class="field-label">Người giới thiệu tối đa</span><input v-model.number="planForm.max_referrers" type="number" min="0" class="field" required /></label>
          <label class="field-wrap"><span class="field-label">Người soát vé tối đa</span><input v-model.number="planForm.max_scanners" type="number" min="0" class="field" required /></label>
          <label class="field-wrap sm:col-span-2"><span class="field-label">Giá cho một sự kiện (VND)</span><input v-model.number="planForm.price_vnd" type="number" min="0" class="field" required /></label>
          <label class="field-wrap sm:col-span-2"><span class="field-label">Mô tả</span><input v-model="planForm.description" class="field" placeholder="Thông tin gói cho khách thuê" /></label>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="planForm.is_trial" type="checkbox" />Đây là gói dùng thử 3 sự kiện (giá phải bằng 0)</label>
        
        <!-- Cấu hình hiển thị tài khoản nào được xem/mua gói -->
        <div class="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                <Users class="h-4 w-4 text-primary-600" />
                <span>Tài khoản được xem & thuê gói</span>
              </div>
              <p class="text-xs text-slate-500">Chỉ định tài khoản khách thuê có quyền thấy gói này khi tạo sự kiện</p>
            </div>
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  :class="planForm.for_all_tenants ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-100 text-primary-800'">
              {{ planForm.for_all_tenants ? '🌐 Tất cả tài khoản' : `🎯 ${planForm.tenant_ids.length} tài khoản đã chọn` }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label class="flex items-center gap-2 cursor-pointer rounded-lg border p-2.5 transition select-none"
                   :class="planForm.for_all_tenants ? 'border-primary-600 bg-primary-50 text-primary-900 font-semibold ring-1 ring-primary-500' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'">
              <input type="radio" :value="true" v-model="planForm.for_all_tenants" class="accent-primary-600" />
              <span>🌐 Mở cho tất cả tài khoản</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer rounded-lg border p-2.5 transition select-none"
                   :class="!planForm.for_all_tenants ? 'border-primary-600 bg-primary-50 text-primary-900 font-semibold ring-1 ring-primary-500' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'">
              <input type="radio" :value="false" v-model="planForm.for_all_tenants" class="accent-primary-600" />
              <span>🎯 Chỉ định tài khoản cụ thể</span>
            </label>
          </div>

          <!-- Box tích chọn tài khoản khi chọn cụ thể -->
          <div v-if="!planForm.for_all_tenants" class="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div class="relative flex-1">
                <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input 
                  v-model="planAccountSearch" 
                  type="text" 
                  placeholder="Tìm tài khoản theo tên, email..." 
                  class="w-full rounded-md border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button 
                  type="button" 
                  class="rounded-md border border-primary-200 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 text-xs font-bold text-primary-800 transition flex items-center gap-1"
                  @click="selectAllPlanTenants"
                >
                  <Check class="h-3.5 w-3.5" />
                  <span>Tích cả ({{ filteredPlanTenants.length }})</span>
                </button>
                <button 
                  type="button" 
                  class="rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 transition"
                  @click="deselectAllPlanTenants"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <!-- Danh sách checkbox -->
            <div class="max-h-44 overflow-y-auto divide-y divide-slate-100 rounded-md border border-slate-200">
              <div 
                v-for="t in filteredPlanTenants" 
                :key="t.id"
                class="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer text-xs"
                @click="togglePlanTenant(t.id)"
              >
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    :checked="planForm.tenant_ids.includes(t.id)" 
                    @change="togglePlanTenant(t.id)" 
                    @click.stop
                    class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span class="font-bold text-slate-800">{{ t.name }}</span>
                    <span class="text-[11px] text-slate-500 ml-1.5">({{ t.contact_email || t.owner_email || 'Không có email' }})</span>
                  </div>
                </label>
                <span 
                  v-if="planForm.tenant_ids.includes(t.id)" 
                  class="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"
                >
                  ✓ Đã chọn
                </span>
              </div>
              <div v-if="!filteredPlanTenants.length" class="p-4 text-center text-xs text-slate-400">
                Không tìm thấy tài khoản khách thuê nào phù hợp.
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] pt-0.5">
              <span class="text-slate-600">
                Đã chọn: <strong class="text-primary-700">{{ planForm.tenant_ids.length }}</strong> / {{ tenants.length }} tài khoản
              </span>
              <span v-if="!planForm.tenant_ids.length" class="text-amber-600 font-semibold">
                ⚠️ Chưa chọn tài khoản nào (gói sẽ bị ẩn hoàn toàn)
              </span>
            </div>
          </div>
        </div>

        <label class="field-wrap sm:col-span-2"><span class="field-label">Trạng thái gói</span><select v-model="planForm.status" class="field"><option value="ACTIVE">Đang mở bán</option><option value="INACTIVE">Tạm ẩn</option></select></label><div class="flex justify-end gap-2"><button v-if="planForm.id" type="button" class="btn btn-secondary" @click="planForm = blankPlan()">Hủy sửa</button><button class="btn btn-primary" :disabled="saving"><Plus class="h-4 w-4" />{{ planForm.id ? 'Lưu gói' : 'Thêm gói' }}</button></div>
        <div class="divide-y divide-slate-100 border-t border-slate-100">
          <article v-for="plan in plans" :key="plan.id" class="flex items-center justify-between gap-3 py-3">
            <div>
              <b class="text-sm text-slate-800">{{ plan.name }} <span v-if="plan.is_trial" class="text-emerald-700">· Dùng thử</span></b>
              <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span v-if="plan.for_all_tenants" class="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  🌐 Tất cả tài khoản
                </span>
                <span v-else class="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-200">
                  🎯 Cấp riêng cho {{ (plan.target_tenant_ids || []).length }} tài khoản
                </span>
              </div>
              <p class="mt-0.5 text-xs text-slate-500">{{ plan.max_attendees }} khách · {{ plan.max_employees }} nhân sự · {{ plan.max_referrers }} giới thiệu · {{ plan.max_scanners }} soát vé · {{ Number(plan.price_vnd).toLocaleString('vi-VN') }} ₫/sự kiện</p>
              <small class="text-[10px] text-slate-400">{{ plan.status === 'ACTIVE' ? 'Đang bán' : 'Đã ẩn' }}</small>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" @click="editPlan(plan)">Sửa</button>
          </article>
          <p v-if="!plans.length" class="py-4 text-xs text-slate-500">Chưa có gói dịch vụ.</p>
        </div>
      </form>

      <section class="card overflow-hidden">
        <div class="flex items-center gap-2 border-b border-slate-100 p-5"><CircleDollarSign class="h-5 w-5 text-primary-700" /><div><h2 class="font-bold text-slate-900">Yêu cầu mua gói</h2><p class="text-xs text-slate-500">Mỗi yêu cầu là một gói cho một sự kiện. Xác nhận thanh toán để cấp gói cho khách thuê.</p></div></div>
        <div v-if="!requests.length" class="p-10 text-center text-sm text-slate-500">Chưa có yêu cầu mua gói.</div>
        <div v-else class="divide-y divide-slate-100">
          <article v-for="request in requests" :key="request.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><b class="text-sm text-slate-800">{{ request.tenant_name }} · {{ request.plan_name }}</b><p class="mt-1 text-xs text-slate-500">{{ request.owner_email }} · {{ request.max_attendees }} khách · {{ request.max_employees }} nhân sự · {{ request.max_referrers }} giới thiệu · {{ request.max_scanners }} soát vé · {{ Number(request.price_vnd).toLocaleString('vi-VN') }} ₫/sự kiện</p><small class="text-[10px] text-slate-400">{{ request.requested_at }} · {{ request.event_name ? `Đã dùng cho ${request.event_name}` : request.status === 'PENDING' ? 'Đang chờ' : request.status === 'APPROVED' ? 'Đã cấp, chưa dùng' : 'Từ chối' }}</small></div>
            <div v-if="request.status === 'PENDING'" class="flex gap-2"><button class="btn btn-sm btn-primary" @click="reviewRequest(request, 'APPROVED')">Đã nhận tiền · Duyệt</button><button class="btn btn-sm btn-secondary" @click="reviewRequest(request, 'REJECTED')">Từ chối</button></div>
          </article>
        </div>
      </section>
    </section>

    <div v-if="createdCredentials" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-bold text-emerald-900">Đã tạo khách thuê {{ createdCredentials.tenant }}</p>
          <p class="mt-1 text-xs text-emerald-800">Gửi thông tin đăng nhập này cho người quản lý. Họ có thể đổi mật khẩu sau khi đăng nhập.</p>
          <p class="mt-2 font-mono text-xs text-emerald-950">{{ createdCredentials.email }} · {{ createdCredentials.password }}</p>
        </div>
        <button class="btn border border-emerald-300 bg-white text-emerald-800" @click="copyCredentials">
          <Check v-if="copied" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />{{ copied ? 'Đã sao chép' : 'Sao chép thông tin' }}
        </button>
      </div>
    </div>

    <div v-if="notice" class="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {{ notice }}<button class="ml-3" @click="notice = ''"><X class="h-4 w-4" /></button>
    </div>

    <section class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 class="font-bold text-slate-900">Danh sách đơn vị</h2><p class="mt-0.5 text-xs text-slate-500">{{ tenants.length }} khách thuê trong hệ thống</p></div>
        <div class="relative w-full sm:max-w-xs"><Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input v-model="search" class="field pl-10" placeholder="Tìm đơn vị, email..." /></div>
      </div>
      <div v-if="loading" class="p-12 text-center text-sm text-slate-500">Đang tải dữ liệu...</div>
      <div v-else-if="!visibleTenants.length" class="p-12 text-center">
        <Building2 class="mx-auto h-9 w-9 text-slate-300" />
        <p class="mt-3 font-semibold text-slate-700">Chưa có khách thuê</p>
        <p class="mt-1 text-sm text-slate-500">Tạo đơn vị đầu tiên để cấp cổng quản lý sự kiện.</p>
      </div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="tenant in visibleTenants" :key="tenant.id" class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div class="flex min-w-0 items-start gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 class="h-5 w-5" /></span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-slate-900">{{ tenant.name }}</h3>
                <span :class="tenant.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'" class="rounded-full px-2 py-0.5 text-[10px] font-bold">{{ tenant.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã tạm khóa' }}</span>
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ tenant.contact_name }} · {{ tenant.contact_email }}<span v-if="tenant.phone"> · {{ tenant.phone }}</span></p>
              <p class="mt-1 text-xs text-slate-500">Tài khoản quản lý: <span class="font-semibold text-slate-700">{{ tenant.owner_email || 'Chưa có' }}</span></p>
            </div>
          </div>
          <div class="flex items-center justify-between gap-4 sm:justify-end">
            <div class="flex gap-4 text-xs text-slate-600">
              <span class="inline-flex items-center gap-1.5"><CalendarDays class="h-4 w-4 text-primary-600" />{{ tenant.events_count }} ({{ tenant.free_events_used }}/3 miễn phí) sự kiện</span>
              <span class="inline-flex items-center gap-1.5"><Users class="h-4 w-4 text-primary-600" />{{ tenant.team_count }} nhân sự</span>
            </div>
            <button class="btn btn-sm btn-secondary" @click="toggleStatus(tenant)"><Power class="h-3.5 w-3.5" />{{ tenant.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt' }}</button>
          </div>
        </article>
      </div>
    </section>

    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" @click.self="showCreate = false">
      <form class="max-h-[92vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7" @submit.prevent="createTenant">
        <div class="flex items-start justify-between"><div><p class="eyebrow">Cấp quyền truy cập cổng khách thuê</p><h2 class="mt-1 text-xl font-black text-slate-900">Thêm khách thuê</h2></div><button type="button" class="btn btn-ghost btn-sm" @click="showCreate = false"><X class="h-4 w-4" /></button></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field-wrap sm:col-span-2"><span class="field-label">Tên đơn vị</span><input v-model="form.name" class="field" required placeholder="Công ty / ban tổ chức" /></label>
          <label class="field-wrap"><span class="field-label">Người liên hệ</span><input v-model="form.contact_name" class="field" required /></label>
          <label class="field-wrap"><span class="field-label">Email liên hệ</span><input v-model="form.contact_email" type="email" class="field" required /></label>
          <label class="field-wrap"><span class="field-label">Số điện thoại</span><input v-model="form.phone" class="field" /></label>
        </div>
        <div class="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
          <div class="mb-3 flex items-center gap-2 text-sm font-bold text-primary-900"><ShieldCheck class="h-4 w-4" />Tài khoản chủ đơn vị</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="field-wrap"><span class="field-label">Tên người quản lý</span><input v-model="form.owner_name" class="field" required /></label>
            <label class="field-wrap"><span class="field-label">Email đăng nhập</span><input v-model="form.owner_email" type="email" class="field" required autocomplete="username" /><small class="text-xs text-slate-500">Email này chưa được dùng cho tài khoản nào khác trong hệ thống.</small></label>
            <label class="field-wrap sm:col-span-2"><span class="field-label">Mật khẩu tạm (ít nhất 8 ký tự)</span><input v-model="form.owner_password" type="text" minlength="8" class="field" required autocomplete="new-password" /></label>
          </div>
        </div>
        <div v-if="createError" role="alert" aria-live="polite" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{{ createError }}</div>
        <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" @click="showCreate = false">Hủy</button><button class="btn btn-primary" :disabled="saving"><Plus class="h-4 w-4" />{{ saving ? 'Đang tạo...' : 'Tạo khách thuê' }}</button></div>
      </form>
    </div>
    <!-- BẢNG: CÁC SỰ KIỆN DO CÁC BÊN THUÊ MỞ & QUYỀN ĐÓNG SỰ KIỆN -->
    <section class="card overflow-hidden">
      <div class="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
        <div class="flex items-center gap-2">
          <CalendarDays class="h-5 w-5 text-indigo-600" />
          <div>
            <h2 class="font-bold text-slate-900">Sự kiện do các bên khách thuê mở ({{ tenantEvents.length }})</h2>
            <p class="text-xs text-slate-500">Danh sách toàn bộ sự kiện các bên đối tác mở trong cổng riêng. Admin có quyền đóng hoặc mở lại sự kiện bất kỳ lúc nào.</p>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" @click="loadTenantEvents" :disabled="loadingTenantEvents">
          Làm mới
        </button>
      </div>

      <div v-if="!tenantEvents.length" class="p-8 text-center text-sm text-slate-500">
        Chưa có khách thuê nào mở sự kiện.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
            <tr>
              <th class="py-3 px-4">Sự kiện</th>
              <th class="py-3 px-4">Bên thuê mở</th>
              <th class="py-3 px-4">Gói dịch vụ</th>
              <th class="py-3 px-4 text-center">Khách check-in</th>
              <th class="py-3 px-4 text-center">Thanh toán</th>
              <th class="py-3 px-4 text-center">Trạng thái</th>
              <th class="py-3 px-4 text-right">Thao tác Admin</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="ev in tenantEvents" :key="ev.id" class="hover:bg-slate-50/70 transition">
              <td class="py-3 px-4">
                <b class="text-slate-900 block font-bold">{{ ev.name }}</b>
                <span class="text-[10px] text-slate-400">{{ ev.location }}</span>
              </td>
              <td class="py-3 px-4">
                <div class="font-bold text-indigo-900">{{ ev.tenant_name }}</div>
                <div class="text-[10px] text-slate-400">{{ ev.contact_email }}</div>
              </td>
              <td class="py-3 px-4">
                <span class="font-semibold">{{ ev.package_name || 'Gói mặc định' }}</span>
                <span v-if="ev.is_trial" class="text-emerald-700 block text-[10px]">Dùng thử 0 ₫</span>
                <span v-else class="text-slate-500 block text-[10px]">{{ Number(ev.package_price_vnd).toLocaleString('vi-VN') }} ₫</span>
              </td>
              <td class="py-3 px-4 text-center font-mono font-bold text-primary-700">
                {{ ev.total_checked_in }} / {{ ev.capacity }}
              </td>
              <td class="py-3 px-4 text-center">
                <span
                  v-if="ev.payment_status === 'PENDING_PAYMENT'"
                  class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                >
                  ⏳ Chờ thanh toán
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
                >
                  ✅ Đã thanh toán
                </span>
              </td>
              <td class="py-3 px-4 text-center">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold"
                  :class="ev.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
                >
                  {{ ev.status === 'PUBLISHED' ? 'Đang mở' : 'Đã đóng' }}
                </span>
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    v-if="ev.payment_status === 'PENDING_PAYMENT'"
                    type="button"
                    class="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    @click="confirmTenantEventPayment(ev)"
                  >
                    Duyệt TT
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs font-bold"
                    :class="ev.status === 'PUBLISHED' ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'"
                    @click="toggleTenantEvent(ev)"
                  >
                    {{ ev.status === 'PUBLISHED' ? 'Đóng sự kiện' : 'Mở lại' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- CÀI ĐẶT TÀI KHOẢN NGÂN HÀNG NHẬN TIỀN (VIETQR) -->
    <div class="card p-5">
      <div class="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
        <div class="flex items-center gap-2">
          <CircleDollarSign class="h-5 w-5 text-emerald-600" />
          <div>
            <h2 class="font-bold text-slate-900">Tài khoản ngân hàng nhận thanh toán (VietQR)</h2>
            <p class="text-xs text-slate-500">Thông tin này dùng để hiển thị mã VietQR tự động cho khách thuê thanh toán gói sự kiện.</p>
          </div>
        </div>
        <span v-if="saveBankSuccess" class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Đã lưu thành công!
        </span>
      </div>
      <form class="grid gap-3 sm:grid-cols-4" @submit.prevent="saveBankSettings">
        <label class="field-wrap">
          <span class="field-label">Mã ngân hàng (VietQR)</span>
          <input v-model="bankSettings.bank_code" class="field font-mono" placeholder="MB, VCB, TCB, ACB..." required />
        </label>
        <label class="field-wrap">
          <span class="field-label">Tên ngân hàng</span>
          <input v-model="bankSettings.bank_name" class="field" placeholder="MBBank, Vietcombank..." required />
        </label>
        <label class="field-wrap">
          <span class="field-label">Số tài khoản</span>
          <input v-model="bankSettings.bank_account" class="field font-mono font-bold" placeholder="0987654321" required />
        </label>
        <label class="field-wrap">
          <span class="field-label">Tên chủ tài khoản</span>
          <input v-model="bankSettings.bank_account_name" class="field font-bold uppercase" placeholder="CONG TY KTS" required />
        </label>
        <div class="sm:col-span-4 flex justify-end">
          <button class="btn btn-primary" :disabled="savingBank">
            {{ savingBank ? 'Đang lưu...' : 'Lưu tài khoản ngân hàng' }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>
