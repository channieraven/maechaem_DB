
export interface TreeRecord {
  id: number;
  log_id?: string;
  tree_code: string;
  tag_label: string;
  plot_code: string;
  species_code: string;
  species_group: 'A' | 'B';
  species_name: string;
  tree_number: number;
  row_main: string;
  row_sub: string;
  dbh_cm: string | number | null;
  height_m: string | number | null;
  status: 'alive' | 'dead' | null;
  note: string;
  recorder: string;
  survey_date: string;
  timestamp: string;
}

export interface CoordRecord {
  tree_code: string;
  tag_label?: string;
  plot_code: string;
  species_code?: string;
  species_group?: string;
  species_name?: string;
  tree_number?: string | number;
  row_main?: string;
  row_sub?: string;
  utm_x: number;
  utm_y: number;
  lat: number;
  lng: number;
  note?: string;
}

export interface SpeciesInfo {
  code: string;
  name: string;
  group: 'A' | 'B';
}

export type ViewType = 'table' | 'coords' | 'map' | 'stats';
