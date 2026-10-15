# SSO con Azure Entra ID — configuración y pruebas

La app usa OIDC (authorization code + PKCE) vía `openid-client`. El SSO **solo cambia cómo se crea la sesión**: usuarios, membresías de war rooms, chat, archivos y auditoría no saben de dónde vino el login.

## Cómo se vinculan los usuarios

Al completar un login de Entra:

1. Se busca el usuario por `entra_oid` (logins repetidos).
2. Si no existe, se busca por **email** — así las cuentas creadas antes del SSO (login local) se vinculan solas y conservan todo su historial.
3. Si tampoco existe: se crea una cuenta normal (no admin), salvo que `ENTRA_AUTO_PROVISION=false`, en cuyo caso el login se rechaza con "ask an administrator".

Los flags `is_admin`/`is_active` se administran siempre desde `/admin/users` — Entra no los toca.

## Registro de la app en el tenant (producción)

1. Azure Portal → Entra ID → **App registrations** → *New registration*.
2. Supported account types: *Single tenant*.
3. **Redirect URI** (tipo *Web*): `https://<host>/api/auth/sso/callback` (agrega también la de dev si aplica: `http://localhost:5173/api/auth/sso/callback`).
4. *Certificates & secrets* → nuevo **client secret** (anota el valor, no el id).
5. *Token configuration* → *Add optional claim* → tipo **ID** → marca **email** (y acepta el permiso `email` que sugiere el portal).
6. Copia al `.env`: `ENTRA_TENANT_ID` (Directory ID), `ENTRA_CLIENT_ID` (Application ID), `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`.

Con las cuatro variables presentes, la página de login muestra "Sign in with Microsoft" automáticamente (endpoint `GET /api/auth/providers`).

## Apagar el login por contraseña

Cuando el SSO esté validado en producción: `AUTH_LOCAL_ENABLED=false`. El formulario desaparece del login y `POST /api/auth/login` responde 400. En dev conviene dejarlo encendido como acceso de emergencia.

## Cómo probarlo SIN el tenant corporativo

**Opción A — tenant gratuito de Entra (recomendada, es Entra real):**
crea un tenant con una cuenta Azure free o el Microsoft 365 Developer Program, registra la app ahí (pasos de arriba) y usa ese `ENTRA_TENANT_ID` en dev. Al pasar a producción solo cambian las 4 variables.

**Opción B — mock OIDC local (sin internet / CI):**
cualquier servidor OIDC que soporte discovery + PKCE sirve (p. ej. `oauth2-mock-server` de npm, o Keycloak en Docker). Apunta el issuer con la variable `ENTRA_ISSUER` (override del discovery):

```
ENTRA_ISSUER=http://localhost:8080/
ENTRA_CLIENT_ID=cimt-dev
ENTRA_CLIENT_SECRET=anything
ENTRA_TENANT_ID=mock            # solo para que ssoEnabled() sea true
ENTRA_REDIRECT_URI=http://localhost:5173/api/auth/sso/callback
```

El mock debe emitir ID tokens con claims `email` (o `preferred_username`), `name` y `oid` (o `sub`).

## Flujo en dev

El proxy de Vite reenvía `/api` al :3001, así que el botón de login navega a `http://localhost:5173/api/auth/sso/login` → 302 a Microsoft → callback en `/api/auth/sso/callback` → sesión creada → redirect a `/`. Registra la redirect URI con el **puerto 5173** para dev.

## Notas de seguridad

- El `state` y el `code_verifier` de PKCE viajan en una cookie HttpOnly de 10 minutos restringida a `/api/auth`.
- `openid-client` valida firma, issuer, audience y expiración del ID token contra el discovery del tenant.
- Un usuario desactivado en `/admin/users` no puede entrar ni con SSO (`is_active` se verifica en cada login y en cada request de sesión).
