import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../shared/components/page-header';
import { SparkList } from './spark-list';

export default function SparkAppsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const goToSubmit = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/views/spark/applications/submit`);
    }
  };

  return (
    <div>
      <PageHeader
        title="Spark Jobs"
        actions={
          <button className="create-btn" onClick={goToSubmit}>
            <i className="pi pi-plus"></i>
            <span>Submit job</span>
          </button>
        }
      />
      <SparkList />
    </div>
  );
}
