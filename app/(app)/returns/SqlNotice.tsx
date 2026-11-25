export default function SqlNotice() {
  return (
    <div className="mx-auto max-w-xl rounded-[10px] border border-amber/50 bg-[#fff6d6] p-6 text-sm text-[#5c4300]">
      <p className="font-semibold">ยังไม่ได้สร้างตารางใบส่งคืนสินค้า</p>
      <p className="mt-1">
        เปิด Supabase › SQL Editor › วางไฟล์ <code>supabase/migrations/0012_return_notes.sql</code> › Run แล้วรีเฟรชหน้านี้
      </p>
    </div>
  );
}

