# Instrucciones: Docker Compose con Certbot + Let's Encrypt

## 🎯 ¿Por qué esta opción?

- ✅ **SSL Gratis** - Let's Encrypt (renovación automática)
- ✅ **Sin Cloudflare** - Control total
- ✅ **Funciona con No-IP** - Solo necesitas abrir puertos 80/443
- ✅ **Automatizado** - Certbot renueva automáticamente
- ✅ **Docker** - Fácil de deployar
- ✅ **$0.00** - Completamente gratis

---

## 📋 Requisitos Previos

1. **Puertos 80 y 443 abiertos** en el router (Port Forwarding)
2. **En No-IP**: El dominio apunta a tu IP pública (ya está hecho)
3. **Docker y Docker Compose** instalados
4. **Email válido** para Let's Encrypt (para notificaciones)

---

## 🚀 Pasos de Instalación

### Paso 1: Preparar carpetas
```powershell
# Crear las carpetas necesarias
New-Item -ItemType Directory -Force -Path certs
New-Item -ItemType Directory -Force -Path letsencrypt
New-Item -ItemType Directory -Force -Path acme-challenge
```

### Paso 2: Editar email en docker-compose.certbot.yml
```yaml
# Busca esta línea en docker-compose.certbot.yml
--email tu-email@example.com

# Reemplaza con tu email real (para notificaciones de renovación)
--email tunombre@gmail.com
```

### Paso 3: Verificar puertos abiertos
```powershell
# Prueba que el puerto 80 está accesible desde internet
# (Puedes usar http://canyouseeme.org/ desde otra máquina)

# En el router:
# 1. Port Forwarding → Puerto 80 → Tu IP local:80
# 2. Port Forwarding → Puerto 443 → Tu IP local:443
```

### Paso 4: Ejecutar Docker Compose
```powershell
# Levanta todos los servicios
docker-compose -f docker-compose.certbot.yml up -d

# Ver los logs de Certbot (esperan que termine)
docker-compose -f docker-compose.certbot.yml logs -f certbot

# Ver estado del nginx
docker-compose -f docker-compose.certbot.yml logs -f nginx
```

### Paso 5: Acceder al sitio
```
https://yim.servegame.com
```

**¡Deberías ver el candado verde 🔒!**

---

## 🔄 Renovación Automática

Certbot se ejecuta automáticamente:
- **Cada 12 horas** verifica si hay certificados para renovar
- **Cuando faltan 30 días** para expirar, se renueva
- **Nginx recarga automáticamente** los certificados nuevos

**No tienes que hacer nada manual.**

---

## 🆘 Troubleshooting

### Error: "Port 80 already in use"
```powershell
# Encontrar qué proceso usa el puerto 80
netstat -ano | findstr :80

# Terminar el proceso (si es necesario)
taskkill /PID <PID> /F
```

### Error: "Cannot validate yim.servegame.com"
- Verifica que el puerto 80 sea accesible desde internet
- Confirma que No-IP apunta a tu IP pública
- Espera unos minutos a que se propague el DNS

### Error: "Certificate file not found"
- Certbot necesita un tiempo para generar el certificado
- Espera a ver "Successfully renewed" en los logs
- Reinicia Nginx: `docker-compose restart nginx`

### Ver certificado
```powershell
# Listar certificados
docker exec yim-gaming-certbot certbot certificates

# Forzar renovación (para pruebas)
docker exec yim-gaming-certbot certbot renew --force-renewal
```

---

## 📊 Estructura de archivos

```
proyecto/
├── docker-compose.certbot.yml    ← Este archivo
├── nginx.conf                     ← Configuración de Nginx
├── app/
├── certs/                         ← Certificados (generado por Certbot)
├── letsencrypt/                   ← Metadata (generado por Certbot)
└── acme-challenge/                ← Para validación (generado por Certbot)
```

---

## 🎯 Comandos Útiles

```powershell
# Ver estado de los servicios
docker-compose -f docker-compose.certbot.yml ps

# Ver logs de certbot
docker-compose -f docker-compose.certbot.yml logs certbot

# Ver logs de nginx
docker-compose -f docker-compose.certbot.yml logs nginx

# Reiniciar Nginx
docker-compose -f docker-compose.certbot.yml restart nginx

# Detener todo
docker-compose -f docker-compose.certbot.yml down

# Limpiar volúmenes (CUIDADO: borra datos)
docker-compose -f docker-compose.certbot.yml down -v
```

---

## ✅ Verificación Final

1. Accede a `https://yim.servegame.com`
2. Verifica el certificado (haz clic en el candado 🔒)
3. Debe decir "Let's Encrypt" como emisor
4. Válido por 90 días desde la fecha de emisión

---

## 💰 Costos
**$0.00** - Completamente gratis ✅

- Let's Encrypt: Gratis
- Docker: Gratis
- Nginx: Gratis

---

## 📚 Referencias
- [Let's Encrypt](https://letsencrypt.org/)
- [Certbot Documentation](https://certbot.eff.org/)
- [Nginx Documentation](https://nginx.org/)
