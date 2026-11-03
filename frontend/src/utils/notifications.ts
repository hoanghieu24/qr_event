/**
 * Web Notification & Event Reminders Utility
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Trình duyệt không hỗ trợ Web Notification.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%234f46e5"/><path d="M18 18h11v11H18zM35 18h11v11H35zM18 35h11v11H18zM38 38h5v5h-5z" fill="white"/></svg>',
          badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%234f46e5"/><path d="M18 18h11v11H18zM35 18h11v11H35zM18 35h11v11H18zM38 38h5v5h-5z" fill="white"/></svg>',
          ...options,
        });
      });
    } else {
      new Notification(title, {
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%234f46e5"/><path d="M18 18h11v11H18zM35 18h11v11H35zM18 35h11v11H18zM38 38h5v5h-5z" fill="white"/></svg>',
        ...options,
      });
    }
  } catch (err) {
    console.warn('Could not show notification:', err);
  }
}

/**
 * Check upcoming events and trigger notifications if within threshold (e.g. 24h or 2h)
 */
export function checkUpcomingEventReminders(tickets: any[]) {
  if (!tickets || !Array.isArray(tickets)) return;

  const now = Date.now();
  tickets.forEach((t) => {
    if (!t.event_start_at || t.status === 'USED') return;
    const startMs = new Date(t.event_start_at).getTime();
    const diffHours = (startMs - now) / (1000 * 60 * 60);

    const reminderKey = `ktsqr_reminded_${t.id}_${Math.floor(diffHours <= 2 ? 2 : 24)}`;
    if (localStorage.getItem(reminderKey)) return;

    if (diffHours > 0 && diffHours <= 2) {
      showBrowserNotification(`⏰ Sắp diễn ra trong 2 giờ: ${t.event_name}`, {
        body: `Sự kiện sẽ bắt đầu vào lúc ${new Date(t.event_start_at).toLocaleTimeString('vi-VN')} tại ${t.event_location}. Mở vé QR để check-in ngay!`,
      });
      localStorage.setItem(reminderKey, 'true');
    } else if (diffHours > 2 && diffHours <= 24) {
      showBrowserNotification(`📅 Nhắc nhở sự kiện ngày mai: ${t.event_name}`, {
        body: `Sự kiện diễn ra vào ${new Date(t.event_start_at).toLocaleString('vi-VN')}. Vé QR của bạn đã sẵn sàng trong ứng dụng!`,
      });
      localStorage.setItem(reminderKey, 'true');
    }
  });
}
