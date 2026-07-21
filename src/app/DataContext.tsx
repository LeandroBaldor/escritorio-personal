import {createContext,useContext,useEffect,useState,ReactNode} from 'react'; import {Data} from '../storage/model'; import {load,save} from '../storage/store';
type Ctx={data:Data,setData:React.Dispatch<React.SetStateAction<Data>>,warning?:string}; const Context=createContext<Ctx|null>(null);
export function DataProvider({children}:{children:ReactNode}){const [initial]=useState(load);const[data,setData]=useState(initial.data);const[warning,setWarning]=useState(initial.warning);useEffect(()=>{const issue=save(data);if(issue)setWarning(issue)},[data]);return <Context.Provider value={{data,setData,warning}}>{children}</Context.Provider>}
export const useData=()=>{const c=useContext(Context);if(!c)throw Error('DataProvider faltante');return c};
