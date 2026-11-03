export const isGuestMode = import.meta.env.VITE_APP_ROLE === 'guest';
export const isTenantMode = import.meta.env.VITE_APP_ROLE === 'tenant';
export const isAdminMode = import.meta.env.VITE_APP_ROLE === 'admin';
