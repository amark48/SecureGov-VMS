export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  command?: string;
  oid?: number;
  fields?: any[];
}

export interface DatabaseClient {
  query: (text: string, params?: any[]) => Promise<QueryResult<any>>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
}