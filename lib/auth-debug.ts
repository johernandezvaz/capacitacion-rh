type LogEntry = {
    ts: string;
    tag: string;
    message: string;
    data?: any;
};

const ENABLED = typeof window !== 'undefined';
const MAX_HISTORY = 200;
const history: LogEntry[] = [];

const fmtTime = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
};

const colors: Record<string, string> = {
    auth: '#7c3aed',
    fetch: '#0891b2',
    storage: '#ca8a04',
    visibility: '#16a34a',
    warn: '#dc2626',
    info: '#475569',
};

export const authLog = (tag: keyof typeof colors, message: string, data?: any) => {
    if (!ENABLED) return;
    const ts = fmtTime();
    const entry: LogEntry = { ts, tag, message, data };
    history.push(entry);
    if (history.length > MAX_HISTORY) history.shift();
    const color = colors[tag] ?? '#475569';
    if (data !== undefined) {
        // eslint-disable-next-line no-console
        console.log(`%c[${tag}]%c ${ts} ${message}`, `color:${color};font-weight:bold`, 'color:inherit', data);
    } else {
        // eslint-disable-next-line no-console
        console.log(`%c[${tag}]%c ${ts} ${message}`, `color:${color};font-weight:bold`, 'color:inherit');
    }
};

export const summarizeSession = (session: any) => {
    if (!session) return null;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const remainingMs = expiresAt - now;
    return {
        user_id: session.user?.id,
        email: session.user?.email,
        access_token_tail: session.access_token ? '...' + session.access_token.slice(-12) : null,
        refresh_token_tail: session.refresh_token ? '...' + session.refresh_token.slice(-12) : null,
        expires_at_iso: expiresAt ? new Date(expiresAt).toISOString() : null,
        expires_in_seconds: Math.round(remainingMs / 1000),
        expired: remainingMs < 0,
    };
};

export const dumpLocalStorageAuth = () => {
    if (typeof window === 'undefined') return {};
    const out: Record<string, any> = {};
    try {
        Object.keys(window.localStorage)
            .filter(k => k.startsWith('sb-'))
            .forEach(k => {
                const v = window.localStorage.getItem(k);
                try {
                    const parsed = JSON.parse(v ?? '');
                    out[k] = {
                        present: true,
                        preview: parsed?.access_token ? '...' + parsed.access_token.slice(-12) : '(no access_token)',
                        expires_at: parsed?.expires_at ? new Date(parsed.expires_at * 1000).toISOString() : null,
                    };
                } catch {
                    out[k] = { present: true, preview: '(unparseable)' };
                }
            });
    } catch (e) {
        out._error = String(e);
    }
    return out;
};

if (typeof window !== 'undefined') {
    (window as any).__authDebug = {
        history: () => history.slice(),
        print: () => {
            // eslint-disable-next-line no-console
            console.table(history.map(h => ({ time: h.ts, tag: h.tag, message: h.message })));
        },
        storage: dumpLocalStorageAuth,
        clear: () => { history.length = 0; },
    };
}
