FROM caddy:2.8.4-alpine
COPY index.html routes.js /srv/
COPY photos /srv/photos
CMD caddy file-server --root /srv --listen :${PORT:-8080}
