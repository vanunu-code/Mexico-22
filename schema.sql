-- ============================================================
-- מבנה מסד הנתונים עבור אפליקציית החתימות (מכסיקו 22)
-- הרץ את הקובץ הזה ב-Supabase: SQL Editor → New query → הדבק → Run
-- ============================================================

-- טבלת חתימות: שורה אחת לכל דירה שחתמה
create table if not exists public.signatures (
  apt        integer primary key,          -- מספר הדירה (1..32)
  name       text,                         -- שם בעל הדירה
  phone      text,                         -- טלפון (אופציונלי)
  signed     boolean not null default false,
  signed_at  text,                         -- תאריך ושעה של החתימה (טקסט בעברית)
  drawing    text,                         -- נתוני החתימה (מסלולי SVG)
  created_at timestamptz not null default now()
);

-- הפעלת אבטחת שורות (Row Level Security)
alter table public.signatures enable row level security;

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

-- הפעלת עדכונים בזמן אמת (Realtime) על הטבלה
alter publication supabase_realtime add table public.signatures;
