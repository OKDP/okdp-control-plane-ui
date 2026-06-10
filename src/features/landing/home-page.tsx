import { Button } from 'primereact/button';
import { useAuth } from '../../core/auth/auth-context';
import './home-page.css';

export default function HomePage() {
  const auth = useAuth();

  return (
    <section className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="logo-section">
          <img src="/images/okdp-notext.svg" alt="okdp" className="logo" />
          <div className="logo-text">
            <span className="logo-title">okdp</span>
            <span className="logo-subtitle">console</span>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="welcome-section">
          <h1>Welcome</h1>
          <p className="description">Sign in to access your workspace</p>
        </div>

        {/* Auth States */}
        {!auth.ready ? (
          <div className="loading-state">
            <i className="pi pi-spin pi-spinner"></i>
            <span>Initializing...</span>
          </div>
        ) : auth.isAuthenticated ? (
          <div className="session-info">
            <div className="user-greeting">
              <i className="pi pi-user-check"></i>
              <span>
                Signed in as <strong>{auth.profile?.firstName || auth.profile?.username}</strong>
              </span>
            </div>
            <div className="actions">
              <Button
                type="button"
                label="My Account"
                icon="pi pi-user"
                outlined
                onClick={() => auth.accountManagement()}
              />
              <Button
                type="button"
                label="Sign out"
                icon="pi pi-sign-out"
                severity="secondary"
                onClick={() => auth.logout()}
              />
            </div>
          </div>
        ) : (
          <div className="login-action">
            <Button
              type="button"
              label="Sign in"
              icon="pi pi-sign-in"
              className="login-btn"
              onClick={() => auth.login()}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="login-footer">
        <span>© 2026 OKDP</span>
      </footer>
    </section>
  );
}
