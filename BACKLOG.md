# CIMT — Backlog (post-demo)

## Alertas (capa de flujo sobre OnSolve — no replicar entrega SMS/voz)
1. Plantillas de alerta por escenario (químico, clima, intruso, recall) editables desde el dashboard
2. Alertas por email con targeting dinámico desde la DB (sitio × función × nivel), con modo simulación
3. Acknowledgment tracking: link de confirmación + panel en vivo de quién respondió
4. Escalación automática al Alternate si el Primary no confirma en X minutos
5. Botón "Unirse al war room": marca conferencia con código incluido (tel:+número,,código#)
6. Historial de alertas ligado a incidente (para debrief)
7. CIMT como fuente de verdad → sincronizar listas/grupos hacia OnSolve (CSV o API)
8. Integración con API de OnSolve para disparar SMS/voz reales (requiere credenciales del contrato)
9. Simulacros programados (drills) con métricas de respuesta por sitio
10. Roll call "estoy a salvo" por sitio durante un incidente

## Funcionalidades propuestas (pendientes de priorizar)
- Panel de cobertura CIMT: heatmap sitios × 9 roles × 2 niveles desde la DB (reemplaza el Excel pintado a mano)
- Modo incidente activo: banner global, event log con timestamps, checklist ligado, resumen de debrief
- PDF por sitio generado al vuelo (reemplaza los PDFs manuales de cimtPDF)
- Búsqueda global (Ctrl+K) de personas/sitios/agencias
- Código QR por sitio para póster del war room
- Tarjeta de ruta de escalación por sitio (Coordinator → Alternate → Corporate)
- PWA/offline: contactos cacheados sin señal
- Import del Excel de MS Forms desde el admin con reporte en pantalla
- Audit log de cambios (preparado para SSO: columnas updated_by ya existen)
- Mapa mundial de sitios

## Plataforma
- Azure Entra SSO + roles (esperando definición del departamento dueño)
- i18n (chino/alemán; `locale` ya existe en content_pages, strings centralizables)
- Subida de archivos para recursos desde el admin (hoy: public/files/)
- Migración de datos reales desde DB legacy `netlication` (osisql01): agencias externas, clientes, constituyentes, war rooms
- Deployment (IIS interno / servidor Node) + pipeline
- Code-splitting del bundle (~544 KB)
