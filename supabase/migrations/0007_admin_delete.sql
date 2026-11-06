-- =====================================================================
-- 0007: ลบงานซ่อม / ลูกค้า ได้เฉพาะแอดมิน (ช่างยังเพิ่ม/แก้ไขได้ตามปกติ)
-- รันหลัง 0006 · Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['repair_jobs', 'customers'] loop
    execute format('drop policy if exists "staff write %1$s" on %1$I', t);
    execute format('drop policy if exists "staff insert %1$s" on %1$I', t);
    execute format('drop policy if exists "staff update %1$s" on %1$I', t);
    execute format('drop policy if exists "admin delete %1$s" on %1$I', t);
    execute format('create policy "staff insert %1$s" on %1$I for insert to authenticated with check (is_staff())', t);
    execute format('create policy "staff update %1$s" on %1$I for update to authenticated using (is_staff()) with check (is_staff())', t);
    execute format('create policy "admin delete %1$s" on %1$I for delete to authenticated using (is_admin())', t);
  end loop;
end $$;
