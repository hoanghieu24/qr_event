<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import QRCode from 'qrcode';
import api from '../api/client';
import {
  X,
  Download,
  Sparkles,
  Upload,
  Check,
  Image as ImageIcon,
  Link,
  MapPin,
  Calendar,
  Copy,
  Maximize2,
  Sliders,
  ExternalLink,
  Save,
  RotateCcw,
  Trash2,
  Move,
  Palette,
  User,
  Share2
} from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  ticket?: any;
  cardData?: {
    attendee_name?: string;
    attendee_role?: string;
    qr_data?: string;
    code_label?: string;
    avatar_url?: string;
    event_name?: string;
    event_location?: string;
    event_start_at?: string;
  };
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const STORAGE_KEY = 'ktsqr_custom_invite_template_v1';
const STORAGE_LIST_KEY = 'ktsqr_saved_invite_templates_list_v1';

interface SavedTemplateItem {
  id: string;
  name: string;
  templateUrl: string;
  config: any;
  aspectHeight: number;
  updatedAt: string;
}

// Form & Card State
const attendeeName = ref('Nguyễn Văn An');
const attendeeRole = ref('Khách Mời Danh Dự (VIP)');
const eventName = ref('HỘI NGHỊ CÔNG NGHỆ & ĐỔI MỚI SÁNG TẠO 2026');
const eventLocation = ref('Trung tâm Hội nghị Quốc gia, Đại lộ Thăng Long, Hà Nội');
const eventTimeText = ref('Thứ Năm, 15/10/2026 lúc 08:30');
const qrContent = ref('https://eventqr.com');
const qrLabel = ref('MÃ VÉ: VIP-888999');
const customAvatarUrl = ref<string | null>(null);

// Active Theme: built-in themes + 'custom-template'
type ThemeId = 'ivory-gold' | 'royal-gold' | 'sapphire' | 'ruby-gold' | 'custom-template';
const selectedTheme = ref<ThemeId>('ivory-gold');

// Editor Navigation Tabs: 'template' (phôi thiệp) | 'position' (căn chỉnh vị trí) | 'info' (thông tin khách & sự kiện)
const activeEditorTab = ref<'template' | 'position' | 'info'>('template');

const selectLayerForAdjust = (layer: 'qr' | 'name' | 'role' | 'avatar') => {
  activeAdjustTab.value = layer;
  activeEditorTab.value = 'position';
};

// Custom Template (Canva / Uploaded Background) State
const customTemplateUrl = ref<string | null>(null);
const customAspectHeight = ref<number>(1920); // Base width is always 1080
const activeAdjustTab = ref<'qr' | 'name' | 'role' | 'avatar'>('qr');
const savedTemplateNotice = ref(false);
const savedTemplatesList = ref<SavedTemplateItem[]>([]);
const activeSavedTemplateId = ref<string | null>(null);
const customTemplateName = ref<string>('Mẫu Phôi Canva #1');
const isDraggingPreview = ref(false);
const previewContainerRef = ref<HTMLElement | null>(null);
const nudgeStep = ref<number>(2);

const activeAdjustTabName = computed(() => {
  switch (activeAdjustTab.value) {
    case 'qr': return 'Mã QR';
    case 'name': return 'Tên khách mời';
    case 'role': return 'Chức vụ / Danh xưng';
    case 'avatar': return 'Ảnh chân dung';
    default: return '';
  }
});

const nudge = (dx: number, dy: number) => {
  if (activeAdjustTab.value === 'qr') {
    overlayConfig.qrX = Math.max(5, Math.min(95, overlayConfig.qrX + dx));
    overlayConfig.qrY = Math.max(5, Math.min(95, overlayConfig.qrY + dy));
  } else if (activeAdjustTab.value === 'name') {
    overlayConfig.nameX = Math.max(5, Math.min(95, overlayConfig.nameX + dx));
    overlayConfig.nameY = Math.max(5, Math.min(95, overlayConfig.nameY + dy));
  } else if (activeAdjustTab.value === 'role') {
    overlayConfig.roleX = Math.max(5, Math.min(95, overlayConfig.roleX + dx));
    overlayConfig.roleY = Math.max(5, Math.min(95, overlayConfig.roleY + dy));
  } else if (activeAdjustTab.value === 'avatar') {
    overlayConfig.avatarX = Math.max(5, Math.min(95, overlayConfig.avatarX + dx));
    overlayConfig.avatarY = Math.max(5, Math.min(95, overlayConfig.avatarY + dy));
  }
  generateCard();
};

const centerActiveLayer = () => {
  if (activeAdjustTab.value === 'qr') {
    overlayConfig.qrX = 50;
  } else if (activeAdjustTab.value === 'name') {
    overlayConfig.nameX = 50;
  } else if (activeAdjustTab.value === 'role') {
    overlayConfig.roleX = 50;
  } else if (activeAdjustTab.value === 'avatar') {
    overlayConfig.avatarX = 50;
  }
  generateCard();
};

const defaultOverlayConfig = () => ({
  // QR Code
  showQr: true,
  qrX: 50,
  qrY: 74,
  qrSize: 280,
  qrWhiteBox: true,
  showQrLabel: true,
  qrLabelColor: '#ffffff',

  // Guest Name
  showName: true,
  showSalutation: true,
  salutationText: 'Trân trọng Kính mời Quý Khách tham dự',
  nameX: 50,
  nameY: 46,
  nameFontSize: 54,
  nameColor: '#ffffff',

  // Guest Role
  showRole: true,
  roleX: 50,
  roleY: 37,
  roleFontSize: 24,
  roleStyle: 'badge' as 'badge' | 'plain',
  roleColor: '#fde047',

  // Guest Avatar
  showAvatar: true,
  avatarX: 50,
  avatarY: 24,
  avatarSize: 110,
  avatarBorder: true,

  // Optional Event Info overlay
  showEventInfo: false,
  eventInfoY: 56,
  eventInfoColor: '#ffffff',
});

const overlayConfig = reactive(defaultOverlayConfig());

const colorPresets = [
  { label: 'Trắng', value: '#ffffff' },
  { label: 'Vàng Kim', value: '#fde047' },
  { label: 'Cam Vàng', value: '#f59e0b' },
  { label: 'Đen Đậm', value: '#1c1917' },
  { label: 'Nâu Hoàng Gia', value: '#78350f' },
  { label: 'Xanh Navy', value: '#0f172a' },
  { label: 'Đỏ Đô', value: '#9f1239' },
];

const showAdvancedEditor = ref(false);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const previewDataUrl = ref<string | null>(null);
const isGenerating = ref(false);
const showZoomModal = ref(false);

// Cached Image objects for instant 60fps canvas redraws
let cachedTemplateImg: HTMLImageElement | null = null;
let cachedAvatarImg: HTMLImageElement | null = null;
let cachedQrImg: HTMLImageElement | null = null;
let lastQrContent = '';
let lastQrSize = 0;

const themes = [
  {
    id: 'ivory-gold' as ThemeId,
    name: 'Kem và vàng',
    sub: 'Nền sáng, chữ vàng',
    color: '#f59e0b',
    bgPreview: 'from-amber-100 via-stone-50 to-amber-200',
    borderPreview: 'border-amber-400',
    isLight: true,
  },
  {
    id: 'royal-gold' as ThemeId,
    name: 'Đen và vàng',
    sub: 'Nền tối, điểm nhấn vàng',
    color: '#eab308',
    bgPreview: 'from-neutral-900 via-stone-900 to-amber-950',
    borderPreview: 'border-amber-500',
    isLight: false,
  },
  {
    id: 'sapphire' as ThemeId,
    name: 'Xanh dương',
    sub: 'Tông xanh đậm',
    color: '#38bdf8',
    bgPreview: 'from-slate-950 via-sky-950 to-indigo-950',
    borderPreview: 'border-sky-400',
    isLight: false,
  },
  {
    id: 'ruby-gold' as ThemeId,
    name: 'Đỏ và vàng',
    sub: 'Nền đỏ, điểm nhấn vàng',
    color: '#fb7185',
    bgPreview: 'from-rose-950 via-red-950 to-amber-950',
    borderPreview: 'border-rose-400',
    isLight: false,
  },
];

const selectedThemeName = computed(
  () => themes.find((theme) => theme.id === selectedTheme.value)?.name ?? (customTemplateName.value || 'Mẫu riêng')
);

const loadImageHelper = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

const applyTemplateRecord = async (item: SavedTemplateItem) => {
  activeSavedTemplateId.value = item.id;
  customTemplateName.value = item.name || 'Mẫu Phôi Canva';
  if (item.config) {
    Object.assign(overlayConfig, defaultOverlayConfig(), item.config);
    if (!overlayConfig.salutationText || overlayConfig.salutationText === 'Trân trọng kính mời Quý Khách:') {
      overlayConfig.salutationText = 'Trân trọng Kính mời Quý Khách tham dự';
    }
  }
  if (item.templateUrl) {
    customTemplateUrl.value = item.templateUrl;
    const img = await loadImageHelper(item.templateUrl);
    if (img) {
      cachedTemplateImg = img;
      customAspectHeight.value = item.aspectHeight || Math.round(1080 * (img.height / img.width));
    }
  }
  selectedTheme.value = 'custom-template';
  activeEditorTab.value = 'position';
  await generateCard();
};

const selectSavedTemplate = async (item: SavedTemplateItem) => {
  await applyTemplateRecord(item);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: item.id,
        name: item.name,
        templateUrl: item.templateUrl,
        config: { ...overlayConfig },
        useCustomByDefault: true,
      })
    );
  } catch {}
};

const loadSavedCustomTemplate = async () => {
  let serverItems: SavedTemplateItem[] = [];

  // 1. Load from Backend Server (/api/v1/invite-templates) so it works across all URLs & devices
  try {
    const res = await api.get('/invite-templates');
    if (res.data?.success && res.data?.data) {
      serverItems = res.data.data.items || [];
    }
  } catch (e) {
    console.warn('Server templates fetch skipped:', e);
  }

  // 2. Also check localStorage list & legacy single-item key
  let localItems: SavedTemplateItem[] = [];
  try {
    const rawList = localStorage.getItem(STORAGE_LIST_KEY);
    if (rawList) {
      localItems = JSON.parse(rawList) || [];
    }
  } catch {}

  try {
    const rawSingle = localStorage.getItem(STORAGE_KEY);
    if (rawSingle) {
      const parsed = JSON.parse(rawSingle);
      if (parsed.templateUrl) {
        const existsInServer = serverItems.some((s) => s.templateUrl === parsed.templateUrl);
        const existsInLocal = localItems.some((l) => l.templateUrl === parsed.templateUrl);
        if (!existsInServer && !existsInLocal) {
          const migrated: SavedTemplateItem = {
            id: parsed.id || `tpl_${Date.now()}`,
            name: parsed.name || 'Mẫu Phôi Đã Lưu #1',
            templateUrl: parsed.templateUrl,
            config: parsed.config || defaultOverlayConfig(),
            aspectHeight: 1920,
            updatedAt: new Date().toISOString(),
          };
          localItems.unshift(migrated);
          // Sync migrated item to server in background
          api.post('/invite-templates', { ...migrated, setActive: true }).catch(() => {});
        }
      }
    }
  } catch {}

  // Merge unique templates (Server + Local)
  const mergedMap = new Map<string, SavedTemplateItem>();
  for (const item of [...serverItems, ...localItems]) {
    if (item && item.id && item.templateUrl && !mergedMap.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  }
  savedTemplatesList.value = Array.from(mergedMap.values());

};

const saveCustomTemplateToStorage = async (saveAsNew = false) => {
  if (!customTemplateUrl.value) return;

  const isNew = saveAsNew || !activeSavedTemplateId.value;
  const itemId = isNew ? `tpl_${Date.now()}` : activeSavedTemplateId.value!;
  const itemName =
    customTemplateName.value?.trim() ||
    `Mẫu Phôi Canva #${savedTemplatesList.value.length + 1}`;

  const record: SavedTemplateItem = {
    id: itemId,
    name: itemName,
    templateUrl: customTemplateUrl.value,
    config: { ...overlayConfig },
    aspectHeight: customAspectHeight.value,
    updatedAt: new Date().toISOString(),
  };

  activeSavedTemplateId.value = itemId;
  customTemplateName.value = itemName;

  // Update in-memory list immediately
  const idx = savedTemplatesList.value.findIndex((t) => t.id === itemId);
  if (idx >= 0) {
    savedTemplatesList.value[idx] = record;
  } else {
    savedTemplatesList.value.unshift(record);
  }

  // Save to Backend Server so it never gets lost when URL/device changes
  try {
    await api.post('/invite-templates', {
      ...record,
      setActive: true,
    });
  } catch (e) {
    console.warn('Could not save template to server:', e);
  }

  // Also save to localStorage as backup
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: record.id,
        name: record.name,
        templateUrl: record.templateUrl,
        config: record.config,
        useCustomByDefault: selectedTheme.value === 'custom-template',
      })
    );
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(savedTemplatesList.value.slice(0, 8)));
  } catch {}

  savedTemplateNotice.value = true;
  setTimeout(() => {
    savedTemplateNotice.value = false;
  }, 2500);
};

const deleteSavedTemplate = async (id: string) => {
  savedTemplatesList.value = savedTemplatesList.value.filter((t) => t.id !== id);
  try {
    await api.delete(`/invite-templates/${id}`);
  } catch {}
  try {
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(savedTemplatesList.value));
  } catch {}

  if (activeSavedTemplateId.value === id) {
    const next = savedTemplatesList.value[0];
    if (next) {
      await applyTemplateRecord(next);
    } else {
      clearCustomTemplate();
    }
  }
};

const resetOverlayPositions = () => {
  Object.assign(overlayConfig, defaultOverlayConfig());
  generateCard();
};

const clearCustomTemplate = () => {
  customTemplateUrl.value = null;
  cachedTemplateImg = null;
  activeSavedTemplateId.value = null;
  customAspectHeight.value = 1920;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  generateCard();
};

const initData = async () => {
  const d = props.cardData || {};
  const t = props.ticket || {};

  selectedTheme.value = 'ivory-gold';
  showAdvancedEditor.value = true;
  activeEditorTab.value = 'template';
  Object.assign(overlayConfig, defaultOverlayConfig());
  customTemplateUrl.value = null;
  cachedTemplateImg = null;
  customAspectHeight.value = 1920;
  activeSavedTemplateId.value = null;

  attendeeName.value = d.attendee_name || t.full_name || 'Nguyễn Văn An';
  attendeeRole.value = d.attendee_role || 'Khách Mời Danh Dự (VIP)';
  eventName.value = d.event_name || t.event_name || 'HỘI NGHỊ CÔNG NGHỆ TECHSUMMIT 2026';
  eventLocation.value = d.event_location || t.event_location || 'Trung tâm Hội nghị Quốc gia, Hà Nội';

  if (d.event_start_at || t.event_start_at) {
    const dt = new Date(d.event_start_at || t.event_start_at);
    eventTimeText.value = `${dt.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} lúc ${dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    eventTimeText.value = 'Thứ Năm, 15/10/2026 lúc 08:30';
  }

  qrContent.value = d.qr_data || t.code || window.location.origin;
  qrLabel.value = d.code_label || (t.code ? `MÃ VÉ: ${t.code}` : 'QUÉT QR ĐỂ XÁC NHẬN THAM DỰ');
  customAvatarUrl.value = d.avatar_url || null;
  cachedAvatarImg = d.avatar_url ? await loadImageHelper(d.avatar_url) : null;
  await loadSavedCustomTemplate();
};

const handleAvatarUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const result = e.target?.result as string;
    customAvatarUrl.value = result;
    cachedAvatarImg = await loadImageHelper(result);
    generateCard();
  };
  reader.readAsDataURL(file);
};

// Process any raw image URL/DataURL into a normalized 1080px-wide custom template
const processRawImageToTemplate = async (rawDataUrl: string, suggestedName?: string) => {
  const img = await loadImageHelper(rawDataUrl);
  if (!img) return false;

  const targetW = 1080;
  const targetH = Math.round(1080 * (img.height / img.width));
  customAspectHeight.value = targetH;

  const offCanvas = document.createElement('canvas');
  offCanvas.width = targetW;
  offCanvas.height = targetH;
  const offCtx = offCanvas.getContext('2d');
  if (offCtx) {
    offCtx.drawImage(img, 0, 0, targetW, targetH);
    const optimizedUrl = offCanvas.toDataURL('image/jpeg', 0.92);
    customTemplateUrl.value = optimizedUrl;
    cachedTemplateImg = await loadImageHelper(optimizedUrl);
  } else {
    customTemplateUrl.value = rawDataUrl;
    cachedTemplateImg = img;
  }

  activeSavedTemplateId.value = null;
  customTemplateName.value =
    suggestedName || `Mẫu Phôi Canva #${savedTemplatesList.value.length + 1}`;
  selectedTheme.value = 'custom-template';
  activeEditorTab.value = 'position';
  await generateCard();
  await saveCustomTemplateToStorage(true);
  return true;
};

// Upload Custom Invitation Template (from Canva / Photoshop / device)
const handleTemplateUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 28);
  const reader = new FileReader();
  reader.onload = async (e) => {
    const rawDataUrl = e.target?.result as string;
    await processRawImageToTemplate(rawDataUrl, cleanName || undefined);
  };
  reader.readAsDataURL(file);
};

const pasteNotice = ref('');

// Paste image directly from Clipboard (Ctrl+V or button click after copying in Canva)
const pasteTemplateFromClipboard = async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      pasteNotice.value = 'Hãy nhấn tổ hợp phím Ctrl + V để dán ảnh!';
      setTimeout(() => (pasteNotice.value = ''), 3000);
      return;
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = async (e) => {
          const rawDataUrl = e.target?.result as string;
          await processRawImageToTemplate(rawDataUrl);
          pasteNotice.value = 'Đã dán ảnh phôi từ bộ nhớ tạm!';
          setTimeout(() => (pasteNotice.value = ''), 2500);
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
    pasteNotice.value = 'Chưa có ảnh trong Clipboard! Hãy Copy ảnh trên Canva trước.';
    setTimeout(() => (pasteNotice.value = ''), 3000);
  } catch {
    pasteNotice.value = 'Hãy nhấn phím Ctrl + V trên bàn phím để dán ảnh!';
    setTimeout(() => (pasteNotice.value = ''), 3000);
  }
};

const handleWindowPaste = (e: ClipboardEvent) => {
  if (!props.show) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const rawDataUrl = ev.target?.result as string;
          await processRawImageToTemplate(rawDataUrl);
          pasteNotice.value = 'Đã dán ảnh phôi thành công (Ctrl+V)!';
          setTimeout(() => (pasteNotice.value = ''), 2500);
        };
        reader.readAsDataURL(file);
      }
      break;
    }
  }
};

// Built-in Canva-style blank frames so users can test custom layout in 1 click
const quickCanvaPresets = [
  { id: 'gala-night', name: 'Phôi Gala Đen Vàng', bg1: '#090d16', bg2: '#1e1b4b', accent: '#f59e0b', textLight: true },
  { id: 'tech-cyan', name: 'Phôi Tech Vũ Trụ', bg1: '#020617', bg2: '#0f172a', accent: '#38bdf8', textLight: true },
  { id: 'emerald-vip', name: 'Phôi Ngọc Lục Bảo', bg1: '#022c22', bg2: '#064e3b', accent: '#fbbf24', textLight: true },
  { id: 'pearl-clean', name: 'Phôi Kem Tối Giản', bg1: '#fffbeb', bg2: '#f5f5f4', accent: '#b45309', textLight: false },
];

const applyQuickCanvaPreset = async (preset: typeof quickCanvaPresets[0]) => {
  const w = 1080;
  const h = 1920;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, preset.bg1);
  grad.addColorStop(1, preset.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Decorative glowing circles
  const glow = ctx.createRadialGradient(w / 2, 340, 20, w / 2, 340, 520);
  glow.addColorStop(0, preset.accent + '33');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Outer luxury frame
  ctx.strokeStyle = preset.accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(54, 54, w - 108, h - 108);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(72, 72, w - 144, h - 144);

  // Top Header Text baked into the blank template
  ctx.textAlign = 'center';
  ctx.fillStyle = preset.accent;
  ctx.font = 'bold 28px "Be Vietnam Pro", sans-serif';
  ctx.fillText('✦ THIỆP MỜI SỰ KIỆN ĐẶC BIỆT ✦', w / 2, 165);

  ctx.fillStyle = preset.textLight ? '#ffffff' : '#1c1917';
  ctx.font = '900 44px "Be Vietnam Pro", sans-serif';
  ctx.fillText((eventName.value || 'SỰ KIỆN VIP 2026').slice(0, 38), w / 2, 240);

  // Bottom Event time & location baked into template
  ctx.fillStyle = preset.accent;
  ctx.font = 'bold 26px "Be Vietnam Pro", sans-serif';
  ctx.fillText(`🕒 ${eventTimeText.value}`, w / 2, 1740);
  ctx.fillStyle = preset.textLight ? '#cbd5e1' : '#57534e';
  ctx.font = '500 24px "Be Vietnam Pro", sans-serif';
  ctx.fillText(`📍 ${eventLocation.value}`, w / 2, 1790);

  overlayConfig.nameColor = preset.textLight ? '#ffffff' : '#1c1917';
  overlayConfig.qrLabelColor = preset.textLight ? '#fde047' : '#78350f';

  const dataUrl = off.toDataURL('image/jpeg', 0.92);
  await processRawImageToTemplate(dataUrl);
};

// Interactive Pointer Dragging on Preview Image to position active layer
const updateLayerPositionFromPointer = (clientX: number, clientY: number) => {
  if (selectedTheme.value !== 'custom-template' || !previewContainerRef.value) return;
  const rect = previewContainerRef.value.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const xPct = Math.max(5, Math.min(95, Math.round(((clientX - rect.left) / rect.width) * 100)));
  const yPct = Math.max(5, Math.min(95, Math.round(((clientY - rect.top) / rect.height) * 100)));

  if (activeAdjustTab.value === 'qr') {
    overlayConfig.qrX = xPct;
    overlayConfig.qrY = yPct;
  } else if (activeAdjustTab.value === 'name') {
    overlayConfig.nameX = xPct;
    overlayConfig.nameY = yPct;
  } else if (activeAdjustTab.value === 'role') {
    overlayConfig.roleX = xPct;
    overlayConfig.roleY = yPct;
  } else if (activeAdjustTab.value === 'avatar') {
    overlayConfig.avatarX = xPct;
    overlayConfig.avatarY = yPct;
  }
  generateCard();
};

const onPreviewPointerDown = (e: PointerEvent) => {
  if (selectedTheme.value !== 'custom-template') return;
  isDraggingPreview.value = true;
  (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
  updateLayerPositionFromPointer(e.clientX, e.clientY);
};

const onPreviewPointerMove = (e: PointerEvent) => {
  if (!isDraggingPreview.value || selectedTheme.value !== 'custom-template') return;
  updateLayerPositionFromPointer(e.clientX, e.clientY);
};

const onPreviewPointerUp = () => {
  if (isDraggingPreview.value) {
    isDraggingPreview.value = false;
  }
};

// Canvas drawing helpers
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawLuxuryCorner = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  dirX: 1 | -1,
  dirY: 1 | -1,
  color: string,
  lineWidth: number = 3
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x + dirX * size, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dirY * size);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + dirX * (size - 12), y + dirY * 10);
  ctx.lineTo(x + dirX * 10, y + dirY * 10);
  ctx.lineTo(x + dirX * 10, y + dirY * (size - 12));
  ctx.stroke();

  ctx.fillStyle = color;
  const gemX = x + dirX * 20;
  const gemY = y + dirY * 20;
  const gemR = 5;
  ctx.beginPath();
  ctx.moveTo(gemX, gemY - gemR);
  ctx.lineTo(gemX + gemR, gemY);
  ctx.lineTo(gemX, gemY + gemR);
  ctx.lineTo(gemX - gemR, gemY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

const fitAndDrawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  startSize: number,
  minSize: number,
  weight = 'bold',
  fontFamily = '"Be Vietnam Pro", -apple-system, sans-serif'
): number => {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  ctx.fillText(text, x, y);
  return size;
};

const wrapAndDrawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  fontSize: number,
  weight = 'bold',
  fontFamily = '"Be Vietnam Pro", -apple-system, sans-serif'
): number => {
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        let remaining = words.slice(i).join(' ');
        while (ctx.measureText(remaining + '...').width > maxWidth && remaining.length > 0) {
          remaining = remaining.slice(0, -1);
        }
        lines.push(remaining ? `${remaining}...` : word);
        currentLine = '';
        break;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });
  return lines.length;
};

const drawCoverAvatar = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number
) => {
  const d = radius * 2;
  const imgRatio = img.width / img.height;
  let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
  if (imgRatio > 1) {
    sWidth = img.height;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width;
    sy = (img.height - sHeight) / 2;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, sx, sy, sWidth, sHeight, cx - radius, cy - radius, d, d);
  ctx.restore();
};

const ensureQrImage = async (targetSize: number): Promise<HTMLImageElement | null> => {
  const content = qrContent.value || 'https://eventqr.com';
  if (cachedQrImg && lastQrContent === content && Math.abs(lastQrSize - targetSize) < 40) {
    return cachedQrImg;
  }
  try {
    const qrDataUrl = await QRCode.toDataURL(content, {
      width: Math.max(200, targetSize),
      margin: 1,
      color: { dark: '#0c0a09', light: '#ffffff' },
    });
    cachedQrImg = await loadImageHelper(qrDataUrl);
    lastQrContent = content;
    lastQrSize = targetSize;
    return cachedQrImg;
  } catch (err) {
    console.warn('QR render error:', err);
    return null;
  }
};

// Render Custom Template Mode (Canva / Uploaded Phôi)
const renderCustomTemplateCard = async (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.textAlign = 'center';

  // 1. Background Template Image or Guide Placeholder
  if (cachedTemplateImg) {
    ctx.drawImage(cachedTemplateImg, 0, 0, width, height);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Dashed guide frame
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    drawRoundedRect(ctx, 60, 60, width - 120, height - 120, 32);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.font = 'bold 30px "Be Vietnam Pro", sans-serif';
    ctx.fillText('🎨 CHẾ ĐỘ PHÔI THIẾT KẾ RIÊNG / CANVA', width / 2, 150);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '500 22px "Be Vietnam Pro", sans-serif';
    ctx.fillText('Hãy bấm "Tải Ảnh Phôi Lên" để thay hình nền này bằng thiết kế của bạn', width / 2, 195);
  }

  const goldBright = '#fde047';
  const goldPrimary = '#f59e0b';
  const goldDark = '#b45309';

  // 2. Avatar Layer
  if (overlayConfig.showAvatar) {
    const ax = Math.round((overlayConfig.avatarX / 100) * width);
    const ay = Math.round((overlayConfig.avatarY / 100) * height);
    const ar = overlayConfig.avatarSize;

    if (overlayConfig.avatarBorder) {
      const borderGrad = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
      borderGrad.addColorStop(0, goldBright);
      borderGrad.addColorStop(0.5, goldPrimary);
      borderGrad.addColorStop(1, goldDark);

      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ax, ay, ar + 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = goldBright;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ax, ay, ar + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (cachedAvatarImg) {
      drawCoverAvatar(ctx, cachedAvatarImg, ax, ay, ar);
    } else {
      const monogramGrad = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
      monogramGrad.addColorStop(0, goldDark);
      monogramGrad.addColorStop(0.5, goldPrimary);
      monogramGrad.addColorStop(1, goldBright);
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.fillStyle = monogramGrad;
      ctx.fill();

      ctx.fillStyle = '#0c0a09';
      ctx.font = `bold ${Math.round(ar * 0.85)}px "Be Vietnam Pro", sans-serif`;
      const initial = (attendeeName.value || 'VIP').trim().charAt(0).toUpperCase();
      ctx.fillText(initial, ax, ay + Math.round(ar * 0.3));
    }
  }

  // 3. Role / Title Layer
  if (overlayConfig.showRole && attendeeRole.value) {
    const rx = Math.round((overlayConfig.roleX / 100) * width);
    const ry = Math.round((overlayConfig.roleY / 100) * height);
    const roleText = attendeeRole.value.toUpperCase();
    const rFontSize = overlayConfig.roleFontSize;

    if (overlayConfig.roleStyle === 'badge') {
      ctx.font = `bold ${rFontSize}px "Be Vietnam Pro", sans-serif`;
      const roleMetrics = ctx.measureText(roleText);
      const badgeWidth = Math.min(width - 120, Math.max(280, roleMetrics.width + 64));
      const badgeHeight = Math.round(rFontSize * 2);

      const badgeGrad = ctx.createLinearGradient(
        rx - badgeWidth / 2,
        ry - badgeHeight / 2,
        rx + badgeWidth / 2,
        ry + badgeHeight / 2
      );
      badgeGrad.addColorStop(0, goldBright);
      badgeGrad.addColorStop(1, goldDark);

      ctx.fillStyle = badgeGrad;
      drawRoundedRect(ctx, rx - badgeWidth / 2, ry - badgeHeight / 2, badgeWidth, badgeHeight, badgeHeight / 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#090d16';
      fitAndDrawText(ctx, roleText, rx, ry + Math.round(rFontSize * 0.34), badgeWidth - 36, rFontSize, 14, 'bold');
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = overlayConfig.roleColor;
      fitAndDrawText(ctx, roleText, rx, ry, width - 120, rFontSize, 14, 'bold');
      ctx.restore();
    }
  }

  // 4. Guest Name Layer
  if (overlayConfig.showName) {
    const nx = Math.round((overlayConfig.nameX / 100) * width);
    const ny = Math.round((overlayConfig.nameY / 100) * height);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;

    if (overlayConfig.showSalutation && overlayConfig.salutationText) {
      ctx.fillStyle = overlayConfig.nameColor;
      ctx.globalAlpha = 0.85;
      ctx.font = `italic ${Math.max(18, Math.round(overlayConfig.nameFontSize * 0.45))}px "Be Vietnam Pro", sans-serif`;
      ctx.fillText(overlayConfig.salutationText, nx, ny - Math.round(overlayConfig.nameFontSize * 1.05));
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = overlayConfig.nameColor;
    fitAndDrawText(
      ctx,
      attendeeName.value || 'Quý Khách Mời VIP',
      nx,
      ny,
      width - 120,
      overlayConfig.nameFontSize,
      24,
      'bold'
    );
    ctx.restore();
  }

  // 5. Optional Event Info Layer
  if (overlayConfig.showEventInfo) {
    const ey = Math.round((overlayConfig.eventInfoY / 100) * height);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = overlayConfig.eventInfoColor;
    fitAndDrawText(ctx, (eventName.value || '').toUpperCase(), width / 2, ey, width - 140, 32, 20, 'bold');
    ctx.font = '600 24px "Be Vietnam Pro", sans-serif';
    ctx.fillText(`📅 ${eventTimeText.value}`, width / 2, ey + 45);
    wrapAndDrawText(ctx, `📍 ${eventLocation.value}`, width / 2, ey + 86, width - 160, 34, 2, 22, '500');
    ctx.restore();
  }

  // 6. QR Code Layer
  if (overlayConfig.showQr) {
    const qx = Math.round((overlayConfig.qrX / 100) * width);
    const qy = Math.round((overlayConfig.qrY / 100) * height);
    const qrBoxSize = overlayConfig.qrSize;
    const qrBoxX = Math.round(qx - qrBoxSize / 2);
    const qrBoxY = Math.round(qy - qrBoxSize / 2);

    if (overlayConfig.qrWhiteBox) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = goldBright;
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 22);
      ctx.stroke();

      drawLuxuryCorner(ctx, qrBoxX + 10, qrBoxY + 10, 20, 1, 1, goldDark, 2);
      drawLuxuryCorner(ctx, qrBoxX + qrBoxSize - 10, qrBoxY + 10, 20, -1, 1, goldDark, 2);
      drawLuxuryCorner(ctx, qrBoxX + 10, qrBoxY + qrBoxSize - 10, 20, 1, -1, goldDark, 2);
      drawLuxuryCorner(ctx, qrBoxX + qrBoxSize - 10, qrBoxY + qrBoxSize - 10, 20, -1, -1, goldDark, 2);
    }

    const pad = overlayConfig.qrWhiteBox ? Math.round(qrBoxSize * 0.07) : 0;
    const qrImg = await ensureQrImage(qrBoxSize - pad * 2);
    if (qrImg) {
      ctx.drawImage(qrImg, qrBoxX + pad, qrBoxY + pad, qrBoxSize - pad * 2, qrBoxSize - pad * 2);
    }

    if (overlayConfig.showQrLabel && qrLabel.value) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = overlayConfig.qrLabelColor;
      fitAndDrawText(
        ctx,
        qrLabel.value,
        qx,
        qrBoxY + qrBoxSize + 42,
        width - 140,
        26,
        16,
        'bold',
        '"JetBrains Mono", monospace'
      );
      ctx.restore();
    }
  }
};

const generateCard = async () => {
  if (!canvasRef.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const theme = selectedTheme.value;
  const width = 1080;
  const height = theme === 'custom-template' ? customAspectHeight.value : 1920;
  canvas.width = width;
  canvas.height = height;

  if (theme === 'custom-template') {
    await renderCustomTemplateCard(ctx, width, height);
    previewDataUrl.value = canvas.toDataURL('image/png');
    return;
  }

  const isLight = theme === 'ivory-gold';

  // 1. Draw High-End Luxury Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'ivory-gold') {
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.2, '#fcfaf6');
    bgGrad.addColorStop(0.5, '#f4ece1');
    bgGrad.addColorStop(0.8, '#ede1ce');
    bgGrad.addColorStop(1, '#faf6ee');
  } else if (theme === 'royal-gold') {
    bgGrad.addColorStop(0, '#0a0807');
    bgGrad.addColorStop(0.25, '#17120c');
    bgGrad.addColorStop(0.5, '#22190f');
    bgGrad.addColorStop(0.75, '#151009');
    bgGrad.addColorStop(1, '#070605');
  } else if (theme === 'sapphire') {
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(0.25, '#071b38');
    bgGrad.addColorStop(0.5, '#0b264e');
    bgGrad.addColorStop(0.75, '#061730');
    bgGrad.addColorStop(1, '#020617');
  } else {
    bgGrad.addColorStop(0, '#130206');
    bgGrad.addColorStop(0.25, '#2b040e');
    bgGrad.addColorStop(0.5, '#400615');
    bgGrad.addColorStop(0.75, '#24030b');
    bgGrad.addColorStop(1, '#0d0104');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Palette definitions
  const goldPrimary = isLight ? '#b45309' : theme === 'sapphire' ? '#38bdf8' : '#f59e0b';
  const goldBright = isLight ? '#d97706' : theme === 'sapphire' ? '#7dd3fc' : '#fde047';
  const goldDark = isLight ? '#92400e' : theme === 'sapphire' ? '#0284c7' : '#b45309';

  const textHeading = isLight ? '#1c1917' : '#ffffff';
  const textSub = isLight ? '#78350f' : theme === 'sapphire' ? '#bae6fd' : '#fef08a';
  const textMuted = isLight ? '#57534e' : 'rgba(255, 255, 255, 0.72)';
  const glassCardBg = isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.06)';
  const glassCardBorder = isLight ? 'rgba(180, 83, 9, 0.35)' : theme === 'sapphire' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(245, 158, 11, 0.35)';

  // Subtle luxury background textures / diamond light mesh
  ctx.save();
  const radialGlow = ctx.createRadialGradient(width / 2, 480, 20, width / 2, 480, 380);
  if (isLight) {
    radialGlow.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
    radialGlow.addColorStop(0.6, 'rgba(217, 119, 6, 0.05)');
    radialGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  } else {
    radialGlow.addColorStop(0, theme === 'sapphire' ? 'rgba(56, 189, 248, 0.28)' : theme === 'ruby-gold' ? 'rgba(251, 113, 133, 0.25)' : 'rgba(245, 158, 11, 0.28)');
    radialGlow.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
    radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Ornate Double Outer Framing
  const outerMargin = 48;
  const outerWidth = width - outerMargin * 2;
  const outerHeight = height - outerMargin * 2;
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, goldBright);
  borderGrad.addColorStop(0.5, goldPrimary);
  borderGrad.addColorStop(1, goldDark);

  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 5;
  drawRoundedRect(ctx, outerMargin, outerMargin, outerWidth, outerHeight, 36);
  ctx.stroke();

  const innerMargin = 68;
  const innerWidth = width - innerMargin * 2;
  const innerHeight = height - innerMargin * 2;
  ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.3)' : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, innerMargin, innerMargin, innerWidth, innerHeight, 26);
  ctx.stroke();

  const cornerSize = 42;
  drawLuxuryCorner(ctx, innerMargin + 6, innerMargin + 6, cornerSize, 1, 1, goldBright, 2.5);
  drawLuxuryCorner(ctx, width - innerMargin - 6, innerMargin + 6, cornerSize, -1, 1, goldBright, 2.5);
  drawLuxuryCorner(ctx, innerMargin + 6, height - innerMargin - 6, cornerSize, 1, -1, goldBright, 2.5);
  drawLuxuryCorner(ctx, width - innerMargin - 6, height - innerMargin - 6, cornerSize, -1, -1, goldBright, 2.5);

  // 3. Top Emblem & Header Tag
  ctx.textAlign = 'center';

  ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.35)' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(170, 142);
  ctx.lineTo(340, 142);
  ctx.moveTo(740, 142);
  ctx.lineTo(910, 142);
  ctx.stroke();

  const drawDiamond = (dx: number, dy: number, s: number) => {
    ctx.fillStyle = goldPrimary;
    ctx.beginPath();
    ctx.moveTo(dx, dy - s);
    ctx.lineTo(dx + s, dy);
    ctx.lineTo(dx, dy + s);
    ctx.lineTo(dx - s, dy);
    ctx.closePath();
    ctx.fill();
  };
  drawDiamond(340, 142, 4);
  drawDiamond(740, 142, 4);

  ctx.fillStyle = goldPrimary;
  ctx.font = 'bold 28px "Be Vietnam Pro", sans-serif';
  ctx.letterSpacing = '7px';
  ctx.fillText('✦ THIỆP MỜI TRÂN TRỌNG ✦', width / 2, 148);
  ctx.letterSpacing = '0px';

  // 4. Event Title
  ctx.fillStyle = textHeading;
  const eventTitle = (eventName.value || 'HỘI NGHỊ KINH TẾ & CÔNG NGHỆ 2026').toUpperCase();
  wrapAndDrawText(ctx, eventTitle, width / 2, 220, 840, 54, 2, 44, '900');

  ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.25)' : 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(380, 318);
  ctx.lineTo(500, 318);
  ctx.moveTo(580, 318);
  ctx.lineTo(700, 318);
  ctx.stroke();
  drawDiamond(540, 318, 6);

  // 5. Honored Guest Avatar
  const avatarCenterY = 480;
  const avatarRadius = 115;

  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(width / 2, avatarCenterY, avatarRadius + 14, 0, Math.PI * 2);
  ctx.stroke();

  drawDiamond(width / 2, avatarCenterY - avatarRadius - 14, 5);
  drawDiamond(width / 2, avatarCenterY + avatarRadius + 14, 5);
  drawDiamond(width / 2 - avatarRadius - 14, avatarCenterY, 5);
  drawDiamond(width / 2 + avatarRadius + 14, avatarCenterY, 5);

  ctx.strokeStyle = goldBright;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(width / 2, avatarCenterY, avatarRadius + 3, 0, Math.PI * 2);
  ctx.stroke();

  if (cachedAvatarImg) {
    drawCoverAvatar(ctx, cachedAvatarImg, width / 2, avatarCenterY, avatarRadius);
  } else {
    const monogramGrad = ctx.createLinearGradient(
      width / 2 - avatarRadius,
      avatarCenterY - avatarRadius,
      width / 2 + avatarRadius,
      avatarCenterY + avatarRadius
    );
    if (isLight) {
      monogramGrad.addColorStop(0, '#fef3c7');
      monogramGrad.addColorStop(0.5, '#fde68a');
      monogramGrad.addColorStop(1, '#f59e0b');
    } else {
      monogramGrad.addColorStop(0, goldDark);
      monogramGrad.addColorStop(0.5, goldPrimary);
      monogramGrad.addColorStop(1, goldBright);
    }
    ctx.beginPath();
    ctx.arc(width / 2, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = monogramGrad;
    ctx.fill();

    ctx.fillStyle = isLight ? '#78350f' : '#0c0a09';
    ctx.font = 'bold 96px "Be Vietnam Pro", sans-serif';
    const initial = (attendeeName.value || 'VIP').trim().charAt(0).toUpperCase();
    ctx.fillText(initial, width / 2, avatarCenterY + 34);
  }

  // 6. VIP Role Badge Pill
  const roleBadgeY = 645;
  const roleText = (attendeeRole.value || 'KHÁCH MỜI DANH DỰ (VIP)').toUpperCase();
  ctx.font = 'bold 24px "Be Vietnam Pro", sans-serif';
  const roleMetrics = ctx.measureText(roleText);
  const badgeWidth = Math.min(760, Math.max(340, roleMetrics.width + 70));
  const badgeHeight = 48;

  const badgeGrad = ctx.createLinearGradient(
    (width - badgeWidth) / 2,
    roleBadgeY,
    (width + badgeWidth) / 2,
    roleBadgeY + badgeHeight
  );
  badgeGrad.addColorStop(0, goldBright);
  badgeGrad.addColorStop(1, goldDark);

  ctx.fillStyle = badgeGrad;
  drawRoundedRect(ctx, (width - badgeWidth) / 2, roleBadgeY - badgeHeight / 2, badgeWidth, badgeHeight, 24);
  ctx.fill();

  ctx.strokeStyle = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isLight ? '#ffffff' : '#090d16';
  fitAndDrawText(ctx, roleText, width / 2, roleBadgeY + 8, badgeWidth - 40, 24, 18, 'bold');

  // 7. Attendee Honor Name
  ctx.fillStyle = textSub;
  ctx.font = 'italic 25px "Be Vietnam Pro", sans-serif';
  const salutation = overlayConfig.salutationText || 'Trân trọng Kính mời Quý Khách tham dự';
  ctx.fillText(salutation, width / 2, 730);

  ctx.fillStyle = textHeading;
  fitAndDrawText(ctx, attendeeName.value || 'Quý Khách Mời VIP', width / 2, 795, 840, 56, 34, 'bold');

  ctx.fillStyle = textMuted;
  ctx.font = '500 24px "Be Vietnam Pro", sans-serif';
  ctx.fillText('Sự kiện chính thức & dạ tiệc kết nối', width / 2, 850);

  // 8. Event Details Glassmorphic Card
  const infoCardY = 895;
  const infoCardH = 265;
  const infoCardW = 860;
  const infoCardX = (width - infoCardW) / 2;

  ctx.save();
  ctx.fillStyle = glassCardBg;
  ctx.strokeStyle = glassCardBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, infoCardX, infoCardY, infoCardW, infoCardH, 24);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = goldPrimary;
  fitAndDrawText(ctx, `📅  ${eventTimeText.value}`, width / 2, infoCardY + 68, infoCardW - 60, 30, 22, 'bold');

  ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.2)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(infoCardX + 50, infoCardY + 115);
  ctx.lineTo(infoCardX + infoCardW - 50, infoCardY + 115);
  ctx.stroke();

  ctx.fillStyle = textHeading;
  wrapAndDrawText(ctx, `📍  ${eventLocation.value}`, width / 2, infoCardY + 168, infoCardW - 60, 42, 2, 26, '600');

  // 9. QR Code Section
  const qrBoxSize = 280;
  const qrBoxY = 1195;
  const qrBoxX = (width - qrBoxSize) / 2;

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
  ctx.fill();

  ctx.strokeStyle = goldBright;
  ctx.lineWidth = 3;
  ctx.stroke();

  drawLuxuryCorner(ctx, qrBoxX + 12, qrBoxY + 12, 24, 1, 1, goldDark, 2);
  drawLuxuryCorner(ctx, qrBoxX + qrBoxSize - 12, qrBoxY + 12, 24, -1, 1, goldDark, 2);
  drawLuxuryCorner(ctx, qrBoxX + 12, qrBoxY + qrBoxSize - 12, 24, 1, -1, goldDark, 2);
  drawLuxuryCorner(ctx, qrBoxX + qrBoxSize - 12, qrBoxY + qrBoxSize - 12, 24, -1, -1, goldDark, 2);

  const qrImg = await ensureQrImage(qrBoxSize - 40);
  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX + 20, qrBoxY + 20, qrBoxSize - 40, qrBoxSize - 40);
  }

  // 10. Code Label & Check-in instructions
  ctx.fillStyle = textHeading;
  fitAndDrawText(ctx, qrLabel.value, width / 2, qrBoxY + qrBoxSize + 52, 800, 30, 20, 'bold', '"JetBrains Mono", monospace');

  ctx.fillStyle = textMuted;
  ctx.font = '500 23px "Be Vietnam Pro", sans-serif';
  ctx.fillText('Xuất trình mã QR tại quầy tiếp đón để check-in tức thì', width / 2, qrBoxY + qrBoxSize + 98);

  // 11. Bottom Prestige Ribbon & Seal
  ctx.strokeStyle = isLight ? 'rgba(180, 83, 9, 0.3)' : 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(220, 1690);
  ctx.lineTo(390, 1690);
  ctx.moveTo(690, 1690);
  ctx.lineTo(860, 1690);
  ctx.stroke();

  drawDiamond(390, 1690, 4);
  drawDiamond(690, 1690, 4);

  ctx.fillStyle = goldPrimary;
  ctx.font = 'bold 24px "Be Vietnam Pro", sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('★ BAN TỔ CHỨC TRÂN TRỌNG ĐÓN TIẾP ★', width / 2, 1698);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = textMuted;
  ctx.font = '400 20px "Be Vietnam Pro", sans-serif';
  ctx.fillText('HỆ THỐNG QUẢN LÝ CHECK-IN SỰ KIỆN EVENTGO • VIP GALA PASS', width / 2, 1740);

  previewDataUrl.value = canvas.toDataURL('image/png');
};

const toggleAdvancedEditor = () => {
  showAdvancedEditor.value = !showAdvancedEditor.value;
  if (!showAdvancedEditor.value && selectedTheme.value === 'custom-template') {
    selectedTheme.value = 'ivory-gold';
    generateCard();
  }
};

const downloadCard = () => {
  if (!previewDataUrl.value) return;
  const a = document.createElement('a');
  a.href = previewDataUrl.value;
  const safeName = (attendeeName.value || 'VIP').replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
  a.download = `Thiep_Moi_VIP_${safeName}.png`;
  a.click();
};

const sharingCard = ref(false);

const shareCard = async () => {
  if (!previewDataUrl.value) return;
  sharingCard.value = true;
  try {
    const res = await fetch(previewDataUrl.value);
    const blob = await res.blob();
    const safeName = (attendeeName.value || 'VIP').replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
    const file = new File([blob], `Thiep_Moi_VIP_${safeName}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Thư mời VIP: ${eventName.value}`,
        text: `Trân trọng Kính mời ${attendeeName.value || 'Quý Khách'} tham dự ${eventName.value}!`,
        files: [file],
      });
    } else if (navigator.share) {
      await navigator.share({
        title: `Thư mời VIP: ${eventName.value}`,
        text: `Trân trọng Kính mời ${attendeeName.value || 'Quý Khách'} tham dự ${eventName.value}!`,
        url: window.location.href,
      });
    } else {
      downloadCard();
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Share not completed:', err);
      downloadCard();
    }
  } finally {
    sharingCard.value = false;
  }
};

watch(
  () => props.show,
  async (val) => {
    if (val) {
      isGenerating.value = true;
      await initData();
      setTimeout(async () => {
        await generateCard();
        isGenerating.value = false;
      }, 60);
    }
  }
);

onMounted(async () => {
  window.addEventListener('paste', handleWindowPaste);
  if (props.show) {
    isGenerating.value = true;
    await initData();
    setTimeout(async () => {
      await generateCard();
      isGenerating.value = false;
    }, 60);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('paste', handleWindowPaste);
});
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
  >
    <div
      class="bg-white rounded-2xl sm:rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200/80 my-auto h-[92dvh] sm:h-[90vh] max-h-[860px] flex flex-col overflow-hidden animate-scale-in"
    >
      <!-- Header (shrink-0) -->
      <div class="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 bg-white shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/50">
            <Sparkles class="w-5 h-5 text-amber-500" />
          </div>
          <div class="min-w-0">
            <h3 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Tạo thiệp mời VIP</span>
              <span v-if="selectedTheme === 'custom-template'" class="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                Phôi Canva
              </span>
            </h3>
            <p class="text-xs text-slate-500">Chỉnh sửa thông tin, căn chỉnh vị trí trực quan và tải thiệp chất lượng cao.</p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          title="Đóng"
          aria-label="Đóng"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body (flex-1 min-h-0 overflow-hidden) -->
      <div class="p-2.5 sm:p-5 flex-1 min-h-0 flex flex-col md:grid md:grid-cols-12 gap-3.5 md:gap-4 lg:gap-6 overflow-y-auto md:overflow-hidden overscroll-contain">
        
        <!-- Col 1: Form Customization (md:col-span-7) - Ở DƯỚI TRÊN MOBILE, BÊN TRÁI TRÊN DESKTOP -->
        <div class="order-2 md:order-1 md:col-span-7 md:h-full md:min-h-0 flex flex-col md:overflow-hidden space-y-0 text-sm">
          
          <!-- Top Tab Switcher (shrink-0) -->
          <div class="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mb-3 shrink-0 text-xs font-bold">
            <button
              type="button"
              @click="activeEditorTab = 'template'"
              :class="activeEditorTab === 'template' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              class="py-2 px-1.5 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Palette class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">Mẫu phôi</span>
            </button>

            <button
              type="button"
              @click="activeEditorTab = 'position'"
              :class="activeEditorTab === 'position' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              class="py-2 px-1.5 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sliders class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">Căn chỉnh vị trí</span>
              <span v-if="selectedTheme === 'custom-template'" class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            </button>

            <button
              type="button"
              @click="activeEditorTab = 'info'"
              :class="activeEditorTab === 'info' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              class="py-2 px-1.5 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <User class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">Thông tin</span>
            </button>
          </div>

          <!-- Scrollable Tab Content (flex-1 min-h-0 overflow-y-auto) -->
          <div class="md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1.5 space-y-3.5 custom-scrollbar pb-2">
            
            <!-- TAB 1: MẪU PHÔI & CANVA -->
            <div v-if="activeEditorTab === 'template'" class="space-y-3.5">
              <!-- Mẫu có sẵn của hệ thống -->
              <div class="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-800 uppercase tracking-wider">Mẫu có sẵn</span>
                  <span class="text-xs text-slate-500 font-medium">Đang dùng: <strong class="text-indigo-600">{{ selectedThemeName }}</strong></span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    v-for="t in themes"
                    :key="t.id"
                    type="button"
                    @click="selectedTheme = t.id; activeSavedTemplateId = null; generateCard()"
                    :class="selectedTheme === t.id ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'"
                    class="rounded-xl border p-2 text-left text-xs font-semibold transition flex flex-col gap-1.5 cursor-pointer"
                  >
                    <div class="h-10 w-full rounded-lg bg-gradient-to-br border border-black/10 flex items-center justify-center" :class="t.bgPreview">
                      <span v-if="selectedTheme === t.id" class="w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-xs text-xs font-black">✓</span>
                    </div>
                    <span class="truncate text-[11px] font-bold">{{ t.name }}</span>
                  </button>
                </div>
              </div>

              <!-- Thiết kế riêng Canva / Tải ảnh lên -->
              <div class="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles class="w-3.5 h-3.5 text-amber-500" />
                      <span>Phôi thiết kế riêng (Canva / Tải ảnh lên)</span>
                    </h4>
                    <p class="text-[11px] text-slate-500">Tải ảnh phôi trống để tự động ghép mã QR, tên khách và chức vụ.</p>
                  </div>
                  <a
                    href="https://www.canva.com/vi_vn/thiep-moi/mau/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Mở mẫu Canva <ExternalLink class="w-3 h-3" />
                  </a>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <label class="btn btn-primary py-1.5 px-3 text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5">
                    <Upload class="w-3.5 h-3.5" />
                    <span>{{ customTemplateUrl ? 'Đổi ảnh phôi khác' : 'Tải ảnh phôi từ máy' }}</span>
                    <input type="file" accept="image/*" @change="handleTemplateUpload" class="hidden" />
                  </label>

                  <button
                    type="button"
                    @click="pasteTemplateFromClipboard"
                    class="btn py-1.5 px-3 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Copy ảnh từ Canva (Ctrl+C) rồi bấm vào đây hoặc nhấn Ctrl+V"
                  >
                    <Copy class="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dán ảnh (Ctrl+V)</span>
                  </button>

                  <button
                    v-if="customTemplateUrl"
                    type="button"
                    @click="clearCustomTemplate"
                    class="btn btn-ghost py-1.5 px-2 text-rose-600 hover:bg-rose-50 text-xs flex items-center gap-1 cursor-pointer"
                    title="Xóa phôi hiện tại"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    <span>Xóa phôi</span>
                  </button>
                </div>

                <div v-if="pasteNotice" class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ pasteNotice }}</span>
                </div>

                <!-- 1-Click Built-in Blank Frames -->
                <div class="pt-2 border-t border-indigo-100/60 space-y-1.5">
                  <div class="text-[11px] font-semibold text-slate-600">⚡ Chọn nhanh khung phôi dựng sẵn:</div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      v-for="p in quickCanvaPresets"
                      :key="p.id"
                      type="button"
                      @click="applyQuickCanvaPreset(p); activeEditorTab = 'position'"
                      class="px-2 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white text-[11px] font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <span class="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20" :style="{ backgroundColor: p.bg2, borderColor: p.accent }"></span>
                      <span class="truncate">{{ p.name }}</span>
                    </button>
                  </div>
                </div>

                <!-- Save Current Custom Template -->
                <div v-if="customTemplateUrl" class="pt-2 border-t border-indigo-100/60 flex flex-wrap items-center gap-2">
                  <input
                    v-model="customTemplateName"
                    type="text"
                    placeholder="Đặt tên mẫu phôi này..."
                    class="input py-1 px-2.5 text-xs flex-1 min-w-[160px] bg-white"
                  />
                  <button
                    type="button"
                    @click="saveCustomTemplateToStorage(false)"
                    class="btn py-1.5 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Check v-if="savedTemplateNotice" class="w-3.5 h-3.5" />
                    <Save v-else class="w-3.5 h-3.5" />
                    <span>{{ savedTemplateNotice ? 'Đã lưu!' : 'Lưu vào Kho Mẫu' }}</span>
                  </button>
                </div>
              </div>

              <!-- Kho mẫu đã lưu -->
              <div v-if="savedTemplatesList.length" class="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-800 uppercase tracking-wider">Kho mẫu đã lưu ({{ savedTemplatesList.length }})</span>
                  <span class="text-[11px] text-slate-500">Chạm để áp dụng ngay</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  <div
                    v-for="tpl in savedTemplatesList"
                    :key="tpl.id"
                    :class="selectedTheme === 'custom-template' && activeSavedTemplateId === tpl.id ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500' : 'border-slate-200 bg-white hover:border-slate-300'"
                    class="flex items-center gap-2 rounded-xl border p-2 transition"
                  >
                    <button
                      type="button"
                      @click="selectSavedTemplate(tpl); activeEditorTab = 'position'"
                      class="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <img :src="tpl.templateUrl" :alt="tpl.name" class="h-10 w-8 shrink-0 rounded object-cover border border-slate-200 shadow-2xs" />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-xs font-bold text-slate-800">{{ tpl.name }}</p>
                        <p class="text-[10px] text-slate-400">Đã lưu cấu hình vị trí</p>
                      </div>
                      <Check v-if="selectedTheme === 'custom-template' && activeSavedTemplateId === tpl.id" class="h-4 w-4 shrink-0 text-emerald-600" />
                    </button>
                    <button
                      type="button"
                      @click="deleteSavedTemplate(tpl.id)"
                      :aria-label="`Xóa mẫu ${tpl.name}`"
                      class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                      title="Xóa mẫu này"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 2: CĂN CHỈNH VỊ TRÍ & TỌA ĐỘ -->
            <div v-if="activeEditorTab === 'position'" class="space-y-3.5">
              <!-- Informational banner -->
              <div class="bg-indigo-50/80 border border-indigo-200/70 p-2.5 rounded-xl flex items-center justify-between text-xs text-indigo-900 font-medium">
                <div class="flex items-center gap-1.5">
                  <Move class="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Kéo thanh trượt hoặc <strong>chạm/kéo trực tiếp trên hình bên phải</strong>!</span>
                </div>
                <button
                  type="button"
                  @click="resetOverlayPositions"
                  class="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-2xs"
                  title="Đặt lại tọa độ mặc định"
                >
                  <RotateCcw class="w-3 h-3" />
                  <span>Đặt lại</span>
                </button>
              </div>

              <!-- Layer Visibility Checkboxes -->
              <div class="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                <div class="text-xs font-bold text-slate-800 uppercase tracking-wider">Bật / Tắt hiển thị các lớp</div>
                <div class="flex flex-wrap gap-1.5">
                  <label
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none"
                    :class="overlayConfig.showQr ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                  >
                    <input type="checkbox" v-model="overlayConfig.showQr" @change="generateCard" class="sr-only" />
                    <span>✓ Mã QR</span>
                  </label>

                  <label
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none"
                    :class="overlayConfig.showName ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                  >
                    <input type="checkbox" v-model="overlayConfig.showName" @change="generateCard" class="sr-only" />
                    <span>✓ Tên khách</span>
                  </label>

                  <label
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none"
                    :class="overlayConfig.showRole ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                  >
                    <input type="checkbox" v-model="overlayConfig.showRole" @change="generateCard" class="sr-only" />
                    <span>✓ Chức vụ</span>
                  </label>

                  <label
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none"
                    :class="overlayConfig.showAvatar ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                  >
                    <input type="checkbox" v-model="overlayConfig.showAvatar" @change="generateCard" class="sr-only" />
                    <span>✓ Avatar</span>
                  </label>

                  <label
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none"
                    :class="overlayConfig.showEventInfo ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
                  >
                    <input type="checkbox" v-model="overlayConfig.showEventInfo" @change="generateCard" class="sr-only" />
                    <span>✓ Ngày & Địa điểm</span>
                  </label>
                </div>
              </div>

              <!-- Layer Select Mini Tabs -->
              <div class="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-800 uppercase tracking-wider">Căn chỉnh lớp chi tiết</span>
                  <span class="text-xs text-indigo-600 font-bold">
                    {{ activeAdjustTab === 'qr' ? 'Mã QR' : activeAdjustTab === 'name' ? 'Tên khách' : activeAdjustTab === 'role' ? 'Chức vụ' : 'Avatar' }}
                  </span>
                </div>

                <div class="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    @click="activeAdjustTab = 'qr'"
                    :class="activeAdjustTab === 'qr' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
                    class="py-1.5 px-1 rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    🔳 Mã QR
                  </button>
                  <button
                    type="button"
                    @click="activeAdjustTab = 'name'"
                    :class="activeAdjustTab === 'name' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
                    class="py-1.5 px-1 rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    👤 Tên khách
                  </button>
                  <button
                    type="button"
                    @click="activeAdjustTab = 'role'"
                    :class="activeAdjustTab === 'role' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
                    class="py-1.5 px-1 rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    🏷️ Chức vụ
                  </button>
                  <button
                    type="button"
                    @click="activeAdjustTab = 'avatar'"
                    :class="activeAdjustTab === 'avatar' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
                    class="py-1.5 px-1 rounded-lg text-xs transition cursor-pointer text-center"
                  >
                    🖼️ Avatar
                  </button>
                </div>

                <!-- DIRECTIONAL NUDGE KEYPAD FOR MOBILE & FAST DESKTOP POSITIONING -->
                <div class="bg-indigo-50/60 border border-indigo-100 p-2.5 rounded-xl space-y-2">
                  <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span class="flex items-center gap-1 text-indigo-900">
                      <Move class="w-3.5 h-3.5 text-indigo-600" />
                      <span>Phím di chuyển: <strong class="text-indigo-700">{{ activeAdjustTabName }}</strong></span>
                    </span>
                    <div class="flex items-center gap-1">
                      <span class="text-[10px] text-slate-400">Bước nhảy:</span>
                      <button
                        v-for="s in [1, 2, 5]"
                        :key="s"
                        type="button"
                        @click="nudgeStep = s"
                        :class="nudgeStep === s ? 'bg-indigo-700 text-white font-black' : 'bg-white text-slate-600 border border-slate-200'"
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                      >
                        {{ s }}%
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      @click="nudge(-nudgeStep, 0)"
                      class="py-2 px-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition shadow-2xs"
                    >
                      ◀ Trái
                    </button>
                    <button
                      type="button"
                      @click="nudge(0, -nudgeStep)"
                      class="py-2 px-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition shadow-2xs"
                    >
                      ▲ Lên
                    </button>
                    <button
                      type="button"
                      @click="centerActiveLayer"
                      class="py-2 px-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition shadow-2xs"
                    >
                      ⊙ Giữa
                    </button>
                    <button
                      type="button"
                      @click="nudge(0, nudgeStep)"
                      class="py-2 px-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition shadow-2xs"
                    >
                      ▼ Xuống
                    </button>
                    <button
                      type="button"
                      @click="nudge(nudgeStep, 0)"
                      class="py-2 px-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition shadow-2xs"
                    >
                      ▶ Phải
                    </button>
                  </div>
                </div>

                <!-- Active Tab Sliders -->
                <!-- QR CONTROLS -->
                <div v-if="activeAdjustTab === 'qr'" class="space-y-3 pt-1">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Ngang (X)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.qrX }}%</span>
                      </div>
                      <input type="range" min="10" max="90" v-model.number="overlayConfig.qrX" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                      <button type="button" @click="overlayConfig.qrX = 50; generateCard()" class="text-[10px] text-indigo-600 font-semibold hover:underline mt-0.5 block">Căn giữa (50%)</button>
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Dọc (Y)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.qrY }}%</span>
                      </div>
                      <input type="range" min="10" max="92" v-model.number="overlayConfig.qrY" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Kích cỡ QR</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.qrSize }}px</span>
                      </div>
                      <input type="range" min="140" max="460" step="10" v-model.number="overlayConfig.qrSize" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-3 pt-1">
                    <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input type="checkbox" v-model="overlayConfig.qrWhiteBox" @change="generateCard" class="rounded text-indigo-600" />
                      <span>Khung nền trắng viền vàng</span>
                    </label>
                    <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input type="checkbox" v-model="overlayConfig.showQrLabel" @change="generateCard" class="rounded text-indigo-600" />
                      <span>Hiện dòng mã vé dưới QR</span>
                    </label>
                    <div v-if="overlayConfig.showQrLabel" class="flex items-center gap-1.5 ml-auto">
                      <span class="text-xs font-medium text-slate-500">Màu chữ mã:</span>
                      <input type="color" v-model="overlayConfig.qrLabelColor" @input="generateCard" class="w-6 h-6 rounded cursor-pointer border border-slate-200" />
                    </div>
                  </div>
                </div>

                <!-- GUEST NAME CONTROLS -->
                <div v-if="activeAdjustTab === 'name'" class="space-y-3 pt-1">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Ngang (X)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.nameX }}%</span>
                      </div>
                      <input type="range" min="10" max="90" v-model.number="overlayConfig.nameX" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                      <button type="button" @click="overlayConfig.nameX = 50; generateCard()" class="text-[10px] text-indigo-600 font-semibold hover:underline mt-0.5 block">Căn giữa (50%)</button>
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Dọc (Y)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.nameY }}%</span>
                      </div>
                      <input type="range" min="8" max="92" v-model.number="overlayConfig.nameY" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Cỡ chữ tên</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.nameFontSize }}px</span>
                      </div>
                      <input type="range" min="26" max="86" step="2" v-model.number="overlayConfig.nameFontSize" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-semibold text-slate-600">Màu chữ tên:</span>
                      <input type="color" v-model="overlayConfig.nameColor" @input="generateCard" class="w-6 h-6 rounded cursor-pointer border border-slate-200" />
                      <button
                        v-for="c in colorPresets"
                        :key="c.value"
                        type="button"
                        @click="overlayConfig.nameColor = c.value; generateCard()"
                        class="w-5 h-5 rounded-full border border-slate-300 shadow-2xs transition hover:scale-110"
                        :style="{ backgroundColor: c.value }"
                        :title="c.label"
                      />
                    </div>
                    <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input type="checkbox" v-model="overlayConfig.showSalutation" @change="generateCard" class="rounded text-indigo-600" />
                      <span>Hiện dòng đầu thiệp</span>
                    </label>
                  </div>

                  <div v-if="overlayConfig.showSalutation" class="pt-1.5">
                    <label class="block text-[11px] font-semibold text-slate-600 mb-1">Dòng chữ đầu thiệp</label>
                    <input
                      v-model="overlayConfig.salutationText"
                      @input="generateCard"
                      placeholder="Trân trọng Kính mời Quý Khách tham dự"
                      class="input w-full py-1.5 px-3 text-xs"
                    />
                  </div>
                </div>

                <!-- ROLE CONTROLS -->
                <div v-if="activeAdjustTab === 'role'" class="space-y-3 pt-1">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Ngang (X)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.roleX }}%</span>
                      </div>
                      <input type="range" min="10" max="90" v-model.number="overlayConfig.roleX" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                      <button type="button" @click="overlayConfig.roleX = 50; generateCard()" class="text-[10px] text-indigo-600 font-semibold hover:underline mt-0.5 block">Căn giữa (50%)</button>
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Dọc (Y)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.roleY }}%</span>
                      </div>
                      <input type="range" min="8" max="92" v-model.number="overlayConfig.roleY" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Cỡ chữ</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.roleFontSize }}px</span>
                      </div>
                      <input type="range" min="16" max="50" step="2" v-model.number="overlayConfig.roleFontSize" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-slate-600">Kiểu hiển thị:</span>
                      <button
                        type="button"
                        @click="overlayConfig.roleStyle = 'badge'; generateCard()"
                        :class="overlayConfig.roleStyle === 'badge' ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold' : 'bg-white text-slate-600 border-slate-200'"
                        class="px-2.5 py-1 rounded-lg border text-xs cursor-pointer shadow-2xs"
                      >
                        Khung Vàng VIP
                      </button>
                      <button
                        type="button"
                        @click="overlayConfig.roleStyle = 'plain'; generateCard()"
                        :class="overlayConfig.roleStyle === 'plain' ? 'bg-indigo-100 text-indigo-900 border-indigo-400 font-bold' : 'bg-white text-slate-600 border-slate-200'"
                        class="px-2.5 py-1 rounded-lg border text-xs cursor-pointer shadow-2xs"
                      >
                        Chữ Thuần
                      </button>
                    </div>
                    <div v-if="overlayConfig.roleStyle === 'plain'" class="flex items-center gap-1.5">
                      <span class="text-xs font-medium text-slate-500">Màu chữ:</span>
                      <input type="color" v-model="overlayConfig.roleColor" @input="generateCard" class="w-6 h-6 rounded cursor-pointer border border-slate-200" />
                    </div>
                  </div>
                </div>

                <!-- AVATAR CONTROLS -->
                <div v-if="activeAdjustTab === 'avatar'" class="space-y-3 pt-1">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Ngang (X)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.avatarX }}%</span>
                      </div>
                      <input type="range" min="10" max="90" v-model.number="overlayConfig.avatarX" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                      <button type="button" @click="overlayConfig.avatarX = 50; generateCard()" class="text-[10px] text-indigo-600 font-semibold hover:underline mt-0.5 block">Căn giữa (50%)</button>
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Dọc (Y)</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.avatarY }}%</span>
                      </div>
                      <input type="range" min="10" max="90" v-model.number="overlayConfig.avatarY" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                    <div>
                      <div class="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                        <span>Độ lớn avatar</span>
                        <span class="text-indigo-600 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{{ overlayConfig.avatarSize }}px</span>
                      </div>
                      <input type="range" min="50" max="200" step="5" v-model.number="overlayConfig.avatarSize" @input="generateCard" class="w-full accent-indigo-600 cursor-pointer" />
                    </div>
                  </div>

                  <div class="pt-1">
                    <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input type="checkbox" v-model="overlayConfig.avatarBorder" @change="generateCard" class="rounded text-indigo-600" />
                      <span>Vẽ viền vàng hoàng gia quanh ảnh chân dung</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: THÔNG TIN KHÁCH MỜI & SỰ KIỆN -->
            <div v-if="activeEditorTab === 'info'" class="space-y-3.5">
              <!-- Guest Info Card -->
              <div class="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                <div class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <User class="w-4 h-4 text-indigo-600" />
                  <span>Thông tin khách mời</span>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Dòng chữ đầu thiệp</label>
                    <input
                      v-model="overlayConfig.salutationText"
                      @input="generateCard"
                      placeholder="Trân trọng Kính mời Quý Khách tham dự"
                      class="input w-full py-1.5 px-3 text-xs"
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Họ và tên khách mời</label>
                      <input
                        v-model="attendeeName"
                        @input="generateCard"
                        placeholder="Nhập tên khách mời"
                        class="input w-full py-1.5 px-3 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Danh xưng / Chức vụ</label>
                      <input
                        v-model="attendeeRole"
                        @input="generateCard"
                        placeholder="Ví dụ: Khách Mời Danh Dự (VIP)"
                        class="input w-full py-1.5 px-3 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <!-- Avatar Upload -->
                <div class="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600">
                      <img v-if="customAvatarUrl" :src="customAvatarUrl" alt="Avatar" class="w-full h-full object-cover" />
                      <span v-else>{{ attendeeName ? attendeeName.charAt(0).toUpperCase() : 'VIP' }}</span>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-slate-800">Ảnh chân dung</p>
                      <p class="text-[10px] text-slate-400">Tùy chọn tải ảnh chân dung thực tế</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <label class="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs">
                      <Upload class="w-3.5 h-3.5 text-amber-600" />
                      <span>{{ customAvatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên' }}</span>
                      <input type="file" accept="image/*" @change="handleAvatarUpload" class="hidden" />
                    </label>
                    <button
                      v-if="customAvatarUrl"
                      type="button"
                      @click="customAvatarUrl = null; cachedAvatarImg = null; generateCard()"
                      class="btn btn-ghost py-1 px-2 text-rose-600 text-xs hover:bg-rose-50 cursor-pointer"
                      title="Xóa ảnh riêng"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                </div>
              </div>

              <!-- Event & QR parameters card -->
              <div class="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                <div class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar class="w-4 h-4 text-indigo-600" />
                  <span>Sự kiện & Mã Check-in</span>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">Tên sự kiện</label>
                  <input
                    v-model="eventName"
                    @input="generateCard"
                    placeholder="VD: HỘI NGHỊ KINH TẾ TECHSUMMIT 2026"
                    class="input w-full py-1.5 px-3 text-xs font-semibold"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Calendar class="w-3 h-3 text-slate-400" />
                      <span>Thời gian</span>
                    </label>
                    <input
                      v-model="eventTimeText"
                      @input="generateCard"
                      class="input w-full py-1.5 px-3 text-xs"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin class="w-3 h-3 text-slate-400" />
                      <span>Địa điểm</span>
                    </label>
                    <input
                      v-model="eventLocation"
                      @input="generateCard"
                      class="input w-full py-1.5 px-3 text-xs"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Link class="w-3 h-3 text-slate-400" />
                      <span>Nội dung QR (Link / Mã)</span>
                    </label>
                    <input
                      v-model="qrContent"
                      @input="generateCard"
                      class="input w-full py-1.5 px-3 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Nhãn hiển thị dưới QR</label>
                    <input
                      v-model="qrLabel"
                      @input="generateCard"
                      class="input w-full py-1.5 px-3 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Col 2: Live Canvas Preview & Quick Export (md:col-span-5) - TRÊN CÙNG TRÊN MOBILE, BÊN PHẢI TRÊN DESKTOP -->
        <div
          class="order-1 md:order-2 md:col-span-5 md:h-full md:min-h-0 flex flex-col justify-between items-center bg-slate-900 text-white p-2.5 sm:p-4 rounded-2xl border border-slate-800 shadow-sm shrink-0 md:shrink overflow-hidden space-y-2"
        >
          <!-- Top Preview Bar (shrink-0) -->
          <div class="flex items-center justify-between w-full px-1 text-slate-400 text-xs shrink-0">
            <span class="flex items-center gap-1 font-semibold text-amber-400">
              <Sparkles class="w-3.5 h-3.5" />
              <span>{{ selectedTheme === 'custom-template' ? 'Chạm/Kéo để đặt vị trí' : 'Xem trước thiệp mời VIP' }}</span>
            </span>
            <button
              type="button"
              @click="showZoomModal = true"
              class="hover:text-white flex items-center gap-1 transition cursor-pointer text-xs bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60"
              title="Phóng to xem đầy đủ"
            >
              <Maximize2 class="w-3.5 h-3.5" />
              <span>Phóng to</span>
            </button>
          </div>

          <!-- Interactive Quick Layer Selector Buttons (shrink-0) -->
          <div
            v-if="selectedTheme === 'custom-template'"
            class="w-full flex items-center justify-center gap-1 bg-slate-800/90 p-1 rounded-xl text-xs font-bold shrink-0 border border-slate-700/50"
          >
            <span class="text-slate-400 px-1 text-[11px] hidden sm:inline">Chạm đặt:</span>
            <button
              type="button"
              @click="selectLayerForAdjust('qr')"
              :class="activeAdjustTab === 'qr' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer text-xs flex-1 sm:flex-initial text-center"
            >
              Mã QR
            </button>
            <button
              type="button"
              @click="selectLayerForAdjust('name')"
              :class="activeAdjustTab === 'name' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer text-xs flex-1 sm:flex-initial text-center"
            >
              Tên
            </button>
            <button
              type="button"
              @click="selectLayerForAdjust('role')"
              :class="activeAdjustTab === 'role' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer text-xs flex-1 sm:flex-initial text-center"
            >
              Chức vụ
            </button>
            <button
              type="button"
              @click="selectLayerForAdjust('avatar')"
              :class="activeAdjustTab === 'avatar' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700/60'"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer text-xs flex-1 sm:flex-initial text-center"
            >
              Avatar
            </button>
          </div>

          <!-- Live Card Preview Canvas Wrapper -->
          <div class="w-full flex items-center justify-center my-auto overflow-hidden py-1">
            <div
              ref="previewContainerRef"
              @pointerdown="onPreviewPointerDown"
              @pointermove="onPreviewPointerMove"
              @pointerup="onPreviewPointerUp"
              @pointercancel="onPreviewPointerUp"
              :class="[selectedTheme === 'custom-template' ? 'cursor-crosshair' : '', isDraggingPreview ? 'touch-none' : 'touch-pan-y']"
              class="relative h-[250px] sm:h-[300px] md:h-full md:max-h-[480px] w-auto aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/30 bg-slate-950 flex items-center justify-center group select-none"
              :style="{ aspectRatio: `1080 / ${customAspectHeight}` }"
            >
              <!-- Hidden high-res canvas -->
              <canvas ref="canvasRef" class="hidden"></canvas>

              <img
                v-if="previewDataUrl"
                :src="previewDataUrl"
                alt="Xem trước thiệp mời"
                draggable="false"
                class="w-full h-full object-contain pointer-events-none"
              />
              <div v-else class="aspect-[9/16] w-full text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <Sparkles class="w-6 h-6 animate-spin text-amber-400" />
                <span>Đang kết xuất thiệp...</span>
              </div>

              <!-- Generating indicator overlay -->
              <div
                v-if="isGenerating"
                class="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center text-amber-400 text-xs font-bold gap-2"
              >
                <Sparkles class="w-4 h-4 animate-spin" />
                <span>Đang xử lý hình ảnh...</span>
              </div>
            </div>
          </div>

          <!-- Quick Action Buttons for Card -->
          <div class="w-full grid grid-cols-2 gap-2 shrink-0 pt-0.5">
            <button
              type="button"
              @click="downloadCard"
              :disabled="isGenerating || !previewDataUrl"
              class="py-2 px-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Tải thiệp PNG</span>
            </button>
            <button
              type="button"
              @click="shareCard"
              :disabled="isGenerating || !previewDataUrl"
              class="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
            >
              <Share2 class="w-3.5 h-3.5" />
              <span>Chia sẻ Zalo/SMS</span>
            </button>
          </div>

          <!-- Hint footer for preview (shrink-0) -->
          <div class="text-[11px] text-slate-400 text-center shrink-0 w-full hidden sm:block">
            <span v-if="selectedTheme === 'custom-template'" class="text-amber-300">
              ✦ Chạm & kéo trực tiếp trên ảnh để đổi vị trí nhanh
            </span>
            <span v-else class="text-slate-400">
              Độ phân giải chuẩn HD 1080×1920 (Gửi Zalo / In ấn)
            </span>
          </div>
        </div>

      </div>

      <!-- Modal Footer (shrink-0) -->
      <div class="flex items-center justify-between border-t border-slate-200 bg-white px-3 sm:px-5 py-3 pb-safe shrink-0">
        <div class="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Đang dùng: <strong class="text-slate-800">{{ selectedThemeName }}</strong></span>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            @click="emit('close')"
            class="btn btn-secondary px-3.5 text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            @click="shareCard"
            :disabled="isGenerating || !previewDataUrl"
            class="btn bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Chia sẻ thiệp qua Zalo, Messenger, SMS"
          >
            <Share2 class="h-4 w-4" />
            <span class="hidden sm:inline">Chia sẻ</span>
          </button>
          <button
            type="button"
            @click="downloadCard"
            :disabled="isGenerating || !previewDataUrl"
            class="btn btn-primary px-4 text-xs font-bold shadow-md shadow-primary-500/20 cursor-pointer"
          >
            <Download class="h-4 w-4" />
            <span>{{ isGenerating ? 'Đang tạo…' : 'Tải thiệp PNG' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Zoom Lightbox Modal -->
    <div
      v-if="showZoomModal && previewDataUrl"
      class="fixed inset-0 z-[130] bg-black/95 backdrop-blur-md flex items-center justify-center p-3"
      @click.self="showZoomModal = false"
    >
      <div class="relative max-h-[96vh] max-w-md w-full flex flex-col items-center">
        <button
          @click="showZoomModal = false"
          class="absolute -top-10 right-0 text-white hover:text-amber-400 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
        >
          <X class="w-5 h-5" />
          <span>Đóng xem lớn</span>
        </button>
        <img
          :src="previewDataUrl"
          alt="Xem trước thiệp mời kích thước lớn"
          class="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-amber-500/40"
        />
        <div class="mt-3 flex items-center gap-2.5">
          <button
            @click="shareCard"
            class="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 font-bold flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Share2 class="w-4 h-4" />
            <span>Chia sẻ thiệp</span>
          </button>
          <button
            @click="downloadCard"
            class="btn btn-primary text-xs px-4 py-2 font-bold flex items-center gap-2 cursor-pointer"
          >
            <Download class="w-4 h-4" />
            <span>Tải ảnh PNG HD về máy</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>