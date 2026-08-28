import { http } from './http';
import { environment } from '../../config/environment';

export interface SqlColumn {
  name: string;
  type: string;
}

/** Engine-reported query failure (syntax error, missing table…). */
export interface SqlQueryError {
  message: string;
  errorName?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface SqlQueryResult {
  queryId?: string;
  columns: SqlColumn[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
  error?: SqlQueryError;
}

const baseUrl = environment.apiBaseUrl;

/** SQL proxy: the control plane forwards the statement to the deployed
 *  engine instance (Trino) with the caller's bearer token. */
export const sqlApi = {
  execute(project: string, serviceName: string, query: string, maxRows = 1000) {
    return http.post<SqlQueryResult>(
      `${baseUrl}/api/projects/${project}/services/${serviceName}/sql`,
      { query, maxRows },
    );
  },
};
