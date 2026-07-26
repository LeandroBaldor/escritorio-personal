import{ClipboardEvent,KeyboardEvent,useEffect,useRef,useState}from'react';import{useData}from'../../app/DataContext';import{id,PAGE_LIMIT,Page,plainTextLength}from'../../storage/model';
const pagesFor=(text:string):Page[]=>{const now=new Date().toISOString();const chunks=text.match(new RegExp(`[\\s\\S]{1,${PAGE_LIMIT}}`,'g'))??[''];return chunks.map(text=>({id:id(),text,createdAt:now}))};
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
 useEffect(()=>{if(!data.folders.some(f=>f.id===selected)){setSelected(data.folders[0]?.id??'');setPage(0)}},[data.folders,selected]);
 useEffect(()=>{if(folder)setPage(p=>Math.min(p,Math.max(0,folder.pages.length-1)))},[folder]);
 useEffect(()=>{if(editableRef.current)editableRef.current.innerHTML=folder?.pages[page]?.text??''},[folder?.id,page]);
 const addFolder=()=>{const name=prompt('Nombre de la carpeta')?.trim();if(!name)return;const fid=id();setData(d=>({...d,folders:[...d.folders,{id:fid,name,pages:pagesFor('')}]}));setSelected(fid);setPage(0)};
 const renameFolder=()=>{if(!folder)return;const name=prompt('Nuevo nombre de la carpeta',folder.name)?.trim();if(!name)return;setData(d=>({...d,folders:d.folders.map(f=>f.id===folder.id?{...f,name}:f)}))};
 const deleteFolder=()=>{if(!folder||!confirm(`¿Borrar la carpeta “${folder.name}” y todas sus hojas?`))return;const index=data.folders.findIndex(f=>f.id===folder.id);const next=data.folders[index+1]??data.folders[index-1];setSelected(next?.id??'');setPage(0);setData(d=>({...d,folders:d.folders.filter(f=>f.id!==folder.id)}))};
 const write=(value:string)=>{if(!folder)return;const chunks=splitPageHtml(value);setData(d=>({...d,folders:d.folders.map(f=>{if(f.id!==folder.id)return f;const current=f.pages[page]??{id:id(),text:'',createdAt:new Date().toISOString()};const replacement=chunks.map((p,i)=>i===0?{...current,text:p.text}:{id:id(),text:p.text,createdAt:new Date().toISOString()});return{...f,pages:[...f.pages.slice(0,page),...replacement,...f.pages.slice(page+1)]}})}));if(chunks.length>1)setPage(page+chunks.length-1)};
 const syncFromEditable=()=>{if(editableRef.current)write(editableRef.current.innerHTML)};
 const applyBold=()=>{editableRef.current?.focus();document.execCommand('bold');syncFromEditable()};
 const applyOverline=()=>{
  const editable=editableRef.current;
  const selection=window.getSelection();
  if(!editable||!selection||selection.rangeCount===0||selection.isCollapsed)return;
  const range=selection.getRangeAt(0);
  if(!editable.contains(range.commonAncestorContainer))return;
  const ancestor=(range.commonAncestorContainer.nodeType===Node.TEXT_NODE?range.commonAncestorContainer.parentElement:range.commonAncestorContainer as Element);
  const existing=ancestor?.closest('span.overline');
  if(existing&&editable.contains(existing)&&existing.textContent===selection.toString()){
   const parent=existing.parentNode;
   if(parent){while(existing.firstChild)parent.insertBefore(existing.firstChild,existing);parent.removeChild(existing)}
  }else{
   const span=document.createElement('span');span.className='overline';
   try{range.surroundContents(span)}
   catch{const fragment=range.extractContents();span.appendChild(fragment);range.insertNode(span)}
  }
  syncFromEditable()
 };
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
 return <section><div className="section-title"><div><p className="eyebrow">Recuerdos y pensamientos</p><h1>Mi diario</h1></div><button onClick={addFolder}>Nuevo diario</button></div><div className="journal-layout"><aside><h2>Carpetas</h2>{data.folders.map(f=><button className={selected===f.id?'active':''} onClick={()=>{setSelected(f.id);setPage(0)}} key={f.id}>{f.name}</button>)}</aside>{folder?<div className="journal-content"><div className="folder-actions" aria-label="Acciones de carpeta"><button onClick={renameFolder}>Editar nombre</button><button className="delete" onClick={deleteFolder}>Borrar diario</button></div><div className="book"><div className="book-ribbon" aria-hidden="true"/><div className="paper"><div className="page-meta">{folder.name} · Hoja {page+1} de {folder.pages.length}</div><div className="journal-toolbar" role="toolbar" aria-label="Formato de texto"><button type="button" aria-label="Negrita" onMouseDown={e=>e.preventDefault()} onClick={applyBold}><strong>N</strong></button><button type="button" aria-label="Línea arriba" onMouseDown={e=>e.preventDefault()} onClick={applyOverline}><span className="overline">L</span></button></div><div ref={editableRef} className="page-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Página del diario" data-placeholder="Escribí aquí lo que quieras recordar…" onInput={syncFromEditable} onKeyDown={onKeyDown} onPaste={onPaste}/><small>{plainTextLength(folder.pages[page]?.text??'')} / {PAGE_LIMIT}</small></div><div className="page-buttons"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Hoja anterior</button><span aria-hidden="true">— {page+1} —</span><button disabled={page>=folder.pages.length-1} onClick={()=>setPage(p=>p+1)}>Hoja siguiente →</button></div></div></div>:<div className="empty"><h2>Tu diario está listo</h2><p>Creá una carpeta para comenzar a escribir.</p><button onClick={addFolder}>Crear mi primera carpeta</button></div>}</div></section>
}
