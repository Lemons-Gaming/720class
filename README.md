# יום ראשון, שיעור ראשון — Web Visual Novel

visual novel חינוכי בעברית (RTL) על ניהול זמן, הסחות ובקשת עזרה ביום
הראשון בכיתת 720. וניל JS, ללא build, רץ בכל דפדפן, ניתן להטמעה ב-iframe.

## הרצה מקומית

ES Modules לא רצים דרך `file://` — צריך שרת סטטי פשוט. מהתיקייה `game/`:

```bash
python -m http.server 8720
# ואז לפתוח בדפדפן:  http://localhost:8720/index.html
```

(כל שרת סטטי אחר יעבוד גם — `npx serve`, Live Server ב-VS Code וכו'.)

> **בזמן פיתוח:** אם שינית CSS ולא רואים שינוי — רענון קשה (Ctrl+Shift+R),
> או העלה את מספר הגרסה ב-`index.html` (`?v=2` → `?v=3`) בקישורי ה-CSS.

## הטמעה באתר (Wix / Google Sites / כל אתר)

מדריך ההנחיה העצמאי למורות ולמורים זמין ב-`teacher-guide.html`.

העלו את תיקיית `game/` לשרת/אחסון, והטמיעו:

```html
<iframe src="https://YOUR-HOST/game/index.html"
        style="width:100%; max-width:960px; aspect-ratio:16/9; border:0; border-radius:18px;"
        allow="autoplay" title="יום ראשון, שיעור ראשון"></iframe>
```

אפשר לצמצם משקל: אין צורך להעלות את `assets/_source/` (המקוריים הכבדים) —
רק את `assets/{chars,bg,moments,endings}`.

## עריכת טקסט והוספת סצנות

כל הטקסט נמצא ב-`js/story.js` בלבד (דאטה טהור, בלי לוגיקה). כל צומת:

```js
node_id: {
  place:'home'|'class'|'hall',      // רקע מקום שמגיב ללחץ (רגוע/לחוץ)
  bg:'home_late',                    // או רקע קבוע לפי שם (עוקף place)
  tag:'סצנה … · …',
  beats:[ { speaker, name, line, emotion?, flag?, ifTrue?, ifFalse?, tpl?, moment? } ],
  choices:[ { t, hint?, d:{control,energy,stress,fun,time}, set:{flag:val}, to } ],
  // או:
  continue:'next_id',                // מעבר יחיד
  minigame:true, to:'next_id',       // צומת שמפעיל מיני-משחק אקראי
}
```

- `speaker`: `narrator | inner | michal | dana | yoav | bot | you`
- `emotion` (לדמות): michal `calm|worried|warm` · dana `neutral|excited|grin`
  · yoav `neutral|overwhelmed|relief` · bot `friendly|thinking`
- `moment` (קלוז-אפ לביט): `stuck | phone_temptation | solo_win | yoav_needs_help`
- **מגדר:** כותבים שתי צורות בסוגריים מסולסלים — `{זכר/נקבה}`.
  דוגמה: `"אני כבר {מת/מתה} לשחק"` · `"נכנס{/ת}"`.
- **טקסט מותנה:** `flag` + `ifTrue`/`ifFalse`. `tpl:true` שותל את המטרה (`{{goal}}`).

## מדים ומנגנונים (לא לשנות בלי כוונה)

- מדים 0–10, התחלה `control:5, energy:7, stress:3, fun:5`. טיימר 45 דק'.
- כישלון: לחץ≥10 · אנרגיה≤0 · זמן≤0. סיום מתגמל **איזון** בין המדים.
- מיני-משחקים אמיתיים (`js/minigames/`) אוכלים מהזמן הגלובלי בזמן אמת.

## החלפת נכסים (תמונות)

1. שמרו את התמונה החדשה בשורש הפרויקט בשם המספרי (`14.png`, `15.png`, …).
2. הריצו:  `python scripts/optimize_assets.py`
3. הסקריפט מקטין ל-WebP וממפה לשם משמעותי תחת `assets/`.

מיפוי המספרים:

| # | קובץ | # | קובץ | # | קובץ |
|---|------|---|------|---|------|
| 1 | michal_calm | 11 | bot_thinking | 21 | exit_ticket |
| 2 | michal_worried | 12 | home_calm | 22 | stuck |
| 3 | michal_warm | 13 | home_late | 23 | phone_temptation |
| 4 | dana_neutral | 14 | class_calm | 24 | solo_win |
| 5 | dana_excited | 15 | class_stressed | 25 | yoav_needs_help |
| 6 | dana_grin | 16 | tasks_screen | 26 | ending_balanced |
| 7 | yoav_neutral | 17 | hall_calm | 27 | ending_timeout |
| 8 | yoav_overwhelmed | 18 | hall_busy | | |
| 9 | yoav_relief | 19 | court | | |
| 10 | bot_friendly | 20 | mentor_corner | | |

> פרומפטים חלופיים לתמונות הכיתה: `../classroom_prompts.md`.

## קול ושמירה

- **קול:** מיוצר בקוד (WebAudio) — אין קבצי אודיו. כפתור קול בהגדרות (נשמר).
- **שמירה:** localStorage, סלוט יחיד, שמירה אוטומטית בכל צומת; "המשך" בתפריט.

## מבנה הקוד

```
index.html · css/{style,hud}.css
js/ story.js  engine.js  present.js  hud.js  ui.js  save.js  endings.js  audio.js  assets.js
   minigames/ index.js breakout.js snake.js blocks.js
assets/ chars/ bg/ moments/ endings/ (_source/ = מקוריים, לא נדרש להטמעה)
```
