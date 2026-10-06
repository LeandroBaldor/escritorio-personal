export type Status='todo'|'doing'|'done';
// calendar: fecha confirmada a mano en el calendario; null = se confirmó que la nota no tiene fecha.
export type NoteCalendar={date:string,time?:string};
export type Note={id:string;text:string;color:string,status:Status,history:{status:Status,at:string}[],archivedAt?:string,savedFolder?:string,savedOrder?:number,calendar?:NoteCalendar|null,calendarCategory?:EventCategory};
export type NoteFolder={id:string,name:string};
export type Page={id:string,text:string,createdAt:string};
export type Folder={id:string,name:string,pages:Page[]};
export type ExpenseCategory='Gastos mensuales'|'Médicos'|'Comida'|'Casa'|'Gastos personales'|'Otros';
export const EXPENSE_CATEGORIES:ExpenseCategory[]=['Gastos mensuales','Médicos','Comida','Casa','Gastos personales','Otros'];
// time y calendarCategory: hora y color con que el gasto aparece en el calendario (se editan desde ahí).
export type Expense={id:string,concept:string,cents:number,date?:string,category?:ExpenseCategory,paid?:boolean,month?:string,time?:string,calendarCategory?:EventCategory};
export type ExpenseMonth={id:string,name:string,expenses:Expense[]};
export type EventCategory='Salud'|'Pagos'|'Trabajo'|'Personal'|'Cumpleaños'|'Otros';
export const EVENT_CATEGORIES:EventCategory[]=['Salud','Pagos','Trabajo','Personal','Cumpleaños','Otros'];
export type CalendarEvent={id:string,text:string,date:string,time?:string,category:EventCategory};
export type Data={version:1,notes:Note[],folders:Folder[],expenses:Expense[],expenseMonths?:ExpenseMonth[],noteFolders?:NoteFolder[],events?:CalendarEvent[]};
export const EMPTY:Data={version:1,notes:[],folders:[],expenses:[]};
export const COLORS=['#ffe783','#f7b7c3','#bde7c6','#bcdcf6','#e3c5f4'];
export const PAGE_LIMIT=3000;
export const plainTextLength=(html:string)=>html.replace(/<[^>]*>/g,'').length;
export const id=()=>crypto.randomUUID();
const str=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const date=(v:unknown)=>typeof v==='string'&&!Number.isNaN(Date.parse(v));
export function isExpenseDate(v:unknown):v is string{if(typeof v!=='string')return false;const match=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return false;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);if(year<1||month<1||month>12||day<1)return false;const leap=year%4===0&&(year%100!==0||year%400===0);const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];return day<=days[month-1]}
const expense=(e:Expense)=>str(e?.id)&&str(e?.concept)&&Number.isSafeInteger(e?.cents)&&e.cents>=0&&(e.date===undefined||isExpenseDate(e.date))&&(e.category===undefined||EXPENSE_CATEGORIES.includes(e.category))&&(e.paid===undefined||typeof e.paid==='boolean')&&(e.month===undefined||isMonthKey(e.month))&&clock(e.time)&&(e.calendarCategory===undefined||EVENT_CATEGORIES.includes(e.calendarCategory));
const status=(v:unknown):v is Status=>v==='todo'||v==='doing'||v==='done';
const clock=(v:unknown)=>v===undefined||(typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v));
export function isData(v:unknown):v is Data{if(!v||typeof v!=='object')return false;const d=v as Data;if(d.version!==1||!Array.isArray(d.notes)||!Array.isArray(d.folders)||!Array.isArray(d.expenses))return false;return d.notes.every(n=>str(n?.id)&&str(n?.text)&&COLORS.includes(n?.color)&&status(n?.status)&&Array.isArray(n?.history)&&n.history.length>0&&n.history.every(h=>status(h?.status)&&date(h?.at))&&(n.archivedAt===undefined||date(n.archivedAt))&&(n.savedFolder===undefined||str(n.savedFolder))&&(n.savedOrder===undefined||Number.isFinite(n.savedOrder))&&(n.calendar===undefined||n.calendar===null||(isExpenseDate(n.calendar?.date)&&clock(n.calendar.time)))&&(n.calendarCategory===undefined||EVENT_CATEGORIES.includes(n.calendarCategory)))&&d.folders.every(f=>str(f?.id)&&str(f?.name)&&Array.isArray(f?.pages)&&f.pages.length>0&&f.pages.every(p=>str(p?.id)&&typeof p?.text==='string'&&date(p?.createdAt)&&plainTextLength(p.text)<=PAGE_LIMIT))&&d.expenses.every(expense)&&(d.expenseMonths===undefined||(Array.isArray(d.expenseMonths)&&d.expenseMonths.every(m=>str(m?.id)&&str(m?.name)&&Array.isArray(m?.expenses)&&m.expenses.every(expense))))&&(d.noteFolders===undefined||(Array.isArray(d.noteFolders)&&d.noteFolders.every(f=>str(f?.id)&&str(f?.name))))&&(d.events===undefined||(Array.isArray(d.events)&&d.events.every(e=>str(e?.id)&&str(e?.text)&&isExpenseDate(e?.date)&&clock(e.time)&&EVENT_CATEGORIES.includes(e?.category))))}
export function total(expenses:Expense[]){let sum=0;for(const e of expenses){if(!Number.isSafeInteger(e.cents)||e.cents<0||sum>Number.MAX_SAFE_INTEGER-e.cents)throw new Error('El total supera el máximo permitido.');sum+=e.cents}return sum}
export function totalsByCategory(expenses:Expense[]){const sums=Object.fromEntries(EXPENSE_CATEGORIES.map(c=>[c,0])) as Record<ExpenseCategory,number>;for(const e of expenses){const category=e.category&&EXPENSE_CATEGORIES.includes(e.category)?e.category:'Otros';if(!Number.isSafeInteger(e.cents)||e.cents<0||sums[category]>Number.MAX_SAFE_INTEGER-e.cents)throw new Error('El total supera el máximo permitido.');sums[category]+=e.cents}return sums}
// Acepta "311020,03", "311.020,03" (punto de miles) y "12.34" (punto decimal).
export function parseCents(value:string){let text=value.trim();if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text))text=text.replace(/\./g,'');const match=text.match(/^(\d+)(?:[.,](\d{1,2}))?$/);if(!match)return null;const whole=Number(match[1]),fraction=Number((match[2]??'').padEnd(2,'0'));if(!Number.isSafeInteger(whole)||whole>(Number.MAX_SAFE_INTEGER-fraction)/100)return null;const cents=whole*100+fraction;return Number.isSafeInteger(cents)?cents:null}
export const sameMonthName=(a:string,b:string)=>a.trim().toLocaleLowerCase('es')===b.trim().toLocaleLowerCase('es');
export const cleanMonthName=(name:string)=>parseMonthKey(name)??name.trim().replace(/\s+/g,' ');
export function appendToMonth(months:ExpenseMonth[],name:string,entries:Expense[]):ExpenseMonth[]{const existing=months.find(m=>sameMonthName(m.name,name));return existing?months.map(m=>m.id===existing.id?{...m,expenses:[...m.expenses,...entries]}:m):[...months,{id:id(),name:cleanMonthName(name),expenses:entries}]}
export const isMonthKey=(v:unknown):v is string=>typeof v==='string'&&/^(0[1-9]|1[0-2])\/\d{4}$/.test(v)&&Number(v.slice(3))>0;
export function parseMonthKey(value:string){const match=value.trim().match(/^(\d{1,2})\s*[/-]\s*(\d{4})$/);if(!match)return null;const key=`${match[1].padStart(2,'0')}/${match[2]}`;return isMonthKey(key)?key:null}
// Un gasto de la lista vive en una sola carpeta: guardarlo en otro mes lo saca de la anterior.
export function moveToMonth(months:ExpenseMonth[],key:string,expense:Expense):ExpenseMonth[]{const entry:Expense={...expense,month:key};if(!isMonthKey(key))delete entry.month;const rest=months.map(m=>m.expenses.some(e=>e.id===expense.id)?{...m,expenses:m.expenses.filter(e=>e.id!==expense.id)}:m);const target=rest.find(m=>sameMonthName(m.name,key));return target?rest.map(m=>m.id===target.id?{...m,expenses:[...m.expenses,entry]}:m):[...rest,{id:id(),name:key,expenses:[entry]}]}
export function syncMonthEntry(months:ExpenseMonth[]|undefined,expense:Expense){if(!months?.some(m=>m.expenses.some(e=>e.id===expense.id)))return months;return months.map(m=>({...m,expenses:m.expenses.map(e=>e.id===expense.id?{...expense,month:e.month}:e)}))}
const monthOrder=(name:string)=>isMonthKey(name)?Number(name.slice(3))*100+Number(name.slice(0,2)):Number.MAX_SAFE_INTEGER;
export const sortMonths=(months:ExpenseMonth[])=>[...months].sort((a,b)=>monthOrder(a.name)-monthOrder(b.name));
