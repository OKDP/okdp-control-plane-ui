import { Link } from 'react-router-dom';
import './admin-home.css';

export default function AdminHome() {
  return (
    <div className="admin-home">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="banner-content">
          <div className="banner-icon">
            <i className="pi pi-cog"></i>
          </div>
          <div className="banner-text">
            <h1>Administration</h1>
            <p className="subtitle">
              Manage your projects, users, and platform settings from here.
            </p>
          </div>
        </div>
        <div className="banner-decoration"></div>
      </div>

      {/* Quick Actions */}
      <h2 className="section-heading">Manage</h2>
      <div className="quick-actions">
        <Link className="action-card" to="/admin/projects">
          <div className="card-icon projects">
            <i className="pi pi-th-large"></i>
          </div>
          <div className="action-text">
            <span className="action-title">Projects</span>
            <span className="action-desc">Create and manage data projects</span>
          </div>
          <i className="pi pi-arrow-right action-arrow"></i>
        </Link>
        <Link className="action-card" to="/admin/identity">
          <div className="card-icon identity">
            <i className="pi pi-users"></i>
          </div>
          <div className="action-text">
            <span className="action-title">Identity</span>
            <span className="action-desc">Manage users and access control</span>
          </div>
          <i className="pi pi-arrow-right action-arrow"></i>
        </Link>
      </div>
    </div>
  );
}
