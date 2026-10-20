# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa 1: compilar la web (React + Vite)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS web

WORKDIR /app/frontend

# Se copian primero los manifiestos para que la instalación de dependencias
# quede cacheada: mientras el package.json no cambie, la capa no se rehace.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2: API de Express (y la web compilada)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS app

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3000

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# La web compilada se copia al contenedor para poder servirla desde el mismo
# proceso (un solo servicio, un solo dominio). Si la web se despliega aparte
# en Vercel, estas carpetas simplemente no se usan.
COPY --from=web /app/frontend/dist /app/frontend/dist

EXPOSE 3000

# Las migraciones se aplican en cada arranque. Son idempotentes y se registran
# en la tabla `schema_migrations`, así que volver a ejecutarlas no hace nada.
#
# En el plan gratuito de Render no existe `preDeployCommand`, así que el
# orden más fiable es migrar y luego arrancar en el mismo comando.
CMD ["sh", "-c", "npm run migrate && node src/app.js"]
