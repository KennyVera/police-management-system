import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import loginArt from "../assets/imagenParaelInicioSesion.png";
import MaterialIcon from "../shared/components/MaterialIcon";
import { useBranding } from "../shared/branding/BrandingContext";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, isAuthenticated, user, loading } = useAuth();
  const { branding, assetUrl } = useBranding();
  const navigate = useNavigate();
  const [tab, setTab] = useState("sesion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const brandName = branding?.nombre_sistema || "CrimeTrack";
  const brandCorp = branding?.empresa_nombre || branding?.nombre_comercial || "CrimeTrack Analytics Corp";
  const loginLogo = assetUrl(branding?.logo_login_url || branding?.logo_url);

  if (!loading && isAuthenticated && user) {
    return <Navigate to={`/app/${user.role_slug}/dashboard`} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await login({ email, password, remember });
      navigate(`/app/${data.user.role_slug}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand">
          <div className="brand-row">
            <div className={`brand-mark${loginLogo ? " has-logo" : ""}`} aria-hidden="true">
              {loginLogo ? (
                <img src={loginLogo} alt="" className="brand-mark-img" />
              ) : (
                <>
                  <MaterialIcon name="shield" filled />
                  <MaterialIcon name="bar_chart" className="brand-chart" />
                </>
              )}
            </div>
            <div>
              <p className="brand-name">{brandCorp.toUpperCase()}</p>
            </div>
          </div>

          <h1>Plataforma Inteligente de Gestión Policial</h1>
          <p className="brand-copy">
            Sistema integral para operaciones, investigaciones y toma de
            decisiones basadas en datos.
          </p>

          <div className="brand-art-wrap">
            <img
              src={loginArt}
              alt={`Ilustración de la plataforma ${brandName}`}
              className="brand-art"
            />
          </div>

          <ul className="brand-values">
            <li>
              <MaterialIcon name="verified_user" />
              <span>Seguro</span>
            </li>
            <li>
              <MaterialIcon name="lock" />
              <span>Confiable</span>
            </li>
            <li>
              <MaterialIcon name="insights" />
              <span>Inteligente</span>
            </li>
          </ul>
        </aside>

        <section className="login-panel">
          <div className="lang-select">
            <MaterialIcon name="language" />
            <span>Español</span>
            <MaterialIcon name="expand_more" />
          </div>

          <header className="login-heading">
            <h2>Bienvenido de nuevo</h2>
            <p>Inicia sesión para continuar en {brandName}.</p>
          </header>

          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={tab === "sesion" ? "active" : ""}
              onClick={() => setTab("sesion")}
            >
              <MaterialIcon name="person" />
              Iniciar Sesión
            </button>
            <button
              type="button"
              role="tab"
              className={tab === "institucional" ? "active" : ""}
              onClick={() => setTab("institucional")}
            >
              <MaterialIcon name="account_balance" />
              Acceso Institucional
            </button>
          </div>

          {tab === "sesion" ? (
            <form className="login-form" onSubmit={handleSubmit}>
              <label>
                Correo electrónico
                <div className="field">
                  <MaterialIcon name="mail" />
                  <input
                    type="email"
                    placeholder="ejemplo@institucion.gob.ec"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </label>

              <label>
                Contraseña
                <div className="field">
                  <MaterialIcon name="lock" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} />
                  </button>
                </div>
              </label>

              <div className="form-row">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Recordarme
                </label>
                <button type="button" className="text-link">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {error && <p className="form-error">{error}</p>}

              <button type="submit" className="btn-primary" disabled={submitting}>
                <MaterialIcon name="lock" />
                {submitting ? "Ingresando..." : "Iniciar Sesión"}
              </button>
            </form>
          ) : (
            <div className="institutional-box">
              <MaterialIcon name="domain" />
              <p>
                El acceso institucional SSO se habilitará en una siguiente
                iteración. Usa tu cuenta asignada por rol en <strong>Iniciar Sesión</strong>.
              </p>
            </div>
          )}

          <div className="divider">
            <span>o continúa con</span>
          </div>

          <button type="button" className="btn-outline">
            <MaterialIcon name="shield" />
            Iniciar sesión con SSO Institucional
          </button>

          <p className="signup-hint">
            ¿No tienes una cuenta?{" "}
            <button type="button" className="text-link">
              Solicitar afiliación institucional
            </button>
          </p>

          <aside className="demo-hint">
            <p>Usuarios demo (un rol cada uno):</p>
            <code>SuperAdminSaaS@gmail.com / admin123</code>
            <code>admin@sgp.gob / Admin123!</code>
            <code>ejecutivo@sgp.gob / Ejecutivo123!</code>
            <code>director@sgp.gob / Director123!</code>
            <code>supervisor@sgp.gob / Supervisor123!</code>
            <code>detective@sgp.gob / Detective123!</code>
            <code>agente@sgp.gob / Agente123!</code>
            <p style={{ marginTop: "0.75rem" }}>
              <a href="/">← Volver a la Landing comercial</a>
            </p>
          </aside>
        </section>
      </div>

      <footer className="login-footer">
        <span>© 2026 {brandCorp}. Todos los derechos reservados.</span>
        <nav>
          <a href="#privacidad">Política de Privacidad</a>
          <span>·</span>
          <a href="#terminos">Términos de Uso</a>
          <span>·</span>
          <a href="#soporte">Soporte</a>
        </nav>
      </footer>
    </div>
  );
}
