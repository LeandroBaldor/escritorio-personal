export type Status='todo'|'doing'|'done';
export type Note={id:string;text:string;color:string,status:Status,history:{status:Status,at:string}[]};
export type Page={id:string,text:string,createdAt:string};
export type Folder={id:string,name:string,pages:Page[]};
export type Expense={id:string,concept:string,cents:number,date?:string};
export type Data={version:1,notes:Note[],folders:Folder[],expenses:Expense[]};
export const EMPTY:Data={version:1,notes:[],folders:[],expenses:[]};
export const COLORS=['#ffe783','#f7b7c3','#bde7c6','#bcdcf6','#e3c5f4'];
export const PAGE_LIMIT=1200;
export const id=()=>crypto.randomUUID();
const str=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const date=(v:unknown)=>typeof v==='string'&&!Number.isNaN(Date.parse(v));
export function isExpenseDate(v:unknown):v is string{if(typeof v!=='string')return false;const match=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return false;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);if(year<1||month<1||month>12||day<1)return false;const leap=year%4===0&&(year%100!==0||year%400===0);const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];return day<=days[month-1]}
const status=(v:unknown):v is Status=>v==='todo'||v==='doing'||v==='done';
export function isData(v:unknown):v is Data{if(!v||typeof v!=='object')return false;const d=v as Data;if(d.version!==1||!Array.isArray(d.notes)||!Array.isArray(d.folders)||!Array.isArray(d.expenses))return false;return d.notes.every(n=>str(n?.id)&&str(n?.text)&&COLORS.includes(n?.color)&&status(n?.status)&&Array.isArray(n?.history)&&n.history.length>0&&n.history.every(h=>status(h?.status)&&date(h?.at)))&&d.folders.every(f=>str(f?.id)&&str(f?.name)&&Array.isArray(f?.pages)&&f.pages.length>0&&f.pages.every(p=>str(p?.id)&&typeof p?.text==='string'&&date(p?.createdAt)&&p.text.length<=PAGE_LIMIT))&&d.expenses.every(e=>str(e?.id)&&str(e?.concept)&&Number.isSafeInteger(e?.cents)&&e.cents>=0&&(e.date===undefined||isExpenseDate(e.date)))}
export function total(expenses:Expense[]){let sum=0;for(const e of expenses){if(!Number.isSafeInteger(e.cents)||e.cents<0||sum>Number.MAX_SAFE_INTEGER-e.cents)throw new Error('El total supera el máximo permitido.');sum+=e.cents}return sum}
export function parseCents(value:string){const match=value.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);if(!match)return null;const whole=Number(match[1]),fraction=Number((match[2]??'').padEnd(2,'0'));if(!Number.isSafeInteger(whole)||whole>(Number.MAX_SAFE_INTEGER-fraction)/100)return null;const cents=whole*100+fraction;return Number.isSafeInteger(cents)?cents:null}
