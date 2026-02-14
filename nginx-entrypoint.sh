#!/bin/sh
# Entrypoint script para Nginx - levanta puerto 80 siempre, puerto 443 si hay certificado

set -e

# Función para checar si el certificado existe
has_certificate() {
    [ -f "/etc/letsencrypt/live/yim.servegame.com/fullchain.pem" ] && \
    [ -f "/etc/letsencrypt/live/yim.servegame.com/privkey.pem" ]
}

# Generar nginx.conf dinámico según si existe certificado o no
generate_nginx_config() {
    if has_certificate; then
        echo "📜 Certificado encontrado - Levantando con HTTPS..."
        cp /nginx-full.conf /etc/nginx/nginx.conf
    else
        echo "⚠️  Certificado no encontrado - Levantando solo con HTTP..."
        cp /nginx-http-only.conf /etc/nginx/nginx.conf
    fi
}

# Generar config inicial
generate_nginx_config

# Iniciar Nginx
echo "🚀 Iniciando Nginx..."
exec nginx -g "daemon off;"
