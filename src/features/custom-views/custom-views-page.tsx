import { Link, useOutletContext } from 'react-router-dom';
import { useProjectContext } from '../../core/context/project-context';
import { useCustomViews } from '../../core/preferences/custom-views-context';
import { ActionCard, QuickActions } from '../../shared/components/action-card';
import SectionHeading from '../../shared/components/section-heading';
import {
  BUILT_IN_VIEWS,
  builtInViewIcon,
  launcherUrl,
  uiServiceLaunchers,
  uiServiceViewIcon,
} from './views-config';
import type { ViewServicesState } from './use-view-services';

/** /views — service UI launchers plus rich technology-specific views that
 *  don't fit the "one service, one instance list" shape of the lateral menu
 *  (currently the Spark pages). Reached from the user dropdown; tiles target
 *  the selected project. */
export default function CustomViewsPage() {
  const { currentProject } = useProjectContext();
  const { viewsFor } = useCustomViews();
  const projectName = currentProject?.name;
  const customViews = projectName ? viewsFor(projectName) : [];

  // Fetched once by the project shell, which feeds the views sidebar from
  // the same subscription.
  const { instances, loaded } = useOutletContext<ViewServicesState>() ?? {
    instances: [],
    loaded: false,
  };

  const launchers = uiServiceLaunchers(instances);

  return (
    <section className="flex animate-[fadeInUp_0.4s_ease-out] flex-col gap-7">
      <div>
        <h1>Views</h1>
        <p className="page-sub mt-1">
          {projectName ? (
            <>
              Service UIs and specialized views for the <strong>{projectName}</strong> project.
            </>
          ) : (
            'Service UIs and specialized views scoped to a project.'
          )}
        </p>
      </div>

      {projectName ? (
        <>
          <div className="flex flex-col gap-3">
            <SectionHeading>Built-in views</SectionHeading>
            <QuickActions>
              {BUILT_IN_VIEWS.map((view) => (
                <ActionCard
                  key={view.label}
                  to={view.path(projectName)}
                  icon={builtInViewIcon(view)}
                  tone={view.tone}
                  title={view.label}
                  description={view.description}
                />
              ))}
            </QuickActions>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <SectionHeading>Custom views</SectionHeading>
              <Link
                to={`/projects/${projectName}/settings`}
                className="text-sm font-medium text-primary no-underline hover:underline"
              >
                Manage
              </Link>
            </div>
            {customViews.length > 0 ? (
              <QuickActions>
                {customViews.map((view) => (
                  <ActionCard
                    key={view.id}
                    to={view.url}
                    external
                    icon={view.icon}
                    tone="primary"
                    title={view.label}
                    description={view.description || view.url}
                  />
                ))}
              </QuickActions>
            ) : (
              <p className="m-0 text-base text-fg-muted">
                No custom views yet — create your own launcher tiles in{' '}
                <Link
                  to={`/projects/${projectName}/settings`}
                  className="text-primary no-underline hover:underline"
                >
                  Project Settings
                </Link>
                .
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <SectionHeading>Services views</SectionHeading>
            {!loaded ? (
              <p className="m-0 flex items-center gap-2 text-base text-fg-muted">
                <i className="pi pi-spin pi-spinner"></i> Loading deployed services…
              </p>
            ) : launchers.length > 0 ? (
              <QuickActions>
                {launchers.map((launcher) => {
                  const { svc, view } = launcher;
                  const ready = svc.status === 'Ready';
                  return (
                    <ActionCard
                      key={`${svc.name}:${view.label}`}
                      to={launcherUrl(launcher)}
                      external
                      disabled={!ready}
                      icon={uiServiceViewIcon(view)}
                      tone={view.tone}
                      title={view.label}
                      description={
                        ready
                          ? (view.description ?? `Open ${svc.name} in a new tab`)
                          : `${svc.name} — ${svc.status}`
                      }
                    />
                  );
                })}
              </QuickActions>
            ) : (
              <p className="m-0 text-base text-fg-muted">
                No deployed service exposes a web UI in this project yet.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="m-0 text-base text-fg-muted">
          <Link to="/projects" className="text-primary">
            Select a project
          </Link>{' '}
          to access its views.
        </p>
      )}
    </section>
  );
}
