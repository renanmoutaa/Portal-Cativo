// Configuração de rótulos e cores para status de clientes
// Permite customizar via localStorage (`status.config`) e emitir evento quando alterado

export type StatusAppearance = {
  label: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
};

export type StatusKey = 'online' | 'banido' | 'inativo' | 'idle' | string;

export type StatusConfig = Record<StatusKey, StatusAppearance>;

export const defaultStatusConfig: StatusConfig = {
  online: { label: 'Online', variant: 'default', className: 'bg-green-500' },
  banido: { label: 'Banido', variant: 'destructive', className: 'bg-red-600 text-white' },
  inativo: { label: 'Inativo', variant: 'secondary' },
  idle: { label: 'Inativo', variant: 'secondary' },
};

export function loadStatusConfig(): StatusConfig {
  try {
    const raw = localStorage.getItem('status.config');
    if (!raw) return defaultStatusConfig;
    const parsed = JSON.parse(raw);
    // merge com defaults para garantir chaves principais
    return {
      ...defaultStatusConfig,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    } as StatusConfig;
  } catch {
    return defaultStatusConfig;
  }
}

export function saveStatusConfig(cfg: StatusConfig) {
  try {
    localStorage.setItem('status.config', JSON.stringify(cfg));
    // emite um evento para que componentes possam reagir
    window.dispatchEvent(new CustomEvent('status:config', { detail: cfg }));
  } catch {}
}

export function getAppearanceFor(status?: string | null): StatusAppearance {
  const cfg = loadStatusConfig();
  const key = String(status || 'idle').toLowerCase();
  return cfg[key] || { label: status || '—', variant: 'outline' };
}