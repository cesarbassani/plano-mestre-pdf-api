# ============================================================
# Plano Mestre PDF API — Dockerfile
# ============================================================
# Imagem oficial Microsoft/Playwright já inclui Chromium
# e todas as dependências de sistema necessárias.
# ============================================================

FROM mcr.microsoft.com/playwright:v1.50.0-noble

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependência primeiro (cache de camadas Docker)
COPY package.json package-lock.json* ./

# Instalar apenas dependências de produção
RUN npm ci --omit=dev

# Copiar código-fonte
COPY tsconfig.json ./
COPY src/ ./src/

# Compilar TypeScript
RUN npx tsc

# Remover src e devDependencies (imagem menor)
RUN rm -rf src/ tsconfig.json

# Porta do servidor
EXPOSE 3000

# Health check interno do Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Iniciar servidor
CMD ["node", "dist/server.js"]
