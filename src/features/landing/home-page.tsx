import { Button } from 'primereact/button';
import { useAuth } from '../../core/auth/auth-context';

export default function HomePage() {
  const auth = useAuth();

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-surface-secondary p-8">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-6 rounded-lg border border-border-light bg-surface p-10 shadow-md max-[480px]:px-6 max-[480px]:py-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/images/okdp-notext.svg" alt="okdp" className="h-auto w-10" />
          <div className="flex flex-row items-baseline gap-1">
            <span className="text-[1.375rem] font-semibold tracking-[-0.01em] text-fg">okdp</span>
            <span className="text-[1.375rem] font-normal text-fg-secondary">console</span>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="text-center">
          {/* ! overrides the global h1 sizing from styles.css */}
          <h1 className="m-0 text-[1.5rem]! font-semibold tracking-[-0.01em] text-fg max-[480px]:text-[1.25rem]!">
            Welcome
          </h1>
          <p className="mt-2 text-md leading-normal text-fg-secondary">
            Sign in to access your workspace
          </p>
        </div>

        {/* Auth States */}
        {!auth.ready ? (
          <div className="flex items-center gap-3 text-fg-secondary">
            <i className="pi pi-spin pi-spinner text-[1.25rem] text-primary"></i>
            <span>Initializing...</span>
          </div>
        ) : auth.isAuthenticated ? (
          <div className="flex w-full flex-col gap-5">
            <div className="flex items-center justify-center gap-2 rounded-md border border-primary-100 bg-primary-50 p-4 text-primary-700">
              <i className="pi pi-user-check text-[1.25rem] text-primary"></i>
              <span>
                Signed in as{' '}
                <strong className="text-primary">
                  {auth.profile?.firstName || auth.profile?.username}
                </strong>
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                label="Sign out"
                icon="pi pi-sign-out"
                severity="secondary"
                className="w-full justify-center"
                onClick={() => auth.logout()}
              />
            </div>
          </div>
        ) : (
          <div className="w-full">
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
      <footer className="mt-6 text-xs text-fg-muted">
        <span>© 2026 OKDP</span>
      </footer>
    </section>
  );
}
