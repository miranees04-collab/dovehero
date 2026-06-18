// ---- Domain types for Dovehero CRM ----

export type StageKey =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type Priority = 'high' | 'med' | 'low';

export type PipelineKey = 'sales' | 'renewals' | 'onboarding';

export type ActivityType =
  | 'note'
  | 'email'
  | 'call'
  | 'meeting'
  | 'whatsapp'
  | 'sms'
  | 'marketing'
  | 'task'
  | 'file';

export interface ThreadMsg {
  dir: 'in' | 'out';
  who: string;
  w: string;
  text: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  who: string;
  w: string; // relative time label e.g. "2h", "1d"
  text?: string;
  subj?: string;
  chan?: string;
  dir?: 'in' | 'out';
  status?: string;
  thread?: ThreadMsg[];
  /** task-specific */
  title?: string;
  due?: string;
  prio?: Priority;
  done?: boolean;
  ttype?: string;
  /** email */
  opens?: number;
  attach?: string[];
  /** meeting */
  when?: string;
  dur?: string;
  provider?: 'meet' | 'zoom' | 'phone' | 'teams';
  link?: string;
  attendees?: string[];
  agenda?: string;
  /** call */
  outcome?: 'Connected' | 'Voicemail' | 'No answer' | 'Busy';
  /** marketing sequence */
  seq?: { k: string; name: string; steps: string[] };
  step?: number;
  /** note */
  pin?: boolean;
  reminder?: { title: string; due: string; done: boolean };
}

export interface Contact {
  n: string; // name
  r: string; // role (Champion, Economic buyer, ...)
  t: string; // title
  s: 'Strong' | 'Medium' | 'Weak' | 'Dormant'; // signal strength
}

export interface LineItem {
  n: string;
  v: number;
}

export interface DealDoc {
  n: string;
  k: 'pdf' | 'doc' | 'xls';
}

export interface DocItem {
  name: string;
  qty: number;
  unit: number;
}

export interface DealDocument {
  id: string;
  kind: 'quote' | 'invoice';
  total: number;
  status: string;
  items: DocItem[];
  discount: number;
  tax: number;
  created: string;
}

export interface Deal {
  id: string;
  name: string;
  company: string;
  industry: string;
  stage: StageKey;
  pipeline: PipelineKey;
  owner: string; // owner key e.g. 'AR'
  value: number;
  win: number; // win probability 0-100
  health: number; // 0-100
  priority: Priority;
  tags: string[];
  close: string;
  created: string;
  next: string | null;
  summary: string;
  contacts: Contact[];
  products: LineItem[];
  docs: DealDoc[];
  acts: Activity[];
  quotes?: DealDocument[];
  invoices?: DealDocument[];
}

export interface Owner {
  key: string;
  name: string;
  g: string; // gradient for avatar
}

export interface Stage {
  k: StageKey;
  hue: string;
}

export interface Pipeline {
  k: PipelineKey | string;
  name: string;
  hue: string;
}

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'relation';

export interface FieldDef {
  k: string;
  label: string;
  type: FieldType;
  opts?: string[];
}

export interface ObjectDef {
  k: string;
  name: string;
  plural: string;
  icon: string;
  system: boolean;
  fields: FieldDef[];
}

export type ObjectRecord = Record<string, unknown> & { id: string };

export type ThemeMode = 'light' | 'dark';

export type DealView = 'board' | 'table' | 'insights' | 'activity';

export type Density = 'comfortable' | 'compact';
export type GroupBy = 'none' | 'stage' | 'owner' | 'priority';
export type Swimlane = 'none' | 'owner' | 'priority';

/** A saved table configuration the user can re-apply as a tab. */
export interface SavedView {
  name: string;
  cols: string[];
  density: Density;
  group: GroupBy;
  sort: SortRule[];
  filters: FilterState;
}

export interface SortRule {
  k: string;
  dir: 1 | -1;
}

export interface AdvRule {
  id: string;
  field: 'value' | 'win' | 'health' | 'stage' | 'industry' | 'company';
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'is' | 'isnot' | 'contains';
  value: string;
}

export interface FilterState {
  owners: string[];
  stages: StageKey[];
  priorities: Priority[];
  tags: string[];
  minValue: number | null;
  health: 'any' | 'healthy' | 'risk';
  inbox: boolean;
  adv: AdvRule[];
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  on: { t: 'stage' | 'created' | 'stale' | 'health'; v: string };
  cond: { f: 'none' | 'priority' | 'value' | 'owner'; v: string };
  act: { t: 'task' | 'priority' | 'tag'; v: string };
}

export interface NovaMessage {
  id: string;
  role: 'user' | 'nova';
  text: string;
  chips?: { label: string; action?: string }[];
  ts: number;
}

export interface Toast {
  id: string;
  text: string;
  tone?: 'default' | 'success' | 'warn';
}
