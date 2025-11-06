import os
import logging
from logging.handlers import RotatingFileHandler
from uuid import uuid4
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
import json
try:
    import redis  # type: ignore
except Exception:
    redis = None
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Tuple

load_dotenv(dotenv_path="../.env")

# ------------------------------
# Logging em arquivo persistente
# ------------------------------
LOG_DIR = "/app/logs"
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except Exception:
    # Se não conseguir criar, continua com stdout
    pass

log_file = os.path.join(LOG_DIR, "fastapi.log")
logger_format = logging.Formatter(
    fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)

file_handler = RotatingFileHandler(log_file, maxBytes=10_000_000, backupCount=5)
file_handler.setFormatter(logger_format)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
if not any(isinstance(h, RotatingFileHandler) for h in root_logger.handlers):
    root_logger.addHandler(file_handler)

# Capturar logs do Uvicorn
for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
    l = logging.getLogger(name)
    l.setLevel(logging.INFO)
    if not any(isinstance(h, RotatingFileHandler) for h in l.handlers):
        l.addHandler(file_handler)

NEST_PORT = int(os.getenv("NEST_PORT", "4002"))
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "4001"))
NEST_HOST = os.getenv("NEST_HOST", "localhost")
NEST_BASE = f"http://{NEST_HOST}:{NEST_PORT}"
FRONT_ORIGIN = os.getenv("FRONT_ORIGIN", "http://localhost:4000")
# Permitir origens locais comuns em desenvolvimento: localhost, 127.0.0.1, faixas privadas 10.x, 192.168.x, 172.16-31.x
FRONT_ORIGIN_REGEX = os.getenv(
    "FRONT_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1|10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3})(:\\d+)?$",
)
RESTART_SECRET = os.getenv("RESTART_SECRET", "dev-restart")

app = FastAPI(title="Portal Cativo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONT_ORIGIN, "http://localhost:5173", "http://127.0.0.1:4000"],
    allow_origin_regex=FRONT_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginPayload(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    acceptTerms: bool
    controllerId: Optional[int] = None
    siteId: Optional[str] = None
    clientMac: Optional[str] = None  # MAC do cliente (id da URL)
    apMac: Optional[str] = None      # MAC do AP (ap da URL)
    ssid: Optional[str] = None       # SSID (ssid da URL)

# ------------------------------
# Banco de Dados (SQLite simples)
# ------------------------------
DB_PATH = "./clients.db"

# Cache simples em memória para acelerar /clients/connected
CACHE_TTL_SECONDS = int(os.getenv("CLIENTS_CACHE_TTL", "5"))
CACHE: Dict[str, Dict[str, Any]] = {}

# Redis opcional para cache
REDIS_HOST = os.getenv("REDIS_HOST", "")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
_redis_client = None
if redis and REDIS_HOST:
    try:
        _redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
        # teste simples
        _redis_client.ping()
        print(f"Redis conectado em {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        print(f"Falha ao conectar ao Redis: {e}")
        _redis_client = None

def _cache_get(key: str):
    try:
        if _redis_client:
            raw = _redis_client.get(key)
            if raw is None:
                return None
            try:
                return json.loads(raw)
            except Exception:
                return raw
        else:
            ent = CACHE.get(key)
            if not ent:
                return None
            exp = ent.get("expires")
            if isinstance(exp, datetime) and exp < datetime.now(timezone.utc):
                CACHE.pop(key, None)
                return None
            return ent.get("value")
    except Exception:
        return None

def _cache_set(key: str, value: Any, ttl: int = CACHE_TTL_SECONDS):
    try:
        if _redis_client:
            try:
                payload = json.dumps(value)
            except Exception:
                payload = str(value)
            _redis_client.setex(key, max(1, ttl), payload)
        else:
            CACHE[key] = {
                "value": value,
                "expires": datetime.now(timezone.utc) + timedelta(seconds=max(1, ttl)),
            }
    except Exception:
        pass

def _cache_invalidate_prefix(prefix: str):
    try:
        if _redis_client:
            # Limpar chaves por prefixo (SCAN para evitar bloqueios)
            try:
                cursor = 0
                pattern = f"{prefix}*"
                while True:
                    cursor, keys = _redis_client.scan(cursor=cursor, match=pattern, count=100)
                    if keys:
                        _redis_client.delete(*keys)
                    if cursor == 0:
                        break
            except Exception:
                pass
        else:
            for k in list(CACHE.keys()):
                if k.startswith(prefix):
                    CACHE.pop(k, None)
    except Exception:
        pass

def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def _db_init():
    conn = _db_connect()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS client_logins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            phone TEXT,
            ssid TEXT,
            client_mac TEXT,
            ap_mac TEXT,
            ip TEXT,
            user_agent TEXT,
            created_at TEXT
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_client_logins_created_at ON client_logins(created_at)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_client_logins_ssid ON client_logins(ssid)")
    # Índice composto para acelerar filtro (ssid, created_at)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_client_logins_ssid_created_at ON client_logins(ssid, created_at)")
    # Índice de MAC para possíveis cruzamentos
    cur.execute("CREATE INDEX IF NOT EXISTS idx_client_logins_client_mac ON client_logins(client_mac)")
    conn.commit()
    conn.close()

def _db_cleanup_older_than(days: int = 15):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    conn = _db_connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM client_logins WHERE created_at < ?", (cutoff,))
    conn.commit()
    conn.close()

@app.on_event("startup")
def on_startup():
    _db_init()
    _db_cleanup_older_than(15)

@app.get("/health")
async def health():
    return {"status": "ok", "nest": NEST_BASE, "fastapi": FASTAPI_PORT}

@app.post("/auth/login")
async def auth_login(payload: LoginPayload, request: Request, x_forwarded_for: Optional[str] = Header(None)):
    if not payload.acceptTerms:
        raise HTTPException(status_code=400, detail="É necessário aceitar os termos de uso.")
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Informe e-mail ou telefone.")

    token = f"session_{uuid4()}"

    # Persistir dados no Nest/DB
    saved = False
    try:
        import requests
        r = requests.post(
            f"{NEST_BASE}/connections",
            json={
                "name": payload.name,
                "email": payload.email,
                "phone": payload.phone,
                "acceptTerms": payload.acceptTerms,
                "token": token,
            },
            timeout=2.0,
        )
        try:
            data = r.json()
        except Exception:
            data = {}
        saved = bool(r.ok) and ("error" not in data)
    except Exception:
        saved = False

    # Autorizar cliente na controladora UniFi
    authorized = False
    try:
        import requests
        ctrl_id = payload.controllerId or 1
        site_id = payload.siteId
        
        # Log para debug
        print(f"Payload recebido: {payload}")
        
        if not site_id:
            # Buscar siteId da config da controladora
            r_cfg = requests.get(f"{NEST_BASE}/controllers/{ctrl_id}/portal-config", timeout=2.0)
            cfg_json = {}
            try:
                cfg_json = r_cfg.json()
                print(f"Config da controladora: {cfg_json}")
            except Exception as e:
                print(f"Erro ao obter config da controladora: {str(e)}")
                cfg_json = {}
            site_id = (cfg_json.get("config") or {}).get("siteId")
            print(f"Site ID obtido: {site_id}")

        # Fallback seguro: se ainda não houver siteId, usar 'default' (comum no UniFi)
        if not site_id:
            site_id = "default"
            print("Fallback de siteId aplicado: 'default'")

        # Determina IP do cliente (via proxy ou conexão)
        client_ip = None
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        elif getattr(request, "client", None):
            client_ip = request.client.host

        # Preparar payload para autorização
        auth_payload = {"siteId": site_id}
        
        # Usar MAC do cliente se disponível, senão usar IP
        if payload.clientMac:
            auth_payload["mac"] = payload.clientMac
            print(f"Usando MAC do cliente: {payload.clientMac}")
        elif client_ip:
            auth_payload["ip"] = client_ip
            print(f"Usando IP do cliente: {client_ip}")
            
        # Adicionar informações adicionais se disponíveis
        if payload.apMac:
            auth_payload["apMac"] = payload.apMac
            print(f"AP MAC: {payload.apMac}")
        if payload.ssid:
            auth_payload["ssid"] = payload.ssid
            print(f"SSID: {payload.ssid}")

        print(f"Payload de autorização: {auth_payload}")

        if site_id and (payload.clientMac or client_ip):
            print(f"Enviando requisição de autorização para controladora {ctrl_id}")
            r_auth = requests.post(
                f"http://localhost:{NEST_PORT}/controllers/{ctrl_id}/authorize",
                json=auth_payload,
                timeout=2.5,
            )
            try:
                ajson = r_auth.json()
                print(f"Resposta da autorização: {ajson}")
            except Exception as e:
                print(f"Erro ao processar resposta da autorização: {str(e)}")
                ajson = {}
            authorized = bool(r_auth.ok) and ("error" not in ajson)
            print(f"Autorização bem-sucedida: {authorized}")
    except Exception as e:
        print(f"Erro durante o processo de autorização: {str(e)}")
        authorized = False

    # Salvar dados do login localmente (SQLite) para "Clientes Conectados"
    try:
        ua = request.headers.get("user-agent", "")
        ip_addr = None
        if x_forwarded_for:
            ip_addr = x_forwarded_for.split(",")[0].strip()
        elif getattr(request, "client", None):
            ip_addr = request.client.host

        conn = _db_connect()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO client_logins(name, email, phone, ssid, client_mac, ap_mac, ip, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.name or None,
                payload.email or None,
                payload.phone or None,
                payload.ssid or None,
                payload.clientMac or None,
                payload.apMac or None,
                ip_addr or None,
                ua or None,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        conn.close()
        _db_cleanup_older_than(15)
        # Invalida cache de clientes para o SSID impactado
        try:
            ssid_key = str(payload.ssid or "")
            _cache_invalidate_prefix(f"clients_connected:{ssid_key}:")
        except Exception:
            pass
    except Exception as e:
        # Não bloquear sucesso do login em caso de erro de persistência local
        print(f"[warn] Falha ao registrar login local: {e}")

    return {"success": True, "token": token, "saved": saved, "authorized": authorized}


def _parse_device_from_ua(ua: str) -> str:
    try:
        if not ua:
            return "Desconhecido"
        u = ua.lower()
        if "iphone" in u:
            return "iPhone"
        if "ipad" in u:
            return "iPad"
        if "android" in u:
            return "Android"
        if "windows" in u:
            return "Windows"
        if "macintosh" in u or "mac os" in u:
            return "Mac"
        if "linux" in u:
            return "Linux"
        return ua.split(" ")[0][:32] or "Desconhecido"
    except Exception:
        return "Desconhecido"

def _is_test_user(name: Optional[str], email: Optional[str], phone: Optional[str]) -> bool:
    try:
        def norm(v: Optional[str]) -> str:
            return str(v or "").strip().lower()
        n = norm(name)
        e = norm(email)
        p = norm(phone)
        # Palavras-chave comuns para usuários de teste
        test_keywords = ["test", "teste", "demo", "exemplo", "dummy", "fake"]
        if any(k in n for k in test_keywords):
            return True
        if any(k in e for k in (test_keywords + ["example.com", "mailinator", "tempmail"])):
            return True
        # Telefones placeholder ou óbvios de teste
        if p and (p in {"0000000000", "00000000", "123456", "999999999", "1111111111"} or p.startswith("test") or p.startswith("teste")):
            return True
        return False
    except Exception:
        return False

@app.get("/clients/connected")
async def clients_connected(
    ssid: Optional[str] = None,
    controllerId: Optional[int] = None,
    siteId: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retorna logins dos últimos 15 dias, com campos prontos para a UI.
    Pode filtrar por SSID (ex: ssid="WIFI FREE").
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
    # Cache: chave inclui filtros para respostas determinísticas
    cache_key = f"clients_connected:{str(ssid or '')}:{str(controllerId or '')}:{str(siteId or '')}"
    hit = _cache_get(cache_key)
    if isinstance(hit, dict) and "clients" in hit:
        return hit
    conn = _db_connect()
    cur = conn.cursor()
    if ssid:
        cur.execute(
            "SELECT * FROM client_logins WHERE created_at >= ? AND ssid = ? ORDER BY created_at DESC",
            (cutoff, ssid),
        )
    else:
        cur.execute(
            "SELECT * FROM client_logins WHERE created_at >= ? ORDER BY created_at DESC",
            (cutoff,),
        )
    rows = cur.fetchall()
    conn.close()

    now = datetime.now(timezone.utc)
    items: List[Dict[str, Any]] = []
    for r in rows:
        created_at = datetime.fromisoformat(r["created_at"]) if r["created_at"] else now
        secs = max(0, int((now - created_at).total_seconds()))
        # Heurística simples para status: online nas últimas 2 horas
        status = "online" if secs <= 2 * 3600 else "idle"
        items.append(
            {
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "phone": r["phone"],
                "ssid": r["ssid"],
                "device": _parse_device_from_ua(r["user_agent"] or ""),
                "ip": r["ip"],
                "mac": r["client_mac"],
                "apMac": r["ap_mac"],
                "connectedSeconds": secs,
                "bandwidthBytes": 0,
                "createdAt": r["created_at"],
                "status": status,
                "location": None,
            }
        )

    # Remover usuários de teste (heurística)
    items = [it for it in items if not _is_test_user(it.get("name"), it.get("email"), it.get("phone"))]

    # Se controllerId e siteId foram fornecidos, enriquecer com dados da controladora (IP real, bytes, AP/SSID)
    if controllerId and siteId:
        try:
            import requests
            r_clients = requests.get(
                f"http://localhost:{NEST_PORT}/controllers/{int(controllerId)}/clients",
                params={"siteId": siteId},
                timeout=2.5,
            )
            clients_json = {}
            try:
                clients_json = r_clients.json()
            except Exception:
                clients_json = {}
            raw_clients = clients_json.get("clients") or []
            mac_map: Dict[str, Dict[str, Any]] = {}
            for c in raw_clients:
                m = (c.get("mac") or c.get("macAddress") or "").lower()
                if not m:
                    continue
                mac_map[m] = {
                    "ip": c.get("ip") or c.get("ipAddress") or c.get("lastIp"),
                    "apMac": c.get("apMac") or c.get("ap_mac") or c.get("ap_macaddr"),
                    "ssid": c.get("ssid") or c.get("essid") or c.get("wlan"),
                    "bytes": (c.get("bytes") or 0),
                    "rxBytes": (c.get("rxBytes") or c.get("rx_bytes") or 0),
                    "txBytes": (c.get("txBytes") or c.get("tx_bytes") or 0),
                }

            def _is_local_ip(ip: Any) -> bool:
                s = str(ip or "").strip()
                return s in ("127.0.0.1", "::1", "localhost", "0.0.0.0")

            for it in items:
                mac = (it.get("mac") or "").lower()
                hit = mac_map.get(mac)
                if not hit:
                    continue
                # Corrige IP se for local/placeholder
                if (not it.get("ip")) or _is_local_ip(it.get("ip")):
                    it["ip"] = hit.get("ip") or it.get("ip")
                # Completa AP/SSID
                if (not it.get("apMac")) and hit.get("apMac"):
                    it["apMac"] = hit.get("apMac")
                if (not it.get("ssid")) and hit.get("ssid"):
                    it["ssid"] = hit.get("ssid")
                # Preenche banda usada (soma rx/tx quando possível)
                rx = hit.get("rxBytes") or 0
                tx = hit.get("txBytes") or 0
                total_b = (rx or 0) + (tx or 0)
                if total_b and total_b > 0:
                    it["bandwidthBytes"] = int(total_b)
                elif hit.get("bytes"):
                    try:
                        it["bandwidthBytes"] = int(hit.get("bytes") or 0)
                    except Exception:
                        pass
        except Exception:
            # Se falhar, segue apenas com dados locais
            pass

    # Se controllerId e siteId foram fornecidos, resolver nomes dos APs para "location"
    if controllerId and siteId:
        try:
            import requests
            r_aps = requests.get(
                f"{NEST_BASE}/controllers/{int(controllerId)}/aps",
                params={"siteId": siteId},
                timeout=2.5,
            )
            aps_json = {}
            try:
                aps_json = r_aps.json()
            except Exception:
                aps_json = {}
            ap_list = aps_json.get("devices") or []
            mac_to_name = {}
            for ap in ap_list:
                mac = (ap.get("mac") or ap.get("id") or "").lower()
                nm = ap.get("name") or ap.get("hostname") or ap.get("model") or None
                if mac:
                    mac_to_name[mac] = nm
            # Preencher localização dos clientes
            for it in items:
                mac = (it.get("apMac") or "").lower()
                if mac:
                    name = mac_to_name.get(mac)
                    if name:
                        it["location"] = name
                    else:
                        it["location"] = f"AP {it.get('apMac')}"
        except Exception:
            # Em caso de falha, manter location como None
            pass

    # Grava em cache por alguns segundos para acelerar navegação/lista
    result = {"clients": items}
    _cache_set(cache_key, result)
    return result

@app.post("/admin/restart")
async def admin_restart(x_admin_secret: Optional[str] = Header(None)):
    if (x_admin_secret or "") != RESTART_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    import threading, time
    def _kill():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=_kill, daemon=True).start()
    return {"status": "restarting"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=FASTAPI_PORT, reload=True)