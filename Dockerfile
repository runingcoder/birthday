FROM caddy:2.8.4-alpine
COPY index.html /srv/index.html
CMD caddy file-server --root /srv --listen :${PORT:-8080}
