import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MaterialIcon from "../shared/components/MaterialIcon";
import loginArt from "../assets/imagenParaelInicioSesion.png";
import { registrarYPersistir, saasApi } from "./api";
import "./CommercialSuite.css";

const FALLBACK_PLANS = [
  {
    id: 1,
    codigo: "BASICO",
    nombre: "Plan Básico",
    audiencia: "Metropolitana / Municipal",
    precio_mensual: "89.00",
    limite_usuarios: 50,
    almacenamiento_gb: 100,
    tiene_analitica_avanzada: false,
    on_premise: false,
    descripcion: "Ideal para comandos municipales y unidades urbanas.",
  },
  {
    id: 2,
    codigo: "CORPORATIVO",
    nombre: "Plan Corporativo",
    audiencia: "Seguridad Privada",
    precio_mensual: "249.00",
    limite_usuarios: 200,
    almacenamiento_gb: 500,
    tiene_analitica_avanzada: true,
    on_premise: false,
    descripcion: "Multi-unidad, MinIO ampliado y analítica táctica ClickHouse.",
  },
  {
    id: 3,
    codigo: "GUBERNAMENTAL",
    nombre: "Plan Gubernamental",
    audiencia: "Enterprise / On-Premise",
    precio_mensual: "799.00",
    limite_usuarios: 5000,
    almacenamiento_gb: 5000,
    tiene_analitica_avanzada: true,
    on_premise: true,
    descripcion: "Despliegue institucional, cuotas amplias y soporte dedicado.",
  },
];

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function CommercialSuite({ initialView = "landing" }) {
  const navigate = useNavigate();
  const isOnboarding = initialView === "onboarding";
  const [planes, setPlanes] = useState(FALLBACK_PLANS);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nombre_comercial: "",
    ruc: "",
    direccion: "",
    plan_id: "",
    metodo_facturacion: "tarjeta",
    admin_nombre: "",
    admin_apellido: "",
    admin_email: "",
    admin_password: "",
  });
  const [obError, setObError] = useState("");
  const [obBusy, setObBusy] = useState(false);

  useEffect(() => {
    saasApi
      .planes()
      .then((d) => {
        if (d.planes?.length) {
          setPlanes(d.planes);
          setForm((f) => ({
            ...f,
            plan_id: f.plan_id || String(d.planes[1]?.id || d.planes[0].id),
          }));
        }
      })
      .catch(() => {
        setForm((f) => ({ ...f, plan_id: f.plan_id || String(FALLBACK_PLANS[1].id) }));
      });
  }, []);

  const selectedPlan = useMemo(
    () => planes.find((p) => String(p.id) === String(form.plan_id)) || planes[0],
    [planes, form.plan_id]
  );

  function goOnboarding(planId) {
    if (planId) {
      sessionStorage.setItem("ct_plan_id", String(planId));
    }
    navigate("/onboarding");
  }

  useEffect(() => {
    if (!isOnboarding) return;
    const saved = sessionStorage.getItem("ct_plan_id");
    if (saved) {
      setForm((f) => ({ ...f, plan_id: saved }));
      setStep(2);
    }
  }, [isOnboarding]);

  async function submitOnboarding(e) {
    e.preventDefault();
    setObError("");
    setObBusy(true);
    try {
      const data = await registrarYPersistir({
        ...form,
        plan_id: Number(form.plan_id),
      });
      sessionStorage.removeItem("ct_plan_id");
      navigate(data.redirect || "/app/administrador/dashboard", { replace: true });
    } catch (err) {
      setObError(err.message || "No se pudo completar el registro");
    } finally {
      setObBusy(false);
    }
  }

  if (isOnboarding) {
    return (
      <div className="ct-suite">
        <OnboardingView
          step={step}
          setStep={setStep}
          form={form}
          setForm={setForm}
          planes={planes}
          selectedPlan={selectedPlan}
          error={obError}
          busy={obBusy}
          onSubmit={submitOnboarding}
          onBackLanding={() => navigate("/")}
        />
      </div>
    );
  }

  return (
    <div className="ct-suite">
      <LandingView
        planes={planes}
        onAffiliate={() => goOnboarding()}
        onPickPlan={(id) => goOnboarding(id)}
      />
    </div>
  );
}

function LandingView({ planes, onAffiliate, onPickPlan }) {
  return (
    <div className="ct-landing">
      <header className="ct-nav">
        <div className="ct-brand">
          <span className="ct-mark" aria-hidden>
            <MaterialIcon name="shield" filled />
          </span>
          <div className="ct-brand-text">
            <strong>CrimeTrack</strong>
            <span>ANALYTICS CORE</span>
          </div>
        </div>
        <nav className="ct-nav-links">
          <a href="#inicio">Inicio</a>
          <a href="#soluciones">Soluciones</a>
          <a href="#planes">Planes</a>
          <a href="#flujo">Seguridad</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <div className="ct-nav-actions">
          <Link to="/login" className="ct-btn ghost">
            Iniciar sesión
          </Link>
          <button type="button" className="ct-btn primary" onClick={onAffiliate}>
            Afiliar institución
          </button>
        </div>
      </header>

      <section className="ct-hero" id="inicio">
        <div className="ct-hero-copy">
          <h1>
            Plataforma institucional para la gestión de incidentes, expedientes y{" "}
            <em>análisis criminal</em>
          </h1>
          <p>
            Ministerios, municipios e instituciones policiales operan en un entorno
            multi-tenant seguro, auditable y listo para escalar inteligencia táctica.
          </p>
          <div className="ct-hero-cta">
            <button type="button" className="ct-btn primary lg" onClick={onAffiliate}>
              Afiliar institución
            </button>
            <Link to="/login" className="ct-btn ghost lg">
              Iniciar sesión
            </Link>
          </div>
          <ul className="ct-pills">
            <li>
              <MaterialIcon name="workspace_premium" /> Licencias institucionales
            </li>
            <li>
              <MaterialIcon name="hub" /> Multi-tenant
            </li>
            <li>
              <MaterialIcon name="policy" /> Auditoría total
            </li>
            <li>
              <MaterialIcon name="insights" /> Analítica criminal
            </li>
          </ul>
        </div>
        <div className="ct-hero-visual">
          <img
            src={loginArt}
            alt="CrimeTrack Analytics — gestión institucional e inteligencia táctica"
            className="ct-hero-art"
          />
        </div>
      </section>

      <section className="ct-split" id="soluciones">
        <div className="ct-feat-grid">
          {[
            ["emergency", "Gestión de incidentes", "Registro y seguimiento operativo en tiempo real."],
            ["folder_shared", "Expedientes criminales", "Organización de casos e investigación judicial."],
            ["history_edu", "Auditoría y trazabilidad", "Bitácora de accesos y cambios por institución."],
            ["monitoring", "Dashboard analítico", "Indicadores clave para decisiones estratégicas."],
          ].map(([icon, label, desc]) => (
            <article key={label} className="ct-feat">
              <span className="ct-feat-icon">
                <MaterialIcon name={icon} />
              </span>
              <h3>{label}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <aside className="ct-preview-card">
          <div className="ct-preview-head">
            <strong>Vista general del sistema</strong>
            <span>Últimos 30 días</span>
          </div>
          <div className="ct-preview-kpis">
            {[
              ["apartment", "Instituciones activas", "128", "+12%"],
              ["badge", "Licencias vigentes", "156", "+8%"],
              ["report", "Incidentes reportados", "2,486", "+16%"],
              ["group", "Usuarios activos", "1,342", "+18%"],
            ].map(([icon, l, v, d]) => (
              <div key={l}>
                <MaterialIcon name={icon} />
                <span>{l}</span>
                <strong>{v}</strong>
                <em>{d}</em>
              </div>
            ))}
          </div>
          <div className="ct-donut-wrap">
            <div className="ct-donut-block">
              <div className="ct-donut" />
              <div className="ct-donut-center">
                <strong>2,486</strong>
                <span>total</span>
              </div>
            </div>
            <div>
              <p className="ct-donut-title">Incidentes por categoría</p>
              <ul>
                <li>
                  <i className="dot d1" /> Delitos contra el patrimonio 40%
                </li>
                <li>
                  <i className="dot d2" /> Violencia 25%
                </li>
                <li>
                  <i className="dot d3" /> Fraude 15%
                </li>
                <li>
                  <i className="dot d4" /> Otros 20%
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </section>

      <section className="ct-pricing" id="planes">
        <header>
          <h2>Planes disponibles</h2>
          <p>Elija el alcance según el tamaño y el mandato de su institución.</p>
        </header>
        <div className="ct-plan-grid">
          {planes.map((p, idx) => (
            <article
              key={p.id || p.codigo}
              className={`ct-plan${idx === 1 ? " featured" : ""}`}
            >
              {idx === 1 && <span className="badge">Recomendado</span>}
              <h3>{p.nombre}</h3>
              <p className="audience">{p.audiencia}</p>
              <p className="price">
                {money(p.precio_mensual)}
                <small>/mes</small>
              </p>
              <p className="desc">{p.descripcion}</p>
              <ul>
                <li>
                  <MaterialIcon name="group" /> Hasta {p.limite_usuarios} usuarios
                </li>
                <li>
                  <MaterialIcon name="cloud" /> {p.almacenamiento_gb} GB MinIO
                </li>
                <li>
                  <MaterialIcon
                    name={p.tiene_analitica_avanzada ? "check_circle" : "cancel"}
                  />{" "}
                  Analítica ClickHouse{" "}
                  {p.tiene_analitica_avanzada ? "avanzada" : "básica"}
                </li>
                <li>
                  <MaterialIcon name={p.on_premise ? "dns" : "public"} />{" "}
                  {p.on_premise ? "On-Premise / Enterprise" : "Cloud multi-tenant"}
                </li>
              </ul>
              <button
                type="button"
                className="ct-btn primary block"
                onClick={() => onPickPlan(p.id)}
              >
                Elegir {p.nombre.replace("Plan ", "")}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="ct-how" id="flujo">
        <h2>¿Cómo funciona?</h2>
        <ol>
          {[
            ["apartment", "La institución se afilia", "Completa el formulario con RUC y datos."],
            ["verified", "Se aprueba la licencia", "Validación del plan y facturación."],
            [
              "person_add",
              "Se crea el administrador institucional",
              "Master Admin con rol Administrador de Sistema (TI).",
            ],
            ["task_alt", "Se habilita el uso del sistema", "Aislamiento total de datos por tenant."],
          ].map(([icon, title, desc], i) => (
            <li key={title}>
              <span className="step-num">{i + 1}</span>
              <MaterialIcon name={icon} />
              <strong>{title}</strong>
              <span>{desc}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="ct-footer" id="contacto">
        <div className="ct-footer-top">
          <div>
            <div className="ct-brand light">
              <span className="ct-mark" aria-hidden>
                <MaterialIcon name="shield" filled />
              </span>
              <div className="ct-brand-text">
                <strong>CrimeTrack</strong>
                <span>ANALYTICS CORE</span>
              </div>
            </div>
            <p className="tagline">
              Inteligencia táctica y control operativo para instituciones de seguridad.
            </p>
          </div>
          <div className="cols">
            <div>
              <span>Soluciones</span>
              <a href="#soluciones">Operativo</a>
              <a href="#soluciones">Investigación</a>
            </div>
            <div>
              <span>Empresa</span>
              <a href="#planes">Planes</a>
              <Link to="/login">Acceso</Link>
            </div>
            <div>
              <span>Soporte</span>
              <a href="mailto:soporte@crimetrack.local">Contacto</a>
            </div>
          </div>
          <div className="secure-badge">
            <MaterialIcon name="verified_user" />
            <div>
              <strong>Plataforma segura</strong>
              <span>Aislamiento multi-tenant · Auditoría</span>
            </div>
          </div>
        </div>
        <p className="legal">
          © {new Date().getFullYear()} CrimeTrack Analytics Core ·{" "}
          <a href="#terminos">Términos de uso</a> · <a href="#privacidad">Política de privacidad</a>
        </p>
      </footer>
    </div>
  );
}

function OnboardingView({
  step,
  setStep,
  form,
  setForm,
  planes,
  selectedPlan,
  error,
  busy,
  onSubmit,
  onBackLanding,
}) {
  function next() {
    if (step === 1 && (!form.nombre_comercial.trim() || !form.ruc.trim())) return;
    if (step === 2 && !form.plan_id) return;
    setStep((s) => Math.min(3, s + 1));
  }

  return (
    <div className="ct-onboard">
      <button type="button" className="ct-back" onClick={onBackLanding}>
        <MaterialIcon name="arrow_back" /> Volver al inicio
      </button>
      <div className="ct-onboard-card">
        <header>
          <p className="eyebrow">Afiliación institucional</p>
          <h2>Asistente de registro</h2>
          <div className="steps">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={step === n ? "active" : step > n ? "done" : ""}
                onClick={() => setStep(n)}
              >
                <span>{n}</span>
                {n === 1 ? "Institución" : n === 2 ? "Plan" : "Master Admin"}
              </button>
            ))}
          </div>
        </header>

        <form onSubmit={onSubmit}>
          {step === 1 && (
            <div className="fields">
              <label>
                Nombre comercial
                <input
                  required
                  value={form.nombre_comercial}
                  onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })}
                  placeholder="Ej. Policía Metropolitana Zona 8"
                />
              </label>
              <label>
                RUC
                <input
                  required
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  placeholder="Identificador fiscal"
                />
              </label>
              <label className="full">
                Dirección
                <input
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Calle, ciudad, provincia"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="fields">
              <label className="full">
                Plan
                <select
                  required
                  value={form.plan_id}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                >
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {money(p.precio_mensual)}/mes — {p.audiencia}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Método de facturación
                <select
                  value={form.metodo_facturacion}
                  onChange={(e) => setForm({ ...form, metodo_facturacion: e.target.value })}
                >
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="orden_compra">Orden de compra</option>
                </select>
              </label>
              {selectedPlan && (
                <div className="plan-summary">
                  <strong>{selectedPlan.nombre}</strong>
                  <p>
                    {selectedPlan.limite_usuarios} usuarios · {selectedPlan.almacenamiento_gb} GB
                    MinIO · ClickHouse{" "}
                    {selectedPlan.tiene_analitica_avanzada ? "avanzada" : "básica"}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="fields">
              <p className="hint full">
                Este usuario será el <strong>Administrador de Institución (TI)</strong> — mismo
                rol y funcionalidades que el admin actual, uno distinto por institución.
              </p>
              <label>
                Nombre
                <input
                  required
                  value={form.admin_nombre}
                  onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
                />
              </label>
              <label>
                Apellido
                <input
                  value={form.admin_apellido}
                  onChange={(e) => setForm({ ...form, admin_apellido: e.target.value })}
                />
              </label>
              <label className="full">
                Email
                <input
                  required
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                />
              </label>
              <label className="full">
                Contraseña
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                />
              </label>
            </div>
          )}

          {error && <p className="ct-error">{error}</p>}

          <div className="ob-actions">
            {step > 1 ? (
              <button type="button" className="ct-btn ghost" onClick={() => setStep(step - 1)}>
                Atrás
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button type="button" className="ct-btn primary" onClick={next}>
                Continuar
              </button>
            ) : (
              <button type="submit" className="ct-btn primary" disabled={busy}>
                {busy ? "Creando institución…" : "Crear y entrar"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
