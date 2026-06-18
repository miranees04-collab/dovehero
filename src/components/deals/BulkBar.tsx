import { useStore } from '@/store/useStore';
import { OWNERS, STAGES, SEQUENCES } from '@/data/constants';
import { Avatar, Popover, MenuItem } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';

/** Floating bulk-action bar shown whenever deals are multi-selected, on both
 *  the board and the table. Every action is one click from here. */
export function BulkBar() {
  const bulk = useStore((s) => s.bulk);
  const clearBulk = useStore((s) => s.clearBulk);
  const bulkStage = useStore((s) => s.bulkStage);
  const bulkOwner = useStore((s) => s.bulkOwner);
  const bulkDelete = useStore((s) => s.bulkDelete);
  const bulkEnroll = useStore((s) => s.bulkEnroll);
  if (!bulk.length) return null;
  return (
    <div className="dh-bulkbar">
      <span className="dh-bulk-count">{bulk.length} selected</span>
      <Popover up trigger={({ toggle }) => <button className="dh-bulk-btn" onClick={toggle}><Icon name="layers" size={15} /> Move to</button>}>
        {(close) => (<>{STAGES.map((s) => <MenuItem key={s.k} onClick={() => { bulkStage(s.k); close(); }}>{s.k}</MenuItem>)}</>)}
      </Popover>
      <Popover up trigger={({ toggle }) => <button className="dh-bulk-btn" onClick={toggle}><Icon name="users" size={15} /> Reassign</button>}>
        {(close) => (<>{Object.values(OWNERS).map((o) => <MenuItem key={o.key} icon={<Avatar ownerKey={o.key} size={20} />} onClick={() => { bulkOwner(o.key); close(); }}>{o.name}</MenuItem>)}</>)}
      </Popover>
      <Popover up trigger={({ toggle }) => <button className="dh-bulk-btn" onClick={toggle}><Icon name="megaphone" size={15} /> Enroll</button>}>
        {(close) => (<>{SEQUENCES.map((s) => <MenuItem key={s.k} onClick={() => { bulkEnroll(s.k); close(); }}>{s.name}</MenuItem>)}</>)}
      </Popover>
      <button className="dh-bulk-btn danger" onClick={bulkDelete}><Icon name="trash" size={15} /> Delete</button>
      <button className="dh-bulk-btn ghost" onClick={clearBulk}><Icon name="x" size={15} /></button>
    </div>
  );
}
