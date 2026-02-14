# Alternativas a Certbot HTTP Challenge (Puerto 80)

## 🚨 Problema
El router usa el puerto 80 para su interfaz de administración, bloqueando el port forwarding.

---

## ✅ Solución 1: Cambiar Puerto del Router (MÁS FÁCIL)

1. Entra a tu router: http://192.168.0.1/2.0/gui/#/login/
2. Busca la configuración:
   - **"Puerto de administración HTTP"**
   - **"Web Management Port"**
   - **"HTTP Server Port"**
3. Cámbialo de `80` a `8080`
4. Guarda y reinicia el router
5. Ahora accede por: `http://192.168.0.1:8080/2.0/gui/#/login/`

✅ El puerto 80 quedará libre para Certbot

---

## ✅ Solución 2: Usar Cloudflare Tunnel (SIN PORT FORWARDING)

Esta es la solución moderna - **NO necesitas abrir puertos** en el router.

### Ventajas:
- ✅ No requiere port forwarding
- ✅ No expones tu IP pública
- ✅ Protección DDoS gratis
- ✅ SSL automático de Cloudflare

### Pasos:

#### 1. Crear cuenta en Cloudflare (gratis)
- Ve a https://cloudflare.com
- Crea cuenta gratuita

#### 2. Transferir dominio a Cloudflare DNS
- Agrega tu dominio `servegame.com`
- Cambia los nameservers en No-IP/servegame a los de Cloudflare
- Crea registro A: `yim.servegame.com` → `192.168.0.4` (proxy desactivado inicialmente)

#### 3. Instalar Cloudflare Tunnel

Agrega esto a tu `docker-compose.yml`:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: yim-gaming-cloudflared
    restart: always
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - app_network
```

#### 4. Obtener token del tunnel
- En Cloudflare: **Zero Trust** → **Access** → **Tunnels**
- Crea nuevo tunnel
- Copia el token
- Agrégalo a `.env`:
```bash
CLOUDFLARE_TUNNEL_TOKEN=tu_token_aqui
```

#### 5. Configurar tunnel
- Hostname: `yim.servegame.com`
- Service: `http://nginx:80`

✅ Tu sitio estará accesible desde Internet sin abrir puertos

---

## ✅ Solución 3: Usar solo puerto 443 (HTTPS)

Si puedes vivir solo con HTTPS (sin HTTP):

1. Cierra el port forwarding del puerto 80
2. Mantén solo puerto 443
3. Obtén certificados manualmente una vez
4. Configura renovación automática vía DNS

### Obtener certificado manual (primera vez):

```bash
# Detener Docker
docker-compose down

# Instalar Certbot local
winget install Certbot.Certbot

# Generar certificado (seguir instrucciones en pantalla)
certbot certonly --manual --preferred-challenges dns -d yim.servegame.com

# Copiar certificados a tu proyecto
cp -r C:\Certbot\live\yim.servegame.com\* g:\Code\yim.servegame.com\letsencrypt\live\yim.servegame.com\

# Reiniciar Docker
docker-compose up -d
```

**Desventaja:** Renovación manual cada 90 días

---

## 📊 Comparación de Soluciones

| Solución | Dificultad | Port 80 | Renovación | Recomendado |
|----------|------------|---------|------------|-------------|
| Cambiar puerto router | ⭐ Fácil | ✅ Requiere | ✅ Automática | ✅ SÍ |
| Cloudflare Tunnel | ⭐⭐ Media | ❌ No requiere | ✅ Automática | ✅ SÍ |
| Solo HTTPS (443) | ⭐⭐ Media | ❌ No requiere | ❌ Manual | ⚠️ Temporal |
| DNS Challenge | ⭐⭐⭐ Difícil | ❌ No requiere | ✅ Automática | ⚠️ Complejo |

---

## 🎯 Recomendación

**SI puedes cambiar el puerto del router:**
→ **Cambiar a puerto 8080** (5 minutos)

**SI NO puedes cambiar el puerto:**
→ **Usar Cloudflare Tunnel** (30 minutos, pero vale la pena)

¿Cuál prefieres probar primero?
