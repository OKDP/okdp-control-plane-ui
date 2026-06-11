import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { SparkList } from './spark-list';

export default function SparkAppsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const goToSubmit = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/spark/applications/submit`);
    }
  };

  return (
    <div className="cluster-container">
      <div className="top-bar">
        <div className="left-group">
          <h1>Spark Jobs</h1>
        </div>
        <Button label="Submit job" icon="pi pi-plus" onClick={goToSubmit} className="create-btn" />
      </div>
      <SparkList />
    </div>
  );
}
