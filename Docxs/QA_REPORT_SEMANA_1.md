# Informe de QA — Semana 1

**Producto:** CrimeTrack (Sistema de Gestión Policial)  
**Alcance:** Pruebas automatizadas (Django), corrección de incidencias y refactor de UI/UX  
**Fecha:** 23 de agosto de 2026  
**Entorno de verificación:** Docker Compose (`sgp_backend`, `sgp_frontend`) + PostgreSQL de test (`test_gestion_policial`)

---

## 1. Resumen ejecutivo

Se cerró un ciclo de calidad sobre el núcleo operativo: se diseñó e implementó un plan de **pruebas unitarias/API** con `django.test.TestCase` y Faker, se ejecutó contra el backend en contenedor y se corrigieron las fallas detectadas. En paralelo se modernizó la capa visual de los dashboards del **Supervisor de Unidad** y del **Jefe de Zona** con Tailwind CSS.

| Área | Qué se probó / entregó | Resultado |
|------|------------------------|-----------|
| Roles y permisos | Un Agente Operativo no puede consultar el dashboard, indicadores ni reportes del Visor Ejecutivo (`EjecutivoOnly` → HTTP 403). El Visor sí obtiene 200. | **Aprobado** |
| Data scoping (aislamiento territorial) | Partes en Zona A y Zona B; el Supervisor de Zona A solo ve pendientes de su zona (`partes_en_zona_qs` / API `control_calidad/pendientes`). | **Aprobado** |
| Flujo operativo | Alta de escuadra → asignación de vehículo de flota → redacción de parte vinculado a alerta `EN_LUGAR`. | **Aprobado** (tras corrección de serializador) |
| UI/UX dashboards | Glassmorphism, hovers y grids mobile-first en Supervisor y Jefe de Zona; sidebar retráctil &lt; 1024 px. | **Entregado** |

**Estado general del sistema:** el backend operativo cubre los tres escenarios críticos de seguridad y flujo con **7/7 tests en verde**. El frontend de los dos roles táctico-operativos queda alineado a un look SaaS gubernamental; el resto de roles conserva el CSS previo (Tailwind se cargó **sin Preflight** para no romper estilos existentes).

**Cómo reproducir las pruebas:**

```powershell
docker compose exec backend python manage.py test operativo -v 2
```

---

## 2. Incidencias resueltas

Los fallos **no** estaban en el aislamiento por jurisdicción ni en los permisos de rol. El traceback y la corrida posterior lo confirmaron.

### 2.1 ImportError al cargar `operativo.tests` — locale de Faker

- **Síntoma:** `AttributeError: Invalid configuration for faker locale 'es_EC'` al importar el módulo de tests. Ninguna clase llegaba a ejecutarse.
- **Capa:** harness de pruebas (`backend/operativo/tests.py`), no modelos ni vistas.
- **Causa:** Faker no incluye el locale `es_EC`.
- **Corrección:** instanciar `Faker("es_ES")` (nombres y direcciones en español, locale soportado).

### 2.2 Flujo operativo — HTTP 400 al crear el Parte Policial

- **Síntoma:** `test_crear_escuadra_asignar_vehiculo_y_redactar_parte` fallaba con `AssertionError: 400 != 201`. El cuerpo de respuesta era `{'fecha_hora': ['Este campo es requerido.']}`.
- **Capa:** **serializador** (`ParteAprehensionSerializer` en `backend/operativo/serializers.py`). Modelos, FKs de PostgreSQL y la vista de alta (`partes_collection`) estaban correctos.
- **Causa:** `fecha_hora` es `DateTimeField()` no nulo en el modelo. DRF lo marca `required=True` y **corta la validación de campo** antes de `validate()`, donde ya se combinan `fecha_hecho` + `hora_hecho` (o se usa `timezone.now()`). El `save()` del modelo también completa el datetime; nunca se llegaba a persistir.
- **Corrección:** `extra_kwargs` en el serializador:

```python
"fecha_hora": {"required": False, "allow_null": True}
```

La integridad en base de datos se mantiene: el campo sigue siendo obligatorio al guardar; solo se relajó la validación de entrada para el flujo operativo real (alerta en el lugar + fecha/hora del hecho).

### Resultado post-fix

```
Ran 7 tests in ~13s
OK
```

Clases: `RolesPermisosTests` (3), `DataScopingTests` (3), `FlujoOperativoTests` (1).

---

## 2.3 Matriz de pruebas

Leyenda de **Estado:** Aprobado (verde en la última corrida) · Corregido (falló y se arregló) · Entregado (cambio de UI, sin test automatizado).  
**Prioridad:** P1 crítica (seguridad / no se puede operar) · P2 alta · P3 media.

| Nº | Área del sistema | Rol | Qué se ejecutó | Qué fallaba | Qué se mejoró | Estado final | Prioridad |
|----|------------------|-----|----------------|-------------|---------------|--------------|-----------|
| TC-01 | Autorización / Visor Ejecutivo | Agente Operativo vs Visor Ejecutivo | `GET` dashboard del visor con token de agente | Nada en producción; el suite ni cargaba por Faker `es_EC` | Locale Faker `es_ES`; se confirma **403** | **Aprobado** | P1 |
| TC-02 | Autorización / Indicadores y reportes | Agente Operativo | `GET` indicadores y reportes estratégicos del visor | Igual: bloqueo al importar tests | Mismo harness; se confirma **403** en ambas rutas | **Aprobado** | P1 |
| TC-03 | Autorización / Visor Ejecutivo | Visor Ejecutivo | `GET` dashboard del visor con rol correcto | No fallaba la vista | Control positivo: **200** | **Aprobado** | P2 |
| TC-04 | Data scoping / queryset de partes | Supervisor de Unidad | `partes_en_zona_qs`: partes Zona A vs Zona B | No fallaba el filtro de zona | Se verifica que el supervisor A **no** ve el parte de B | **Aprobado** | P1 |
| TC-05 | Data scoping / acceso por ID | Supervisor de Unidad | `parte_en_zona_or_404` con parte de otra zona | No fallaba | Parte B → `None` (fuera de zona) | **Aprobado** | P1 |
| TC-06 | Data scoping / API pendientes | Supervisor de Unidad | `GET` `/control_calidad/pendientes/` | No fallaba | `count = 1` y solo el parte de Zona A | **Aprobado** | P1 |
| TC-07 | Flujo operativo / escuadra, flota y parte | Supervisor + Agente | POST escuadra → asignar vehículo → POST parte con alerta `EN_LUGAR` | **400** `fecha_hora` requerido (serializador) | `fecha_hora` opcional; se arma con `fecha_hecho`+`hora_hecho` | **Corregido → Aprobado** | P1 |
| TC-08 | Harness de pruebas | Todos (suite) | Importar `operativo.tests` | Locale `es_EC` inexistente en Faker | `Faker("es_ES")` | **Corregido → Aprobado** | P2 |
| UI-01 | Dashboard KPIs y tablas | Supervisor de Unidad | Glass, sombras, hover en filas, grid 1→2→4 cols | UI plana / grids fijos en CSS | Tailwind glass + transiciones + tabla de revisión | **Entregado** | P2 |
| UI-02 | Data grid de calidad | Supervisor de Unidad | Lista de partes pendientes | Filas sin hover consistente | `hover:bg-gray-700` / claro + botón Revisar | **Entregado** | P2 |
| UI-03 | Dashboard táctico, filtros, KPIs | Jefe de Zona (Director) | KPIs, filtros, tabs, ranking, estado de partes | Grids poco móviles | Glass + `grid-cols-1` hasta `2xl:grid-cols-5` | **Entregado** | P2 |
| UI-04 | Navegación / shell | Supervisor, Jefe de Zona (y resto que usa RoleShell) | Sidebar &lt; 1024 px | En móvil el colapso **ocultaba** el menú | Drawer overlay + backdrop + hamburguesa | **Entregado** | P2 |

**Totales:** 8 casos backend (7 métodos Django + 1 import) · 4 chequeos UI · **0 abiertos** en este alcance.

---

## 3. Mejoras de UI/UX

Se incorporó **Tailwind CSS v4** vía `@tailwindcss/vite` (solo tema + utilities; **sin reset Preflight**). El variante `dark` respeta `html[data-theme="dark"]`.

Utilidades compartidas: `frontend/src/shared/ui/saas.js`.

| Requisito | Implementación |
|-----------|----------------|
| Glassmorphism y profundidad | Cards/KPI: `bg-white/80`, `dark:bg-gray-800/90`, `border-gray-700/50`, `shadow-lg` / `shadow-xl`, `backdrop-blur-md` |
| Interactividad | Botones y filas: `transition-all duration-300`, `hover:bg-gray-100` / `dark:hover:bg-gray-700` |
| Mobile-first | KPIs Supervisor: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`. Jefe de Zona: hasta `2xl:grid-cols-5`. Tablas con scroll horizontal (`min-w-[640px]`) |
| Sidebar retráctil | &lt; 1024 px: drawer overlay + backdrop; hamburguesa en topbar. Desktop: colapso a iconos (comportamiento previo) |

**Vistas tocadas**

- Supervisor: dashboard (`Page.jsx`) y data grid de partes pendientes (`PartesPendientesLista.jsx`).
- Jefe de Zona: dashboard de inteligencia, Estado de Partes y Ranking de distritos.
- Shell compartido: `RoleShell.jsx` / `RoleShell.css` (drawer móvil).

---

## 4. Siguientes pasos requeridos

1. **QA visual en navegador** de Supervisor y Jefe de Zona (claro/oscuro, &lt; 1024 px y escritorio): el servidor IDE de browser no estuvo disponible en la última pasada; conviene validar login demo (`supervisor@sgp.gob` / `Supervisor123!` y cuenta director / `Director123!`).
2. **Extender la batería de tests** a Visor Ejecutivo (ficha de jurisdicción, PDF de reportes), SuperAdmin (exportación de factura PDF) y aislamiento multi-tenant (`institucion`).
3. **CI:** añadir `python manage.py test operativo` (y más apps) en el pipeline; la BD de test ya se crea y destruye sola.
4. **Tailwind en el resto de roles** (Agente, Detective, Fiscal, Visor, SuperAdmin) con el mismo kit `saas.js`, sin activar Preflight.
5. **Contrato de API del parte:** documentar que `fecha_hecho` + `hora_hecho` bastan y que `fecha_hora` es opcional en el POST; actualizar clientes que aún envíen solo `fecha_hora` si aplica.

---

## Referencia de archivos

| Archivo | Rol en esta semana |
|---------|-------------------|
| `backend/operativo/tests.py` | Plan de pruebas automatizadas |
| `backend/operativo/serializers.py` | Fix `fecha_hora` en alta de parte |
| `frontend/vite.config.js` / `frontend/src/index.css` | Integración Tailwind v4 |
| `frontend/src/shared/ui/saas.js` | Tokens glass / tablas / botones |
| `frontend/src/shared/components/RoleShell.*` | Sidebar retráctil móvil |
| `frontend/src/roles/supervisor_unidad/...` | Dashboard y grilla de calidad |
| `frontend/src/roles/director_zona/...` | Dashboard táctico, estado de partes, ranking |
