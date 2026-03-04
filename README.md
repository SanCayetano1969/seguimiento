# CD San Cayetano — Cantera App

Sistema de seguimiento de jugadores de cantera. App web con base de datos en la nube.

---

## ⚡ Guía de instalación (20 minutos)

### PASO 1 — Crear la base de datos en Supabase (gratis)

1. Ve a **https://supabase.com** → "Start your project" → crea cuenta con Google
2. "New project" → nombre: `sancayetano` → elige una región europea → crea
3. Espera ~2 minutos a que el proyecto arranque
4. Ve a **SQL Editor** (icono de código en la barra lateral)
5. Copia y pega TODO el contenido del archivo `supabase-schema.sql` → "Run"
6. Ve a **Settings > API** y copia:
   - `Project URL` → la necesitarás en el paso 3
   - `anon public key` → la necesitarás en el paso 3
   - `service_role key` → la necesitarás en el paso 3

### PASO 2 — Publicar la app en Vercel (gratis)

1. Sube esta carpeta a GitHub:
   - Ve a **https://github.com** → crea cuenta si no tienes
   - "New repository" → nombre: `cantera-sancayetano` → público → "Create"
   - Sube los archivos (arrastra la carpeta al repositorio en el navegador)

2. Ve a **https://vercel.com** → "Sign up with GitHub"
3. "Add New Project" → selecciona el repo `cantera-sancayetano`
4. En "Environment Variables" añade estas tres variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL        = https://TU-ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGc... (anon key)
   SUPABASE_SERVICE_ROLE_KEY       = eyJhbGc... (service role key)
   NEXT_PUBLIC_ADMIN_CODE          = sancayetano2526
   ```
5. "Deploy" → espera ~3 minutos → ¡tu app estará en `https://cantera-sancayetano.vercel.app`!

### PASO 3 — Añadir tus equipos reales

En Supabase > SQL Editor, ejecuta esto para cada equipo:

```sql
INSERT INTO teams (name, category, coach_name, access_code) VALUES
  ('Infantil B', 'Infantil', 'Nombre del entrenador', 'codigosecreto123'),
  ('Cadete A',   'Cadete',   'Nombre del entrenador', 'otroCodigo456');
```

**El `access_code` es lo que cada entrenador usará para entrar.** Elígelo tú.

---

## 🔑 Accesos

| Quién | Cómo entrar | Qué ve |
|-------|-------------|--------|
| Entrenador | Código de su equipo (ej: `infantilb2526`) | Solo su equipo |
| Coordinador | `sancayetano2526` (o el que configures) | Dashboard de todo el club |

---

## 📱 Flujo de trabajo semanal

1. **El entrenador** entra a la app desde su móvil u ordenador
2. Pulsa "Nueva Jornada" tras el partido/entrenamiento
3. Rellena las notas del 1 al 10 para cada jugador
4. Guarda → los datos quedan en la nube inmediatamente
5. **El coordinador** entra con su código y ve el dashboard actualizado de todos los equipos

---

## 🔧 Personalización

- Para cambiar el código del coordinador: modifica `NEXT_PUBLIC_ADMIN_CODE` en Vercel
- Para añadir más equipos: usa el SQL de arriba
- Para cambiar el nombre del club: busca "San Cayetano" en los archivos .tsx

---

## 📁 Estructura del proyecto

```
cantera-app/
├── src/app/
│   ├── page.tsx          ← Pantalla de login
│   ├── equipo/page.tsx   ← Panel del entrenador
│   ├── club/page.tsx     ← Dashboard del coordinador
│   └── globals.css       ← Estilos globales
├── src/lib/
│   └── supabase.ts       ← Conexión a la base de datos
├── supabase-schema.sql   ← Ejecutar en Supabase una vez
└── .env.example          ← Plantilla de variables de entorno
```
