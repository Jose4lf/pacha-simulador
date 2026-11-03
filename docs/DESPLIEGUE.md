# 🚀 Guía de despliegue — PACHA Simulador

El proyecto ahora corre sobre **PostgreSQL** (antes SQLite). Esto le abre las
puertas a *todas* las plataformas de despliegue, incluidas las gratuitas tipo
serverless. Solo necesitas configurar **una** variable de entorno:

```
DATABASE_URL=postgresql://usuario:clave@host:puerto/basededatos
```

---

## Opción 1 · Vercel + Neon — gratis, recomendada para empezar ⭐

La más simple para poner el simulador online en minutos sin pagar nada.

1. Crea la base de datos gratis en [neon.tech](https://neon.tech)
   (proyecto nuevo → copia la *Connection string* **POOLED**, termina en
   `-pooler...neon.tech/...?sslmode=require`).
2. Sube el código a GitHub.
3. En [vercel.com](https://vercel.com) → *New Project* → importa el repositorio.
4. En *Environment Variables* agrega:
   - `DATABASE_URL` = la connection string **pooled** de Neon, con este formato:
     ```
     postgresql://usuario:clave@ep-xxxx-pooler.region.aws.neon.tech/pacha?sslmode=require&connection_limit=5&pool_timeout=10
     ```
5. Deploy. Vercel ejecuta `bun run build` (ya incluye `prisma generate`).
6. Aplica las migraciones **una sola vez** desde tu máquina:
   ```bash
   DATABASE_URL="postgres://...neon..." bun run db:deploy
   ```
7. Abre la URL de Vercel → entra con el Administrador (`Admin` / `321`)
   **y cámbiale la clave desde el panel**.

> ⚠️ **Si los usuarios reportan que la app «se cuelga»** revisa estas 3 causas:
> 1. **Falta el pooler**: en Vercel cada función serverless abre sus propias
>    conexiones; conectarte directo a Neon las agota y las peticiones quedan
>    esperando. Solución: usa SIEMPRE la URL con `-pooler` (puerto 6543) y
>    `connection_limit=5&pool_timeout=10`, y luego haz *Redeploy*.
> 2. **Neon dormido**: la capa gratuita apaga la BD tras ~5 min sin uso; la
>    primera conexión de cada clase tarda 1-2 s en despertarla (no es un cuelgue).
> 3. **Deploy desactualizado**: si hiciste cambios en tu máquina, súbelos a
>    GitHub (`git push`) y espera el redeploy en Vercel antes de probar.
>
> Para uso intensivo diario considera Railway o un VPS.

## Opción 2 · Railway — cero fricción, ~5 USD/mes

1. [railway.app](https://railway.app) → *New Project* → *Deploy from GitHub*.
2. En el mismo proyecto: *New* → *Database* → **PostgreSQL**.
3. En el servicio web → *Variables* → agrega `DATABASE_URL`
   (Railway te deja referenciar la de la base con `${{Postgres.DATABASE_URL}}`).
4. Railway detecta Bun y Next.js. Comando de arranque: `bun run build` + `bun start`.
5. *Settings* → *Generate Domain* → listo, con HTTPS.

## Opción 3 · Render — similar a Railway

1. [render.com](https://render.com) → *New* → *Web Service* → conecta GitHub.
2. Build: `bun install && bun run build` · Start: `bun start` (aplica migraciones solo).
3. Crea además *New* → *PostgreSQL* y pega su *Internal Database URL* en `DATABASE_URL`.
4. El plan gratuito de web service duerme por inactividad; el disco PostgreSQL gratuito caduca a 90 días (luego 6 USD/mes).

## Opción 4 · Docker (cualquier VPS: Hetzner, DigitalOcean, Vultr…) — ~4-6 USD/mes

```bash
# En el VPS (con Docker instalado):
git clone <tu-repo> && cd pacha-simulador
docker build -t pacha .

# PostgreSQL (puede ser otro contenedor o gestionado):
docker run -d --name pacha-db \
  -e POSTGRES_USER=pacha -e POSTGRES_PASSWORD=pacha -e POSTGRES_DB=pacha \
  -v pacha-pgdata:/var/lib/postgresql/data --restart unless-stopped postgres:16

# Aplicación:
docker run -d --name pacha-app -p 3000:3000 \
  -e DATABASE_URL="postgresql://pacha:pacha@pacha-db:5432/pacha" \
  --link pacha-db --restart unless-stopped pacha
```

Con Caddy delante tienes HTTPS automático (hay un `Caddyfile` de referencia en el repo):

```
tu-dominio.com {
  reverse_proxy pacha-app:3000
}
```

## Opción 5 · VPS sin Docker (Node/Bun + Caddy)

```bash
curl -fsSL https://bun.sh/install | bash   # o usa Node: las dos valen
git clone <tu-repo> && cd pacha-simulador
bun install
nano .env        # DATABASE_URL=postgresql://pacha:pacha@localhost:5432/pacha
bunx prisma migrate deploy
bun run build
bun run start    # aplica migraciones y arranca en :3000
```

Para mantenerlo vivo tras cerrar sesión: `pm2 start "bun run start" --name pacha`
o un servicio systemd.

---

## Desarrollo local (sin Docker, sin root)

El repositorio incluye **PostgreSQL embebido** (binarios locales, puerto 5433):

```bash
bun install
bun run db          # arranca PostgreSQL embebido (dejar corriendo)
bun run db:migrate  # primera vez: crea tablas
bun run dev         # http://localhost:3000
```

La primera vez que alguien entre, el sistema se auto-inicializa con la única
cuenta del Administrador (`Admin` / `321`) y el catálogo de eventos de Bolivia.

## Copias de seguridad

- **Postgres gestionado (Neon/Railway/Render):** activa *backups/PITR* en su panel.
- **Docker/VPS:** `docker exec pacha-db pg_dump -U pacha pacha > respaldo-$(date +%F).sql`
  en un cron diario, y copia el archivo fuera del servidor.

## Migración desde la versión SQLite

El archivo `db/custom.db.respaldo-sqlite` conserva los datos originales.
Para volcarlos a cualquier PostgreSQL nuevo:

```bash
DATABASE_URL="postgresql://..." bun run scripts/migrar-sqlite-a-postgres.ts [ruta/custom.db]
```

## Notas técnicas del cambio

- `prisma/schema.prisma`: `provider = "postgresql"`; migración inicial en
  `prisma/migrations/20261101000450_init/`.
- `src/lib/db.ts`: ya no resuelve archivos SQLite; lee `DATABASE_URL` y falla
  con un mensaje claro si falta.
- `package.json`: `build` incluye `prisma generate`; `start` aplica
  `prisma migrate deploy` antes de arrancar; `postinstall` genera el cliente.
- `serverExternalPackages` en `next.config.ts` se mantiene (Prisma carga sus
  binarios desde `node_modules` en runtime).
