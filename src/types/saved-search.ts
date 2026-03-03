export type SavedSearchFilters = {
  tags?: string[];
  type?: string[];
  date_from?: string;
  date_to?: string;
};

export type SavedSearch = {
  id: string;
  owner_user_id: string | null;
  org_id: string | null;
  name: string;
  query: string;
  filters: SavedSearchFilters;
  sort: 'best_match' | 'priority' | 'recent';
  semantic_enabled: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};
