import type {
  Stage,
  Pipeline,
  Owner,
  ObjectDef,
  ActivityType,
} from '@/types';

export const STAGES: Stage[] = [
  { k: 'Lead', hue: '#0EA5E9' },
  { k: 'Qualified', hue: '#3B82F6' },
  { k: 'Proposal', hue: '#8B5CF6' },
  { k: 'Negotiation', hue: '#F59E0B' },
  { k: 'Won', hue: '#10B981' },
  { k: 'Lost', hue: '#EF4444' },
];

export const OPEN_STAGES: Stage['k'][] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Negotiation',
];

export const PIPELINES: Pipeline[] = [
  { k: 'sales', name: 'Sales Pipeline', hue: '#3B82F6' },
  { k: 'renewals', name: 'Renewals', hue: '#10B981' },
  { k: 'onboarding', name: 'Onboarding', hue: '#8B5CF6' },
];

export const OWNERS: Record<string, Owner> = {
  AR: { key: 'AR', name: 'Amara Reyes', g: 'linear-gradient(135deg,#6366F1,#8B5CF6)' },
  LM: { key: 'LM', name: 'Lena Moller', g: 'linear-gradient(135deg,#EC4899,#F59E0B)' },
  JP: { key: 'JP', name: 'Jonah Pike', g: 'linear-gradient(135deg,#06B6D4,#3B82F6)' },
  RS: { key: 'RS', name: 'Ravi Shah', g: 'linear-gradient(135deg,#10B981,#06B6D4)' },
  DV: { key: 'DV', name: 'Diego Vu', g: 'linear-gradient(135deg,#8B5CF6,#EC4899)' },
};

export const ME = 'AR';

export const SEQUENCES = [
  { k: 'roi', name: 'ROI nurture', steps: ['Day 0 · Intro email', 'Day 2 · ROI one-pager', 'Day 5 · Case study', 'Day 9 · Check-in call'] },
  { k: 'expansion', name: 'Expansion playbook', steps: ['Day 0 · Usage recap', 'Day 3 · Seat-expansion guide', 'Day 7 · Exec brief'] },
  { k: 'reengage', name: 'Re-engagement', steps: ['Day 0 · "Still interested?"', 'Day 4 · New case study', 'Day 8 · Break-up email'] },
];

export const CATALOG = [
  { n: 'Platform — Annual', v: 48000 },
  { n: 'Platform — Monthly', v: 4800 },
  { n: 'Growth tier — Annual', v: 72000 },
  { n: 'Enterprise tier — Annual', v: 120000 },
  { n: 'Onboarding & implementation', v: 9000 },
  { n: 'Premium support (SLA)', v: 12000 },
  { n: 'Additional seats — 10 pack', v: 3600 },
  { n: 'API & integrations add-on', v: 7500 },
  { n: 'Advanced analytics add-on', v: 6000 },
];

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; color: string }
> = {
  note: { label: 'Note', color: '#64748B' },
  email: { label: 'Email', color: '#3B82F6' },
  call: { label: 'Call', color: '#10B981' },
  meeting: { label: 'Meeting', color: '#8B5CF6' },
  whatsapp: { label: 'WhatsApp', color: '#25D366' },
  sms: { label: 'SMS', color: '#0EA5E9' },
  marketing: { label: 'Marketing', color: '#EC4899' },
  task: { label: 'Task', color: '#F59E0B' },
  file: { label: 'File', color: '#06B6D4' },
};

export const TYPE_ORDER: ActivityType[] = [
  'note',
  'email',
  'call',
  'meeting',
  'whatsapp',
  'sms',
  'marketing',
  'task',
  'file',
];

export const OBJECT_DEFS: ObjectDef[] = [
  {
    k: 'company',
    name: 'Company',
    plural: 'Companies',
    icon: 'building',
    system: true,
    fields: [
      { k: 'name', label: 'Name', type: 'text' },
      {
        k: 'industry',
        label: 'Industry',
        type: 'select',
        opts: ['SaaS', 'Fintech', 'Healthcare', 'Retail', 'Manufacturing', 'Energy', 'Logistics'],
      },
      { k: 'employees', label: 'Employees', type: 'number' },
      { k: 'region', label: 'Region', type: 'select', opts: ['North America', 'EMEA', 'APAC'] },
      { k: 'domain', label: 'Domain', type: 'url' },
      { k: 'owner', label: 'Owner', type: 'text' },
    ],
  },
  {
    k: 'contact',
    name: 'Contact',
    plural: 'Contacts',
    icon: 'users',
    system: true,
    fields: [
      { k: 'name', label: 'Name', type: 'text' },
      { k: 'title', label: 'Title', type: 'text' },
      { k: 'email', label: 'Email', type: 'email' },
      { k: 'company', label: 'Company', type: 'relation' },
      { k: 'role', label: 'Role', type: 'select', opts: ['Champion', 'Economic buyer', 'Influencer', 'User'] },
    ],
  },
  {
    k: 'product',
    name: 'Product',
    plural: 'Products',
    icon: 'box',
    system: true,
    fields: [
      { k: 'name', label: 'Name', type: 'text' },
      { k: 'sku', label: 'SKU', type: 'text' },
      { k: 'price', label: 'Price', type: 'currency' },
      { k: 'category', label: 'Category', type: 'select', opts: ['Platform', 'Add-on', 'Service', 'Support'] },
      { k: 'active', label: 'Active', type: 'checkbox' },
    ],
  },
  {
    k: 'lead',
    name: 'Lead',
    plural: 'Leads',
    icon: 'target',
    system: true,
    fields: [
      { k: 'name', label: 'Name', type: 'text' },
      { k: 'company', label: 'Company', type: 'text' },
      { k: 'email', label: 'Email', type: 'email' },
      { k: 'source', label: 'Source', type: 'select', opts: ['Website', 'Referral', 'Event', 'Outbound', 'Ads'] },
      { k: 'status', label: 'Status', type: 'select', opts: ['New', 'Working', 'Qualified', 'Disqualified'] },
    ],
  },
  {
    k: 'ticket',
    name: 'Ticket',
    plural: 'Tickets',
    icon: 'life-buoy',
    system: true,
    fields: [
      { k: 'name', label: 'Subject', type: 'text' },
      { k: 'company', label: 'Company', type: 'relation' },
      { k: 'priority', label: 'Priority', type: 'select', opts: ['Low', 'Medium', 'High', 'Urgent'] },
      { k: 'status', label: 'Status', type: 'select', opts: ['Open', 'Pending', 'Solved'] },
    ],
  },
];

export const hueOf = (k: string): string =>
  STAGES.find((s) => s.k === k)?.hue ?? '#94A3B8';

export const pipelineOf = (k: string): Pipeline =>
  PIPELINES.find((p) => p.k === k) ?? PIPELINES[0];

export function healthColor(h: number): string {
  return h >= 70 ? '#10B981' : h >= 45 ? '#F59E0B' : '#EF4444';
}

export function healthBand(h: number): string {
  return h >= 70 ? 'Healthy' : h >= 45 ? 'Watch' : 'At risk';
}
