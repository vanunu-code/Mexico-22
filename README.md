# אסיפת דיירים — מכסיקו 22

אפליקציית חתימות דיגיטליות לבעלי דירות, עם אחסון אמיתי ב-**Supabase** (מסד נתונים שלך).
החתימות משותפות בין כל הדיירים ומתעדכנות בזמן אמת.

> בעבר האפליקציה השתמשה ב-`window.storage` של Claude (עובד רק בתוך claude.ai).
> עכשיו האחסון הוא במסד נתונים שבבעלותך — האפליקציה עובדת בכל מקום שבו תארח אותה.

---

## שלב 1 — יצירת פרויקט Supabase (חינמי)

1. היכנס ל-https://supabase.com והירשם (אפשר עם חשבון GitHub).
2. לחץ **New Project**, תן שם (למשל `mexico22`), בחר סיסמה למסד הנתונים ואזור (Frankfurt קרוב לישראל).
3. המתן כדקה עד שהפרויקט נוצר.

## שלב 2 — יצירת הטבלה

1. בתפריט הצד של Supabase: **SQL Editor** → **New query**.
2. הדבק את כל התוכן של הקובץ [`schema.sql`](./schema.sql) ולחץ **Run**.
3. אמורה להיווצר טבלה בשם `signatures`.

## שלב 3 — חיבור האפליקציה למסד הנתונים

1. ב-Supabase: **Project Settings** (גלגל השיניים) → **API**.
2. העתק שני ערכים:
   - **Project URL**
   - **anon public** key (תחת Project API keys)
3. בתיקיית הפרויקט, צור קובץ בשם `.env` (העתק מ-`.env.example`) ומלא:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
   > מפתח ה-`anon` הוא ציבורי ומיועד לצד הלקוח — מותר לחשוף אותו. ההגנה על המידע נעשית דרך מדיניות ה-RLS שב-`schema.sql`.

## שלב 4 — הרצה מקומית

```bash
npm install
npm run dev
```
פתח את הכתובת שמופיעה (בדרך כלל http://localhost:5173).

## שלב 5 — העלאה לאוויר (כדי לשתף קישור לדיירים)

הדרך הקלה ביותר — **Vercel** (חינם):

1. העלה את הפרויקט ל-GitHub.
2. היכנס ל-https://vercel.com, התחבר עם GitHub, ולחץ **Add New → Project**, בחר את המאגר.
3. תחת **Environment Variables** הוסף את אותם שני ערכים מה-`.env`
   (`VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`).
4. לחץ **Deploy**. בסיום תקבל כתובת שאפשר לשלוח לכל הדיירים.

> חלופות: Netlify או Cloudflare Pages — אותו עיקרון (build command: `npm run build`, output: `dist`).

---

## איך זה עובד

- כל חתימה נשמרת כשורה בטבלה `signatures` (דירה אחת = שורה אחת).
- בעת פתיחת הקישור, האפליקציה טוענת את כל החתימות ומציגה התקדמות.
- חתימות חדשות מופיעות אצל כולם **בזמן אמת** (Supabase Realtime).
- לאחר שדירה חתמה, **לא ניתן לדרוס אותה** — נאכף ברמת מסד הנתונים (מדיניות `update_if_unsigned`).

## צפייה בנתונים

ב-Supabase: **Table Editor** → `signatures` — שם תראה את כל החתימות שנאספו.
