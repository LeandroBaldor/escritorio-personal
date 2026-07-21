import {Data,EMPTY,isData} from './model';
const KEY='escritorio-personal-v1', BAD='escritorio-personal-corrupto';
const userKey=(userId:string)=>`${KEY}:${userId}`;
const MIGRATION=`${KEY}:migration-decided`;
export function load():{data:Data;warning?:string}{let raw:string|null;try{raw=localStorage.getItem(KEY)}catch{return{data:structuredClone(EMPTY),warning:'El navegador bloqueó el almacenamiento local. Los cambios podrían no conservarse.'}}if(!raw)return{data:structuredClone(EMPTY)};try{const parsed:unknown=JSON.parse(raw);if(!isData(parsed))throw Error();return{data:parsed}}catch{try{localStorage.setItem(BAD,raw)}catch{return{data:structuredClone(EMPTY),warning:'Los datos locales están dañados y no se pudo guardar una copia de diagnóstico.'}}return{data:structuredClone(EMPTY),warning:'Encontramos datos dañados. Guardamos una copia para diagnóstico y comenzamos de forma segura.'}}}
export function save(data:Data){try{localStorage.setItem(KEY,JSON.stringify(data));return undefined}catch{return'No pudimos guardar los cambios en este dispositivo. Revisá el espacio o los permisos del navegador.'}}
export function loadForUser(userId:string):{data:Data;warning?:string;exists:boolean}{try{const raw=localStorage.getItem(userKey(userId));if(!raw)return{data:structuredClone(EMPTY),exists:false};const parsed:unknown=JSON.parse(raw);if(!isData(parsed))throw Error();return{data:parsed,exists:true}}catch{return{data:structuredClone(EMPTY),exists:false,warning:'La caché de esta cuenta no es válida o no está disponible.'}}}
export function saveForUser(userId:string,data:Data){try{localStorage.setItem(userKey(userId),JSON.stringify(data));return undefined}catch{return'No pudimos guardar la caché de esta cuenta en este dispositivo.'}}
export function migrationDecided(){try{return localStorage.getItem(MIGRATION)==='done'}catch{return false}}
export function markMigrationDecided(){try{localStorage.setItem(MIGRATION,'done')}catch{/* La fila remota ya protege contra una segunda importación. */}}
export function serialize(data:Data){return JSON.stringify(data,null,2)}
export function parseBackup(raw:string){const value:unknown=JSON.parse(raw);if(!isData(value))throw new Error('La copia no pertenece a una versión compatible.');return value}
