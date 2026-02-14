# Configuración de Port Forwarding en Router

## 🎯 Puertos que debes abrir:

⚠️ **IMPORTANTE:** Usamos puertos internos diferentes (8080/8443) para evitar conflicto con la interfaz web del router que usa el puerto 80.

| Servicio | Puerto Externo | Puerto Interno | IP Interna | Protocolo |
|----------|----------------|----------------|------------|-----------|
| HTTP     | 80             | 8080           | 192.168.0.4 | TCP      |
| HTTPS    | 443            | 8443           | 192.168.0.4 | TCP      |

## 📋 Pasos para configurar en tu router:

### 1. Acceder al router
- Abre un navegador web
- Ve a: **192.168.0.1** o **192.168.1.1** (depende de tu router)
- Usuario/contraseña: generalmente `admin/admin` o está en la etiqueta del router

### 2. Buscar la sección de Port Forwarding
Dependiendo de tu router, puede llamarse:
- **Port Forwarding**
- **NAT / Redirección de Puertos**
- **Virtual Server**
- **Aplicaciones y Juegos**

### 3. Crear reglas (2 reglas necesarias):

**Regla 1 - HTTP:**
- Nombre: `HTTP-Certbot`
- Puerto Externo: `80`
- Puerto Interno: `8080`  ⚠️ IMPORTANTE: Usar 8080 (no 80)
- IP Interna: `192.168.0.4`
- Protocolo: `TCP`

**Regla 2 - HTTPS:**
- Nombre: `HTTPS-Web`
- Puerto Externo: `443`
- Puerto Interno: `8443`  ⚠️ IMPORTANTE: Usar 8443 (no 443)
- IP Interna: `192.168.0.4`
- Protocolo: `TCP`

### 4. Guardar y reiniciar router si es necesario

## ✅ Verificar que funciona:

Desde un dispositivo **fuera de tu red** (celular con datos móviles sin WiFi):
```bash
# Probar HTTP
curl http://yim.servegame.com/.well-known/acme-challenge/test

# Probar HTTPS
curl https://yim.servegame.com
```

O usa esta web: https://www.yougetsignal.com/tools/open-ports/
- Puerto: 80
- Host: yim.servegame.com

## ⚠️ Advertencias:

1. **No-IP/DynDNS**: Si usas No-IP, asegúrate que el servicio esté actualizado con tu IP pública actual
2. **IP Estática local**: Considera configurar IP estática para 192.168.0.4 en DHCP del router
3. **Firewall de Windows**: También debes permitir los puertos en Windows Firewall

## 🔥 Configurar Windows Firewall:

```powershell
# Como Administrador en PowerShell:
New-NetFirewallRule -DisplayName "Docker HTTP Port 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Docker HTTPS Port 8443" -Direction Inbound -LocalPort 8443 -Protocol TCP -Action Allow
```
