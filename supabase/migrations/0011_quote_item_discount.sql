-- =====================================================================
-- 0011: ส่วนลดแยกรายการในใบเสนอราคา (บาท หรือ %)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================================
alter table quotation_items add column if not exists discount numeric(12,2) not null default 0;
alter table quotation_items add column if not exists discount_type text not null default 'amount';
alter table quotation_items drop constraint if exists quotation_items_discount_type_check;
alter table quotation_items add constraint quotation_items_discount_type_check check (discount_type in ('amount', 'percent'));
