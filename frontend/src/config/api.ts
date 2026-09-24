export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.protocol === 'https:' ? 'https://' : 'http://') + window.location.host;

export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;