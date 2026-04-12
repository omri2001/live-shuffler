# ── base ──────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# ── dev ───────────────────────────────────────────────
FROM base AS dev

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── prod-build ────────────────────────────────────────
FROM base AS prod-build

RUN npm run build

# ── prod ──────────────────────────────────────────────
FROM nginx:alpine AS prod

COPY --from=prod-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
