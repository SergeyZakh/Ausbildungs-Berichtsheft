# ---------- Bauen ----------
FROM node:22-alpine AS bau
WORKDIR /bau

# Nur die Laufzeitabhängigkeit: die Word-Bibliothek, die mit ausgeliefert wird.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY build.js ./
COPY src ./src
RUN node build.js

# ---------- Ausliefern ----------
# Läuft als Benutzer nginx (uid 101) statt als root und hört deshalb auf 8080.
FROM nginxinc/nginx-unprivileged:1.31-alpine
LABEL org.opencontainers.image.title="Berichtsheft" \
      org.opencontainers.image.description="Ausbildungsnachweis aus dem Export der Zeiterfassung"

# Als Vorlage, damit OLLAMA_HOST und SERVER_HOST beim Start eingesetzt werden. Der Filter
# ersetzt nur diese beiden, nginx-eigene Variablen wie $uri bleiben unberührt.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER="^(OLLAMA_HOST|SERVER_HOST)$"
ENV OLLAMA_HOST=127.0.0.1:11434
# Leer heißt: kein Berichtsheft-Server, kein Konto. Mit Server (docker-compose.server.yml): "server:8080".
ENV SERVER_HOST=""

# index.html, vendor/docx.js und die Einzeldatei Berichtsheft.html
COPY --from=bau /bau/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
