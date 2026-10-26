# Cifrado del Workspace — guía operativa

## Cómo funciona

- Cada incidente (workspace) tiene su propia **data key** AES-256, generada al crearlo.
- Los mensajes del chat y los documentos se cifran con esa data key (**AES-256-GCM**, con AAD que ata cada ciphertext a su incidente y tabla — un ciphertext no puede "trasplantarse" a otro incidente).
- La data key se guarda en `dbo.incidents.data_key` **envuelta** (cifrada) por la **master key** `CIMT_MASTER_KEY` del `.env`. El texto plano de mensajes y archivos nunca toca la base de datos ni el disco.
- Los blobs de documentos viven cifrados en `CIMT_FILES_DIR` (default `server/private-files/`), con nombre UUID — el nombre original solo existe en la base de datos.

## La master key es el punto único de fallo

> **Sin `CIMT_MASTER_KEY`, el chat y los documentos de TODOS los incidentes son irrecuperables.**
> Los backups de SQL Server **no** sirven sin ella.

Reglas:

1. **Respáldala en un lugar distinto** a los backups de la base de datos (gestor de secretos corporativo, bóveda física, etc.).
2. Nunca la subas a git (`.env` está en `.gitignore`).
3. Restringe la lectura del `.env` del servidor a la cuenta de servicio.
4. Al migrar a Azure (junto con el SSO de Entra), muévela a **Azure Key Vault**.

Generar una clave nueva:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Rotación de la master key

Rotar la master key **no recifra** mensajes ni archivos: solo re-envuelve la data key de cada incidente (sube `key_version`). Procedimiento:

1. Mueve la clave actual a `CIMT_MASTER_KEY_PREVIOUS` en `.env`.
2. Pon la clave nueva en `CIMT_MASTER_KEY`.
3. Reinicia el servidor (sigue funcionando: las claves viejas se desenvuelven vía `_PREVIOUS`).
4. `npm run rotate:master-key` — re-envuelve todos los incidentes.
5. Cuando reporte 0 fallos: borra `CIMT_MASTER_KEY_PREVIOUS` y respalda la clave nueva.

También existe rotación por incidente desde el API: `POST /api/incidents/:id/rotate-key` (solo admin, queda auditada).

## Verificación de integridad

```
npm run verify:encryption
```

Solo lectura. Por incidente: desenvuelve la data key, descifra los últimos 100 mensajes (el tag GCM detecta manipulación) y descifra cada documento comparando su SHA-256 contra el registrado al subirlo (cadena de custodia). Sale con código 1 si algo falla. Recomendado: tras una rotación, tras restaurar un backup, y periódicamente.

## Recuperación ante desastre

| Escenario | Qué se necesita |
|---|---|
| Restaurar backup de SQL | Backup + la master key vigente cuando se tomó (o la actual si ya se rotó con `rotate:master-key`) |
| Disco de documentos perdido | Backup de `CIMT_FILES_DIR` (los blobs ya están cifrados — pueden respaldarse a cualquier medio) + la base + la master key |
| Master key perdida | **No hay recuperación** del contenido cifrado. Los metadatos (títulos, miembros, audit) sobreviven |

## Destrucción certificable (crypto-shredding)

Si Legal exige algún día destruir el contenido de un incidente de forma certificable: borrar su `data_key` de `dbo.incidents` (y el respaldo de la master key si fuera global) hace el ciphertext irrecuperable sin tocar los blobs. **No implementado como feature a propósito** — es una decisión legal, no un botón.
