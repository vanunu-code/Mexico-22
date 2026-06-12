-- ============================================================
-- מבנה מסד הנתונים עבור אפליקציית החתימות (מכסיקו 22)
-- הרץ את הקובץ הזה ב-Supabase: SQL Editor → New query → הדבק → Run
-- ============================================================

-- טבלת חתימות: שורה אחת לכל דירה שחתמה
create table if not exists public.signatures (
  apt        integer primary key,          -- מספר הדירה (1..32)
  name       text,                         -- שם בעל הדירה
  signed     boolean not null default false,
  signed_at  text,                         -- תאריך ושעה של החתימה (טקסט בעברית)
  drawing    text,                         -- נתוני החתימה (מסלולי SVG)
  created_at timestamptz not null default now()
);

-- מינימיזציה: שדה הטלפון הוסר. אם הטבלה כבר קיימת עם עמודת phone — מוחקים
-- אותה (ואת הטלפונים שכבר נאספו) כדי שלא יישאר מידע אישי קריא לכל מי שיש לו קישור.
alter table public.signatures drop column if exists phone;

-- הפעלת אבטחת שורות (Row Level Security)
alter table public.signatures enable row level security;

-- ── הרשאות טבלה (GRANT) ──────────────────────────────────────
-- קריטי: RLS היא שכבה *מעל* הרשאות הטבלה. בלי GRANT ל-role anon,
-- כל גישה נכשלת עם "permission denied for table signatures" — גם אם
-- מדיניות ה-RLS למטה מוגדרת. בלי השורות האלה האתר לא יעבוד.
-- אין GRANT ל-DELETE — מחיקת חתימות חסומה לחלוטין.
grant select, insert, update on public.signatures to anon, authenticated;

-- כל אחד יכול לקרוא את החתימות (כדי שכל הדיירים יראו את ההתקדמות)
drop policy if exists "read_all" on public.signatures;
create policy "read_all"
  on public.signatures for select
  using (true);

-- כל אחד יכול להוסיף חתימה לדירה שעדיין לא קיימת בטבלה
drop policy if exists "insert_new" on public.signatures;
create policy "insert_new"
  on public.signatures for insert
  with check (true);

-- מותר לעדכן רק שורה שעדיין לא חתומה.
-- ברגע ש-signed=true — לא ניתן יותר לשנות אותה (הגנה מפני דריסת חתימה).
drop policy if exists "update_if_unsigned" on public.signatures;
create policy "update_if_unsigned"
  on public.signatures for update
  using (signed = false)
  with check (true);

-- הפעלת עדכונים בזמן אמת (Realtime) על הטבלה.
-- עטוף ב-DO כדי שהרצה חוזרת של הקובץ לא תיכשל אם הטבלה כבר במנוי.
do $$
begin
  alter publication supabase_realtime add table public.signatures;
exception
  when duplicate_object then null;  -- כבר במנוי — מתעלמים
end $$;
