import{ClipboardEvent,KeyboardEvent,useEffect,useRef,useState}from'react';import{CalculatorLink,DeskLink,SectionObjects}from'../../app/SectionObjects';import{useData}from'../../app/DataContext';import{id,PAGE_LIMIT,Page,plainTextLength}from'../../storage/model';
const pagesFor=(text:string):Page[]=>{const now=new Date().toISOString();const chunks=text.match(new RegExp(`[\\s\\S]{1,${PAGE_LIMIT}}`,'g'))??[''];return chunks.map(text=>({id:id(),text,createdAt:now}))};
const JOURNAL_GREEN='#1a7431';
const INK='#34271f';
// Emoticones del diario, agrupados.
const EMOJI_GROUPS:{name:string,emojis:string[]}[]=[
 {name:'Caras',emojis:['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😋','😜','🤪','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤯','😳','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','😶','😐','😑','😬','🙄','😯','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕']},
 {name:'Gestos',emojis:['👍','👎','👌','✌️','🤞','🤟','🤙','👋','👏','🙌','🤝','🙏','💪','✍️','🫶','🤲']},
 {name:'Corazones',emojis:['❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💔','💕','💞','💓','💗','💖','💘','💝']},
 {name:'Naturaleza',emojis:['🌞','🌝','🌙','⭐','🌟','✨','☁️','🌧️','⛈️','🌈','❄️','🔥','💧','🌊','🌸','🌻','🌹','🌷','🍀','🌱','🌳','🍂','🐶','🐱','🐦','🦋']},
 {name:'Comida',emojis:['☕','🍵','🧉','🍷','🍺','🥐','🍞','🍕','🍔','🍝','🥗','🍎','🍌','🍓','🍰','🍫','🍪','🍦']},
 {name:'Actividades',emojis:['🎵','🎶','🎧','🎸','🎹','📚','📖','✏️','🎨','🎬','📺','📱','💻','🏃','🚶','🧘','🏋️','⚽','🚴','🏊','🛌','🛁','🚗','✈️','🏠','🏥','💼','🎉','🎁','🎂']},
 {name:'Símbolos',emojis:['📌','📍','📅','⏰','💡','💰','💊','🩺','✅','❌','⚠️','❗','❓','💤','💯','➕','➖','⬆️','⬇️','🔔']}
];
const hexToRgb=(hex:string)=>{const n=parseInt(hex.slice(1),16);return `rgb(${(n>>16)&255}, ${(n>>8)&255}, ${n&255})`};
const splitPageHtml=(html:string):{text:string}[]=>{
 const container=document.createElement('div');container.innerHTML=html;
 const chunks:{text:string}[]=[];
 while(true){
  if((container.textContent??'').length<=PAGE_LIMIT){chunks.push({text:container.innerHTML});break}
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
  let count=0,node:Node|null,splitNode:Text|null=null,splitOffset=0;
  while((node=walker.nextNode())){const text=node as Text;if(count+text.data.length>=PAGE_LIMIT){splitNode=text;splitOffset=PAGE_LIMIT-count;break}count+=text.data.length}
  if(!splitNode){chunks.push({text:container.innerHTML});break}
  const range=document.createRange();range.setStart(container,0);range.setEnd(splitNode,splitOffset);
  const head=document.createElement('div');head.appendChild(range.cloneContents());
  chunks.push({text:head.innerHTML});range.deleteContents()
 }
 return chunks
};
export function Journal(){
 const{data,setData}=useData();
 const[selected,setSelected]=useState(data.folders[0]?.id??'');
 const[page,setPage]=useState(0);
 const folder=data.folders.find(f=>f.id===selected);
 const editableRef=useRef<HTMLDivElement>(null);
 const[emojiOpen,setEmojiOpen]=useState(false);
 const[activeFormats,setActiveFormats]=useState({bold:false,strike:false,green:false});
 useEffect(()=>{if(!data.folders.some(f=>f.id===selected)){setSelected(data.folders[0]?.id??'');setPage(0)}},[data.folders,selected]);
 useEffect(()=>{if(folder)setPage(p=>Math.min(p,Math.max(0,folder.pages.length-1)))},[folder]);
 useEffect(()=>{if(editableRef.current)editableRef.current.innerHTML=folder?.pages[page]?.text??''},[folder?.id,page]);
 const updateActiveFormats=()=>{
  const editable=editableRef.current;
  const selection=window.getSelection();
  if(!editable||!selection||selection.rangeCount===0||!editable.contains(selection.getRangeAt(0).commonAncestorContainer)){setActiveFormats({bold:false,strike:false,green:false});return}
  setActiveFormats({bold:document.queryCommandState('bold'),strike:document.queryCommandState('strikeThrough'),green:document.queryCommandValue('foreColor')===hexToRgb(JOURNAL_GREEN)});
 };
 useEffect(()=>{document.addEventListener('selectionchange',updateActiveFormats);return()=>document.removeEventListener('selectionchange',updateActiveFormats)},[]);
 const addFolder=()=>{const name=prompt('Nombre de la carpeta')?.trim();if(!name)return;const fid=id();setData(d=>({...d,folders:[...d.folders,{id:fid,name,pages:pagesFor('')}]}));setSelected(fid);setPage(0)};
 const renameFolder=()=>{if(!folder)return;const name=prompt('Nuevo nombre de la carpeta',folder.name)?.trim();if(!name)return;setData(d=>({...d,folders:d.folders.map(f=>f.id===folder.id?{...f,name}:f)}))};
 const deleteFolder=()=>{if(!folder||!confirm(`¿Borrar la carpeta “${folder.name}” y todas sus hojas?`))return;const index=data.folders.findIndex(f=>f.id===folder.id);const next=data.folders[index+1]??data.folders[index-1];setSelected(next?.id??'');setPage(0);setData(d=>({...d,folders:d.folders.filter(f=>f.id!==folder.id)}))};
 const write=(value:string)=>{if(!folder)return;const chunks=splitPageHtml(value);setData(d=>({...d,folders:d.folders.map(f=>{if(f.id!==folder.id)return f;const current=f.pages[page]??{id:id(),text:'',createdAt:new Date().toISOString()};const replacement=chunks.map((p,i)=>i===0?{...current,text:p.text}:{id:id(),text:p.text,createdAt:new Date().toISOString()});return{...f,pages:[...f.pages.slice(0,page),...replacement,...f.pages.slice(page+1)]}})}));if(chunks.length>1)setPage(page+chunks.length-1)};
 const syncFromEditable=()=>{if(editableRef.current)write(editableRef.current.innerHTML)};
 const applyBold=()=>{editableRef.current?.focus();document.execCommand('bold');syncFromEditable();updateActiveFormats()};
 const applyStrike=()=>{editableRef.current?.focus();document.execCommand('strikeThrough');syncFromEditable();updateActiveFormats()};
 const applyGreen=()=>{editableRef.current?.focus();const isGreen=document.queryCommandValue('foreColor')===hexToRgb(JOURNAL_GREEN);document.execCommand('foreColor',false,isGreen?INK:JOURNAL_GREEN);syncFromEditable();updateActiveFormats()};
 const insertAtCaret=(node:Node,lastChild:Node)=>{
  const selection=window.getSelection();
  if(!selection||selection.rangeCount===0)return;
  const range=selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  let caretNode=lastChild;
  // Chrome no ancla el caret dentro de un nodo de texto vacío tras un <br>; un espacio de ancho cero lo sostiene.
  if(lastChild.nodeName==='BR'){caretNode=document.createTextNode('​');range.setStartAfter(lastChild);range.collapse(true);range.insertNode(caretNode)}
  range.setStart(caretNode,caretNode.nodeType===Node.TEXT_NODE?(caretNode as Text).data.length:0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
 };
 const insertEmoji=(emoji:string)=>{
  const editable=editableRef.current;if(!editable)return;
  const selection=window.getSelection();
  // Si el cursor no está en la hoja, el emoticón va al final.
  if(!selection||selection.rangeCount===0||!editable.contains(selection.getRangeAt(0).commonAncestorContainer)){editable.focus();const range=document.createRange();range.selectNodeContents(editable);range.collapse(false);selection?.removeAllRanges();selection?.addRange(range)}
  const node=document.createTextNode(emoji);insertAtCaret(node,node);syncFromEditable();setEmojiOpen(false);
 };
 const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{if(event.key==='Enter'){event.preventDefault();const br=document.createElement('br');insertAtCaret(br,br);syncFromEditable()}};
 const onPaste=(event:ClipboardEvent<HTMLDivElement>)=>{
  event.preventDefault();
  const lines=event.clipboardData.getData('text/plain').split('\n');
  const fragment=document.createDocumentFragment();
  let last:Node=fragment.appendChild(document.createTextNode(lines[0]));
  for(let i=1;i<lines.length;i++){fragment.appendChild(document.createElement('br'));last=fragment.appendChild(document.createTextNode(lines[i]))}
  insertAtCaret(fragment,last);
  syncFromEditable();
 };
 return <section><div className="section-title"><div><p className="eyebrow">Recuerdos y pensamientos</p><h1>Mi diario</h1></div><SectionObjects><DeskLink /><CalculatorLink /></SectionObjects><button onClick={addFolder}>Nuevo diario</button></div><div className="journal-layout"><aside><h2>Carpetas</h2>{data.folders.map(f=><button className={selected===f.id?'active':''} onClick={()=>{setSelected(f.id);setPage(0)}} key={f.id}>{f.name}</button>)}</aside>{folder?<div className="journal-content"><div className="folder-actions" aria-label="Acciones de carpeta"><button onClick={renameFolder}>Editar nombre</button><button className="delete" onClick={deleteFolder}>Borrar diario</button></div><div className="book"><div className="book-ribbon" aria-hidden="true"/><div className="paper"><div className="page-meta">{folder.name} · Hoja {page+1} de {folder.pages.length}</div><div className="journal-toolbar" role="toolbar" aria-label="Formato de texto"><button type="button" aria-label="Negrita" aria-pressed={activeFormats.bold} onMouseDown={e=>e.preventDefault()} onClick={applyBold}><strong>N</strong></button><button type="button" aria-label="Tachado" aria-pressed={activeFormats.strike} onMouseDown={e=>e.preventDefault()} onClick={applyStrike}><span style={{textDecoration:'line-through'}}>T</span></button><button type="button" aria-label="Verde" aria-pressed={activeFormats.green} onMouseDown={e=>e.preventDefault()} onClick={applyGreen}><span style={{color:JOURNAL_GREEN,fontWeight:700}}>V</span></button><span className="emoji-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setEmojiOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'){setEmojiOpen(false);editableRef.current?.focus()}}}><button type="button" aria-label="Emoticones" aria-haspopup="true" aria-expanded={emojiOpen} onMouseDown={e=>e.preventDefault()} onClick={()=>setEmojiOpen(o=>!o)}><span aria-hidden="true">🙂</span></button>{emojiOpen&&<span className="emoji-grid" role="group" aria-label="Elegí un emoticón">{EMOJI_GROUPS.map(group=><span className="emoji-group" role="group" aria-label={group.name} key={group.name}><span className="emoji-group-name" aria-hidden="true">{group.name}</span>{group.emojis.map(emoji=><button type="button" key={emoji} aria-label={emoji} onMouseDown={e=>e.preventDefault()} onClick={()=>insertEmoji(emoji)}>{emoji}</button>)}</span>)}</span>}</span></div><div ref={editableRef} className="page-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Página del diario" data-placeholder="Escribí aquí lo que quieras recordar…" onInput={syncFromEditable} onKeyDown={onKeyDown} onPaste={onPaste}/><small>{plainTextLength(folder.pages[page]?.text??'')} / {PAGE_LIMIT}</small></div><div className="page-buttons"><button type="button" className="page-nav" disabled={page===0} onClick={()=>setPage(p=>p-1)}>‹ Anterior</button><div className="page-numbers">{folder.pages.map((p,i)=><button type="button" key={p.id} className={'page-number'+(i===page?' active':'')} aria-current={i===page?'page':undefined} onClick={()=>setPage(i)}>{i+1}</button>)}</div><button type="button" className="page-nav" disabled={page>=folder.pages.length-1} onClick={()=>setPage(p=>p+1)}>Siguiente ›</button></div></div></div>:<div className="empty"><h2>Tu diario está listo</h2><p>Creá una carpeta para comenzar a escribir.</p><button onClick={addFolder}>Crear mi primera carpeta</button></div>}</div></section>
}
