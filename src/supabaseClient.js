import { createClient } from "@supabase/supabase-js";

// הערכים נטענים מקובץ .env (ראה .env.example).
// אלה מפתחות ציבוריים (anon) — מותר לחשוף אותם בצד הלקוח.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "חסרים פרטי Supabase. ודא שקיים קובץ .env עם VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// שם הטבלה במסד הנתונים
export const SIGNATURES_TABLE = "signatures";
