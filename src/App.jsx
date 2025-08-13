import React, {useEffect, useMemo, useRef, useState} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Download, Upload, Plus, Trash2, Edit3, Save, X, Archive, Settings, Undo2, Search, Calendar as CalendarIcon, Sun, Moon, ChevronRight, ChevronLeft, ChevronDown, ListChecks, SlidersHorizontal, DollarSign, CreditCard, Gift, Filter, FileDown, FileUp, Ban, CheckCircle, Circle, MoreVertical } from "lucide-react";

/*****************************
 * Utility & Storage Helpers *
 *****************************/
// Keys used in localStorage
const LS_KEY = "eduardo_budget_tracker_v1";
const UNDO_KEY = "eduardo_budget_tracker_undo";

const now = new Date();

// Default data for the application.  Added an emergencyReserve property and set the
// second payment day to the 15th.  Users can change this later in the settings.
const defaultData = {
  theme: "light",
  currency: "USD",
  income: {
    schedule: {
      firstPaymentDay: 30,
      secondPaymentDay: 15, // always on the 15th
      bonusMonths: [4, 9], // April, September (1-based)
    },
    payments: {
      first: 8125.04,
      second: 7580.03,
      febFirst: 7580.04,
    },
    bonus: {
      april: 8000,
      september: 45000,
    }
  },
  emergencyReserve: 100, // minimum cash to keep unallocated
  categories: [
    // 1st Payment
    { id: "cat_tesla", name: "Tesla", cycle: "first", planned: 562.72, color: "#4F46E5", status: "active", type:"fixed" },
    { id: "cat_supercharger", name: "Tesla SuperCharger", cycle: "first", planned: 0, color: "#0EA5E9", status: "active", type:"variable" },
    { id: "cat_att", name: "AT&T", cycle: "first", planned: 136, color: "#10B981", status: "active", type:"variable" },
    { id: "cat_xfinity", name: "XFinity", cycle: "first", planned: 136, color: "#F59E0B", status: "active", type:"fixed" },
    { id: "cat_gardener", name: "Ramiro Jardinero", cycle: "first", planned: 150, color: "#EF4444", status: "active", type:"variable" },
    { id: "cat_pool", name: "Piscinero Wendell", cycle: "first", planned: 170, color: "#A855F7", status: "active", type:"fixed" },
    { id: "cc_capone_qs", name: "Capital One QuickSilver", cycle: "first", planned: 0, color: "#14B8A6", status: "active", type:"debt" },
    { id: "cc_citi_simp", name: "Citi Simplicity Personal", cycle: "first", planned: 0, color: "#22C55E", status: "active", type:"debt" },
    { id: "cc_citi_plat", name: "Citi Platinum Preferred", cycle: "first", planned: 0, color: "#8B5CF6", status: "active", type:"debt" },
    { id: "cc_chase", name: "Chase Credit Card", cycle: "first", planned: 0, color: "#6366F1", status: "active", type:"debt" },
    { id: "debit_olgana", name: "Debit to Olgana", cycle: "first", planned: 300, color: "#F97316", status: "active", type:"fixed" },
    // 2nd Payment
    { id: "mass_mutual", name: "Mass Mutual", cycle: "second", planned: 264, color: "#60A5FA", status: "active", type:"fixed" },
    { id: "food", name: "Food", cycle: "second", planned: 800, color: "#34D399", status: "active", type:"variable" },
    { id: "geico", name: "Geico", cycle: "second", planned: 550, color: "#FBBF24", status: "active", type:"variable" },
    { id: "mortgage", name: "Mortgage", cycle: "second", planned: 3241, color: "#F472B6", status: "active", type:"fixed" },
    { id: "citi_wizeline", name: "Citi Simplicity (Wizeline)", cycle: "second", planned: 0, color: "#93C5FD", status: "active", type:"debt" },
    { id: "claude", name: "Claude (Anthropic)", cycle: "second", planned: 20, color: "#FDE68A", status: "active", type:"fixed" },
    { id: "extra_cc", name: "Additional Credit Card Payments", cycle: "second", planned: 0, color: "#A7F3D0", status: "active", type:"debt" },
    // Bonus
    { id: "bonus_home", name: "Home Improvements", cycle: "bonus", planned: 0, color: "#7C3AED", status: "active", type:"bucket" },
    { id: "bonus_family", name: "Family Support", cycle: "bonus", planned: 0, color: "#DB2777", status: "active", type:"bucket" },
    { id: "bonus_business", name: "Business Investments (Hummus Haven)", cycle: "bonus", planned: 0, color: "#2563EB", status: "active", type:"bucket" },
    { id: "bonus_vehicle", name: "Vehicle Purchases", cycle: "bonus", planned: 0, color: "#059669", status: "active", type:"bucket" },
    { id: "bonus_cc", name: "Credit Card Payoffs", cycle: "bonus", planned: 0, color: "#DC2626", status: "active", type:"bucket" },
    { id: "bonus_emergency", name: "Emergency Fund Transfer", cycle: "bonus", planned: 0, color: "#1F2937", status: "active", type:"bucket" },
  ],
  transactions: [],
  archivedCategoryIds: [],
  deletedCategoryIds: [],
  order: {
    first: ["cat_tesla","cat_supercharger","cat_att","cat_xfinity","cat_gardener","cat_pool","cc_capone_qs","cc_citi_simp","cc_citi_plat","cc_chase","debit_olgana"],
    second: ["mass_mutual","food","geico","mortgage","citi_wizeline","claude","extra_cc"],
    bonus: ["bonus_home","bonus_family","bonus_business","bonus_vehicle","bonus_cc","bonus_emergency"],
  }
};

// Load state from localStorage or use default
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultData;
    const parsed = JSON.parse(raw);
    return { ...defaultData, ...parsed };
  }catch(e){
    return defaultData;
  }
}
function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function pushUndo(state){
  const stackRaw = localStorage.getItem(UNDO_KEY);
  const stack = stackRaw ? JSON.parse(stackRaw) : [];
  stack.push(state);
  if(stack.length>30) stack.shift();
  localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
}
function popUndo(){
  const stackRaw = localStorage.getItem(UNDO_KEY);
  const stack = stackRaw ? JSON.parse(stackRaw) : [];
  const last = stack.pop();
  localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
  return last;
}

/*******************
 * UI Helpers      *
 *******************/
const Badge = ({ children, tone="default" }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full border ${tone==="active"?"bg-green-50 border-green-200 text-green-700": tone==="archived"?"bg-amber-50 border-amber-200 text-amber-700": tone==="deleted"?"bg-rose-50 border-rose-200 text-rose-700":"bg-slate-50 border-slate-200 text-slate-600"}`}>{children}</span>
);

const IconBtn = ({icon:Icon,label,className="",...props}) => (
  <button title={label} aria-label={label} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm hover:shadow transition active:scale-[.98] ${className}`} {...props}>
    <Icon className="h-4 w-4"/>
    <span className="hidden sm:inline text-sm">{label}</span>
  </button>
);

/*********************
 * Sortable Item Card *
 *********************/
function SortableItem({id,children}){
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id});
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

/****************
 * Main App UI  *
 ****************/
export default function App(){
  const [state, setState] = useState(loadState());
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [quickEdit, setQuickEdit] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [contextFor, setContextFor] = useState(null);
  // New: filter to show only first or second cycle in overview
  const [cycleFilter, setCycleFilter] = useState(null); // null=all, 'first' or 'second'

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  useEffect(()=>{ saveState(state); },[state]);

  const themeClass = state.theme === "dark" ? "dark" : "";

  // Derived totals
  const categoriesByCycle = useMemo(()=>({
    first: state.categories.filter(c=>c.cycle==="first" && c.status!=="deleted"),
    second: state.categories.filter(c=>c.cycle==="second" && c.status!=="deleted"),
    bonus: state.categories.filter(c=>c.cycle==="bonus" && c.status!=="deleted"),
  }),[state.categories]);

  const plannedTotals = useMemo(()=>({
    first: categoriesByCycle.first.reduce((s,c)=>s+(c.status==="active"?Number(c.planned||0):0),0),
    second: categoriesByCycle.second.reduce((s,c)=>s+(c.status==="active"?Number(c.planned||0):0),0),
    bonus: categoriesByCycle.bonus.reduce((s,c)=>s+(c.status==="active"?Number(c.planned||0):0),0),
  }),[categoriesByCycle]);

  const incomeMonthly = useMemo(()=>{
    const isFeb = (new Date()).getMonth()===1;
    const first = isFeb ? state.income.payments.febFirst : state.income.payments.first;
    return { first, second: state.income.payments.second };
  },[state.income]);

  const remaining = useMemo(()=>({
    first: (incomeMonthly.first - plannedTotals.first),
    second: (incomeMonthly.second - plannedTotals.second)
  }),[incomeMonthly, plannedTotals]);

  function setAndUndo(updater){
    pushUndo(state);
    setState(prev=> {
      const next = typeof updater === 'function'? updater(prev) : updater;
      return next;
    });
  }
  function undo(){
    const prev = popUndo();
    if(prev){ setState(prev); }
  }
  function toggleTheme(){ setState(s=>({...s, theme: s.theme==="dark"?"light":"dark"})); }

  function addCategory(cycle){
    const name = prompt("Category name?");
    if(!name) return;
    const planned = Number(prompt("Budgeted amount (number)?", "0"))||0;
    const id = `cat_${Math.random().toString(36).slice(2,9)}`;
    const color = randomColor();
    setAndUndo(prev=>{
      const cat = { id, name, cycle, planned, color, status:"active", type:"variable" };
      return { ...prev, categories: [...prev.categories, cat], order: { ...prev.order, [cycle]: [...(prev.order[cycle]||[]), id] } };
    });
  }

  function updateCategory(id, patch){
    setAndUndo(prev=> ({...prev, categories: prev.categories.map(c=> c.id===id? {...c, ...patch }: c)}));
  }
  function archiveCategory(id){ updateCategory(id,{status:"archived"}); }
  function activateCategory(id){ updateCategory(id,{status:"active"}); }

  // Two-step delete: first prompt, then confirm
  function removeCategory(id){
    const cat = state.categories.find(c=>c.id===id);
    if(!cat) return;
    setConfirm({ type: "deletePrompt", payload: { id, name: cat.name } });
  }

  function permanentlyDeleteCategory(id){
    setAndUndo(prev=> ({
      ...prev,
      categories: prev.categories.filter(c=>c.id!==id),
      deletedCategoryIds: [...prev.deletedCategoryIds, id],
      order: Object.fromEntries(Object.entries(prev.order).map(([k,arr])=>[k, arr.filter(cid=>cid!==id)]))
    }));
  }

  function onDragEnd(event, cycle){
    const {active, over} = event;
    if(!over || active.id===over.id) return;
    setAndUndo(prev=> {
      const old = prev.order[cycle] || [];
      const oldIndex = old.indexOf(active.id);
      const newIndex = old.indexOf(over.id);
      const reordered = arrayMove(old, oldIndex, newIndex);
      return { ...prev, order: { ...prev.order, [cycle]: reordered } };
    });
  }

  function addTransaction(){
    const date = prompt("Transaction date (YYYY-MM-DD)?", new Date().toISOString().slice(0,10));
    const categoryId = prompt("Category ID (use search to find ids) or name:");
    const cat = state.categories.find(c=>c.id===categoryId) || state.categories.find(c=>c.name.toLowerCase()===String(categoryId||"").toLowerCase());
    if(!cat){ alert("Category not found"); return; }
    const amount = Number(prompt("Amount (negative for refunds)?", "0"))||0;
    const note = prompt("Note (optional)")||"";
    const t = { id: `tx_${Math.random().toString(36).slice(2,9)}`, date, categoryId:cat.id, amount, note };
    setAndUndo(prev=> ({...prev, transactions: [t, ...prev.transactions]}));
  }

  function exportCSV(){
    const rows = [];
    rows.push(["TYPE","ID","DATE","NAME","CYCLE","PLANNED","STATUS","AMOUNT","NOTE"].join(","));
    state.categories.forEach(c=>{
      rows.push(["CATEGORY",c.id,"",escapeCsv(c.name),c.cycle,c.planned,c.status,"",""].join(","));
    });
    state.transactions.forEach(t=>{
      const c = state.categories.find(c=>c.id===t.categoryId);
      rows.push(["TRANSACTION",t.id,t.date,escapeCsv(c?.name||""),c?.cycle||"",c?.planned||"",c?.status||"",t.amount,escapeCsv(t.note||"")].join(","));
    });
    const blob = new Blob([rows.join("\n")],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'budget_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }
  function importCSV(file){
    const reader = new FileReader();
    reader.onload = (e)=>{
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const [header, ...body] = lines;
      const cols = header.split(',');
      const idx = (k)=> cols.indexOf(k);
      const next = JSON.parse(JSON.stringify(state));
      body.forEach(line=>{
        const parts = splitCsv(line);
        const type = parts[idx("TYPE")];
        if(type==="CATEGORY"){
          const c = {
            id: parts[idx("ID")],
            name: unescapeCsv(parts[idx("NAME")]),
            cycle: parts[idx("CYCLE")]||"first",
            planned: Number(parts[idx("PLANNED")])||0,
            status: parts[idx("STATUS")]||"active",
            color: randomColor(),
            type: "variable",
          };
          upsertCategory(next, c);
        }else if(type==="TRANSACTION"){
          const t = {
            id: parts[idx("ID")],
            date: parts[idx("DATE")],
            categoryId: (function(){
              const name = unescapeCsv(parts[idx("NAME")]);
              const found = next.categories.find(c=>c.name===name);
              return found?.id || name;
            })(),
            amount: Number(parts[idx("AMOUNT")])||0,
            note: unescapeCsv(parts[idx("NOTE")])
          };
          if(!next.transactions.find(x=>x.id===t.id)) next.transactions.unshift(t);
        }
      });
      setAndUndo(next);
    };
    reader.readAsText(file);
  }

  // Context menu actions
  function onContextAction(action, id){
    if(action==="edit"){ const name = prompt("New name?"); if(name) updateCategory(id,{name}); }
    if(action==="archive"){ archiveCategory(id); }
    if(action==="activate"){ activateCategory(id); }
    if(action==="delete"){ removeCategory(id); }
  }

  // Filtered search for settings panel
  const filtered = useMemo(()=> state.categories.filter(c=> c.name.toLowerCase().includes(query.toLowerCase())),[state.categories, query]);

  // Render
  return (
    <div className={`${themeClass} font-sans`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl grid place-items-center bg-gradient-to-br from-indigo-500 to-sky-400 text-white shadow">
                <DollarSign className="h-5 w-5"/>
              </div>
              <div>
                <div className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Budget App</div>
                <h1 className="text-lg font-semibold">Eduardo Household Budget</h1>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search categories…" className="pl-9 pr-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700"/>
              </div>
              <IconBtn icon={state.theme==="dark"?Sun:Moon} label={state.theme==="dark"?"Light":"Dark"} onClick={toggleTheme}/>
              <IconBtn icon={Undo2} label="Undo" onClick={undo}/>
              <IconBtn icon={FileDown} label="Export CSV" onClick={exportCSV}/>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm hover:shadow cursor-pointer">
                <FileUp className="h-4 w-4"/>
                <span className="hidden sm:inline text-sm">Import CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={e=> e.target.files?.[0] && importCSV(e.target.files[0]) }/>
              </label>
            </div>
          </div>
          <nav className="max-w-6xl mx-auto px-4 pb-2">
            <div className="flex gap-2">
              <TabButton active={tab==="overview"} onClick={()=>{ setTab("overview"); setCycleFilter(null); }} icon={ListChecks} label="Overview"/>
              <TabButton active={tab==="calendar"} onClick={()=>{ setTab("calendar"); setCycleFilter(null); }} icon={CalendarIcon} label="Calendar"/>
              <TabButton active={tab==="bonus"} onClick={()=>{ setTab("bonus"); setCycleFilter(null); }} icon={Gift} label="Bonus Planner"/>
              <TabButton active={tab==="settings"} onClick={()=>{ setTab("settings"); setCycleFilter(null); }} icon={SlidersHorizontal} label="Settings / Management"/>
            </div>
          </nav>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          {tab==="overview" && (
            <Overview
              state={state}
              categoriesByCycle={categoriesByCycle}
              plannedTotals={plannedTotals}
              incomeMonthly={incomeMonthly}
              remaining={remaining}
              quickEdit={quickEdit}
              setQuickEdit={setQuickEdit}
              addCategory={addCategory}
              updateCategory={updateCategory}
              onContextAction={onContextAction}
              onDragEnd={onDragEnd}
              cycleFilter={cycleFilter}
              setCycleFilter={setCycleFilter}
            />
          )}
          {tab==="calendar" && (
            <CalendarView state={state} setCycleFilter={setCycleFilter} />
          )}
          {tab==="bonus" && (
            <BonusPlanner state={state} setAndUndo={setAndUndo} />
          )}
          {tab==="settings" && (
            <SettingsPanel state={state} setAndUndo={setAndUndo} filtered={filtered} onContextAction={onContextAction} addTransaction={addTransaction} />
          )}
        </main>

        <footer className="max-w-6xl mx-auto px-4 pb-10 text-sm text-slate-500 dark:text-slate-400">
          Built for Eduardo • Local-only storage • Single-file React • Drag to reorder • Right-click/long-press a category for quick actions.
        </footer>

        <AnimatePresence>
          {confirm?.type==="deletePrompt" && (
            <ConfirmDialog onClose={()=>setConfirm(null)} onConfirm={()=>{ setConfirm({ type:"delete", payload: confirm.payload.id }); }}>
              <h3 className="text-lg font-semibold mb-1">Delete {confirm.payload.name}?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Are you sure you want to remove this category?</p>
            </ConfirmDialog>
          )}
          {confirm?.type==="delete" && (
            <ConfirmDialog onClose={()=>setConfirm(null)} onConfirm={()=>{ permanentlyDeleteCategory(confirm.payload); setConfirm(null); }}>
              <h3 className="text-lg font-semibold mb-1">Permanently delete this category?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">This will remove it forever. Historical transactions remain for reporting.</p>
            </ConfirmDialog>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/****************
 * Tab: Overview *
 ****************/
function Overview({state, categoriesByCycle, plannedTotals, incomeMonthly, remaining, quickEdit, setQuickEdit, addCategory, updateCategory, onContextAction, onDragEnd, cycleFilter, setCycleFilter}){
  // Determine which cycles to display based on filter
  const displayFirst = !cycleFilter || cycleFilter === 'first';
  const displaySecond = !cycleFilter || cycleFilter === 'second';

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-2 gap-4">
        {displayFirst && (
          <div onClick={()=>{ setCycleFilter(cycleFilter? null : 'first'); }} className="cursor-pointer">
            <IncomeCard label="1st Payment" amount={incomeMonthly.first} planned={plannedTotals.first} remaining={remaining.first} color="from-indigo-500 to-sky-400" reserve={state.emergencyReserve}/>
          </div>
        )}
        {displaySecond && (
          <div onClick={()=>{ setCycleFilter(cycleFilter? null : 'second'); }} className="cursor-pointer">
            <IncomeCard label="2nd Payment" amount={incomeMonthly.second} planned={plannedTotals.second} remaining={remaining.second} color="from-emerald-500 to-teal-400" reserve={state.emergencyReserve}/>
          </div>
        )}
      </div>

      {/* Show Back button if a cycle is filtered */}
      {cycleFilter && (
        <div>
          <button onClick={()=> setCycleFilter(null)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-100 dark:bg-slate-800 dark:border-slate-700">Back to Overview</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Planned Expenses {cycleFilter && (<span className="text-sm text-slate-500 dark:text-slate-400">({cycleFilter === 'first' ? '1st Payment' : '2nd Payment'})</span>)}</h2>
        <div className="flex items-center gap-2">
          <IconBtn icon={Edit3} label={quickEdit?"Done":"Quick Edit"} onClick={()=>setQuickEdit(!quickEdit)} className={quickEdit?"bg-indigo-50 border-indigo-200 text-indigo-700":""} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {displayFirst && (
          <CycleColumn title="1st Payment" cycle="first" list={categoriesByCycle.first} order={state.order.first} addCategory={addCategory} quickEdit={quickEdit} updateCategory={updateCategory} onContextAction={onContextAction} onDragEnd={onDragEnd} />
        )}
        {displaySecond && (
          <CycleColumn title="2nd Payment" cycle="second" list={categoriesByCycle.second} order={state.order.second} addCategory={addCategory} quickEdit={quickEdit} updateCategory={updateCategory} onContextAction={onContextAction} onDragEnd={onDragEnd} />
        )}
        {(!cycleFilter || cycleFilter === 'bonus') && (
          <CycleColumn title="Bonus Buckets" cycle="bonus" list={categoriesByCycle.bonus} order={state.order.bonus} addCategory={addCategory} quickEdit={quickEdit} updateCategory={updateCategory} onContextAction={onContextAction} onDragEnd={onDragEnd} />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SpendingPie state={state} />
        <PlannedVsActual state={state} />
      </div>
    </div>
  );
}

function IncomeCard({label, amount, planned, remaining, color, reserve}){
  const percent = Math.min(100, Math.max(0, (planned/Math.max(1,amount))*100));
  const remainingAfterReserve = remaining - (reserve||0);
  let warning = null;
  if(remainingAfterReserve <= 0){
    warning = <div className="text-xs mt-1 text-rose-600">Alert: Reserve reached</div>;
  } else if(remainingAfterReserve <= 500){
    warning = <div className="text-xs mt-1 text-amber-600">Warning: Within $500 of reserve</div>;
  }
  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${color} text-white grid place-items-center shadow`}><DollarSign className="h-5 w-5"/></div>
        <div className="flex-1">
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-2xl font-semibold">${amount.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-sm">Planned: <span className="font-medium">${planned.toLocaleString()}</span></div>
          <div className={`text-sm ${remaining>=0?"text-emerald-600":"text-rose-600"}`}>Remaining: <span className="font-semibold">${remaining.toLocaleString()}</span></div>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-indigo-500" style={{width: `${percent}%`}}/>
      </div>
      {warning}
    </div>
  );
}

function CycleColumn({title, cycle, list, order=[], addCategory, quickEdit, updateCategory, onContextAction, onDragEnd}){
  const orderedList = useMemo(()=> order?.map(id=> list.find(c=>c.id===id)).filter(Boolean) ?? list, [order, list]);
  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={()=>addCategory(cycle)} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"><Plus className="h-4 w-4"/> Add</button>
      </div>
      <DndContext sensors={useSensors(useSensor(PointerSensor))} collisionDetection={closestCenter} onDragEnd={(e)=>onDragEnd(e, cycle)}>
        <SortableContext items={orderedList.map(c=>c.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-2">
            {orderedList.map(cat=> (
              <SortableItem key={cat.id} id={cat.id}>
                <CategoryRow cat={cat} quickEdit={quickEdit} updateCategory={updateCategory} onContextAction={onContextAction} />
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CategoryRow({cat, quickEdit, updateCategory, onContextAction}){
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState({ name: cat.name, planned: cat.planned });
  useEffect(()=>{ setTmp({name:cat.name, planned:cat.planned}); },[cat.id]);
  const statusTone = cat.status==="active"?"active": cat.status==="archived"?"archived":"deleted";
  return (
    <div
      onContextMenu={(e)=>{e.preventDefault(); onContextAction(cat.status==="active"?"archive":"activate", cat.id);}}
      className={`group rounded-xl border p-3 bg-white dark:bg-slate-900 dark:border-slate-800 hover:shadow-sm transition ${cat.status!=="active"?"opacity-60":""}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full" style={{background:cat.color}}/>
        {!editing && (
          <div className="flex-1">
            <div className="font-medium">{cat.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Badge tone={statusTone}>{cat.status}</Badge>
              <span className="capitalize">{cat.type}</span>
            </div>
          </div>
        )}
        {editing && (
          <div className="flex-1 flex items-center gap-2">
            <input value={tmp.name} onChange={e=>setTmp(v=>({...v,name:e.target.value}))} className="px-2 py-1 rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 w-48"/>
            <input type="number" value={tmp.planned} onChange={e=>setTmp(v=>({...v,planned:Number(e.target.value)}))} className="px-2 py-1 rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 w-28"/>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!editing && <div className="text-sm font-semibold">${Number(cat.planned||0).toLocaleString()}</div>}
          {editing && (
            <>
              <button onClick={()=>{ updateCategory(cat.id, {name: tmp.name, planned: Number(tmp.planned)||0}); setEditing(false); }} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs inline-flex items-center gap-1"><Save className="h-3 w-3"/>Save</button>
              <button onClick={()=>setEditing(false)} className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs inline-flex items-center gap-1"><X className="h-3 w-3"/>Cancel</button>
            </>
          )}
          {!editing && (
            <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
              <button onClick={()=>setEditing(true)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Inline edit"><Edit3 className="h-4 w-4"/></button>
              {cat.status!=="deleted" && (
                <button onClick={()=>onContextAction("delete", cat.id)} className="p-2 rounded-lg hover:bg-rose-50 hover:text-rose-600" title="Delete permanently"><Trash2 className="h-4 w-4"/></button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/***********************
 * Charts & Visualizations
 ***********************/
function SpendingPie({state}){
  const byCat = useMemo(()=>{
    const map = new Map();
    state.transactions.forEach(t=>{
      map.set(t.categoryId, (map.get(t.categoryId)||0) + Number(t.amount));
    });
    return state.categories.filter(c=>c.status!=="deleted").map(c=> ({ name: c.name, value: Math.abs(map.get(c.id)||0), color: c.color }));
  },[state.transactions, state.categories]);
  const data = byCat.filter(d=>d.value>0).slice(0,10);
  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2"><h3 className="font-semibold">Top Actual Spending</h3></div>
      <div className="h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PlannedVsActual({state}){
  const data = useMemo(()=>{
    const planMap = new Map(state.categories.filter(c=>c.status!=="deleted").map(c=>[c.id, Number(c.planned)||0]));
    const actMap = new Map();
    state.transactions.forEach(t=>{ actMap.set(t.categoryId, (actMap.get(t.categoryId)||0) + Number(t.amount)); });
    const cats = state.categories.filter(c=>c.status!=="deleted").slice(0,8);
    return cats.map(c=> ({ name: c.name.slice(0,12), Planned: planMap.get(c.id)||0, Actual: Math.abs(actMap.get(c.id)||0) }));
  },[state.categories, state.transactions]);
  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2"><h3 className="font-semibold">Planned vs. Actual</h3></div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={50}/>
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Planned" />
            <Bar dataKey="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/****************
 * Calendar View *
 ****************/
function CalendarView({state, setCycleFilter}){
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  const current = new Date(base.getFullYear(), base.getMonth()+monthOffset, 1);
  const monthName = current.toLocaleString(undefined,{month:"long", year:"numeric"});
  const days = buildCalendarDays(current);
  // Payment dates: 1st payment is the last day of the month, 2nd is always the 15th
  const pay1 = new Date(current.getFullYear(), current.getMonth()+1, 0).getDate();
  const pay2 = 15;
  const bonusMonths = state.income.schedule.bonusMonths;
  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Payment Schedule</h2>
        <div className="flex items-center gap-2">
          <button onClick={()=>setMonthOffset(m=>m-1)} className="p-2 rounded-lg border"><ChevronLeft className="h-4 w-4"/></button>
          <div className="min-w-[10rem] text-center font-medium">{monthName}</div>
          <button onClick={()=>setMonthOffset(m=>m+1)} className="p-2 rounded-lg border"><ChevronRight className="h-4 w-4"/></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-sm">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(<div key={d} className="text-center text-slate-500">{d}</div>))}
        {days.map((d,idx)=>{
          const isThisMonth = d.getMonth()===current.getMonth();
          const day = d.getDate();
          const isPay1 = isThisMonth && day===pay1;
          const isPay2 = isThisMonth && day===pay2;
          const isBonus = isThisMonth && (bonusMonths.includes(current.getMonth()+1)) && (day===pay1 || day===pay2);
          return (
            <div key={idx} className={`h-24 rounded-xl border p-2 ${isThisMonth?"bg-white dark:bg-slate-900 dark:border-slate-800":"bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{day}</span>
                <div className="flex gap-1">
                  {isPay1 && <span onClick={()=>setCycleFilter('first')} className="cursor-pointer"><Badge tone="active">1st Pay</Badge></span>}
                  {isPay2 && <span onClick={()=>setCycleFilter('second')} className="cursor-pointer"><Badge tone="active">2nd Pay</Badge></span>}
                </div>
              </div>
              {isBonus && (
                <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">Bonus window</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/****************
 * Bonus Planner *
 ****************/
function BonusPlanner({state, setAndUndo}){
  const [april, setApril] = useState(state.income.bonus.april||0);
  const [sept, setSept] = useState(state.income.bonus.september||0);
  const bonusCats = state.categories.filter(c=>c.cycle==="bonus" && c.status!=="deleted");
  const [alloc, setAlloc] = useState(()=> Object.fromEntries(bonusCats.map(c=>[c.id, Number(c.planned)||0])));
  useEffect(()=>{ setAlloc(Object.fromEntries(bonusCats.map(c=>[c.id, Number(c.planned)||0]))); },[state.categories.length]);
  const totalAlloc = Object.values(alloc).reduce((s,n)=>s+Number(n||0),0);
  function save(){
    setAndUndo(prev=> ({
      ...prev,
      income: { ...prev.income, bonus: { april:Number(april)||0, september:Number(sept)||0 } },
      categories: prev.categories.map(c=> c.cycle==="bonus"? { ...c, planned: Number(alloc[c.id]||0) } : c)
    }));
  }
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
        <h3 className="font-semibold mb-2">Bonus Amounts</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <LabeledInput label="April (end of month)" value={april} onChange={setApril} type="number"/>
          <LabeledInput label="September (end of month)" value={sept} onChange={setSept} type="number"/>
        </div>
      </div>
      <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Allocate Bonus to Buckets</h3>
          <div className="text-sm">Total allocated: <span className={`${totalAlloc>(Number(april)+Number(sept))?"text-rose-600":"text-emerald-600"} font-semibold`}>${totalAlloc.toLocaleString()}</span></div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {bonusCats.map(c=> (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="h-3 w-3 rounded-full" style={{background:c.color}}/>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
              </div>
              <input type="number" className="px-2 py-1 rounded-lg border w-36" value={alloc[c.id]||0} onChange={e=> setAlloc(a=> ({...a, [c.id]: Number(e.target.value)})) }/>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={save} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"><Save className="h-4 w-4"/> Save Allocations</button>
        </div>
      </div>
    </div>
  );
}

/*********************
 * Settings/Management *
 *********************/
function SettingsPanel({state, setAndUndo, filtered, onContextAction, addTransaction}){
  const [firstDay, setFirstDay] = useState(state.income.schedule.firstPaymentDay);
  const [secondDay, setSecondDay] = useState(state.income.schedule.secondPaymentDay);
  const [firstAmt, setFirstAmt] = useState(state.income.payments.first);
  const [firstFeb, setFirstFeb] = useState(state.income.payments.febFirst);
  const [secondAmt, setSecondAmt] = useState(state.income.payments.second);
  const [bonusMonths, setBonusMonths] = useState(state.income.schedule.bonusMonths.join(", "));
  const [reserve, setReserve] = useState(state.emergencyReserve||100);
  function saveIncome(){
    const months = bonusMonths.split(/[,\s]+/).map(n=>Number(n)).filter(n=>n>=1 && n<=12);
    setAndUndo(prev=> ({
      ...prev,
      income: {
        ...prev.income,
        schedule: { ...prev.income.schedule, firstPaymentDay:Number(firstDay), secondPaymentDay:Number(secondDay), bonusMonths: months },
        payments: { ...prev.income.payments, first:Number(firstAmt), febFirst:Number(firstFeb), second:Number(secondAmt) }
      },
      emergencyReserve: Math.max(100, Number(reserve)||100)
    }));
  }
  function addNewCategory(){
    const cycle = prompt("Cycle? first / second / bonus", "first");
    if(!["first","second","bonus"].includes((cycle||"").toLowerCase())) return;
    const name = prompt("Name?"); if(!name) return;
    const planned = Number(prompt("Planned amount?","0"))||0;
    const id = `cat_${Math.random().toString(36).slice(2,9)}`;
    const color = randomColor();
    setAndUndo(prev=> ({...prev, categories: [...prev.categories, {id,name,cycle:cycle.toLowerCase(),planned,color,status:"active", type:"variable"}], order: { ...prev.order, [cycle]: [...(prev.order[cycle]||[]), id]}}));
  }
  function bulk(action){
    const names = prompt(`Enter category names or ids to ${action} (comma-separated)`);
    if(!names) return;
    const tokens = names.split(/[,.\s]+/).filter(Boolean);
    if(action==="archive"){ setAndUndo(prev=> ({...prev, categories: prev.categories.map(c=> tokens.includes(c.id)||tokens.includes(c.name)? {...c, status:"archived"} : c)})); }
    if(action==="activate"){ setAndUndo(prev=> ({...prev, categories: prev.categories.map(c=> tokens.includes(c.id)||tokens.includes(c.name)? {...c, status:"active"} : c)})); }
    if(action==="delete"){
      setAndUndo(prev=> ({...prev, categories: prev.categories.filter(c=> !(tokens.includes(c.id)||tokens.includes(c.name))), order: Object.fromEntries(Object.entries(prev.order).map(([k,arr])=>[k, arr.filter(id=> !tokens.includes(id))])) }));
    }
  }
  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
        <h3 className="font-semibold mb-3">Income Settings</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <LabeledInput label="1st Payment Amount (default)" value={firstAmt} onChange={setFirstAmt} type="number"/>
          <LabeledInput label="1st Payment Amount (February)" value={firstFeb} onChange={setFirstFeb} type="number"/>
          <LabeledInput label="2nd Payment Amount" value={secondAmt} onChange={setSecondAmt} type="number"/>
          <LabeledInput label="1st Payment Day" value={firstDay} onChange={setFirstDay} type="number"/>
          <LabeledInput label="2nd Payment Day" value={secondDay} onChange={setSecondDay} type="number"/>
          <LabeledInput label="Bonus Months (1-12, comma separated)" value={bonusMonths} onChange={setBonusMonths}/>
          <LabeledInput label="Emergency Reserve (min $100)" value={reserve} onChange={setReserve} type="number"/>
        </div>
        <div className="mt-3"><button onClick={saveIncome} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">Save Income & Settings</button></div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Category Manager</h3>
          <div className="flex items-center gap-2">
            <button onClick={addNewCategory} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white"><Plus className="h-4 w-4"/> New Category</button>
            <button onClick={()=>bulk("archive")} className="px-3 py-2 rounded-xl border">Bulk Archive</button>
            <button onClick={()=>bulk("activate")} className="px-3 py-2 rounded-xl border">Bulk Activate</button>
            <button onClick={()=>bulk("delete")} className="px-3 py-2 rounded-xl border text-rose-600">Bulk Delete</button>
          </div>
        </div>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Cycle</th>
                <th className="text-left p-2">Planned</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=> (
                <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-2">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.id}</div>
                  </td>
                    <td className="p-2 capitalize">{c.cycle}</td>
                  <td className="p-2">${Number(c.planned||0).toLocaleString()}</td>
                  <td className="p-2"><Badge tone={c.status==="active"?"active":c.status==="archived"?"archived":"deleted"}>{c.status}</Badge></td>
                  <td className="p-2 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={()=>onContextAction("edit", c.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Rename"><Edit3 className="h-4 w-4"/></button>
                      {c.status!=="archived" && <button onClick={()=>onContextAction("archive", c.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Archive"><Archive className="h-4 w-4"/></button>}
                      {c.status==="archived" && <button onClick={()=>onContextAction("activate", c.id)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Activate"><CheckCircle className="h-4 w-4"/></button>}
                      <button onClick={()=>onContextAction("delete", c.id)} className="p-2 rounded-lg hover:bg-rose-50 hover:text-rose-600" title="Delete permanently"><Trash2 className="h-4 w-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
        <h3 className="font-semibold mb-2">Quick Utilities</h3>
        <div className="flex flex-wrap gap-2">
          <IconBtn icon={CreditCard} label="Add Transaction" onClick={addTransaction}/>
          <IconBtn icon={Plus} label="Add Category" onClick={addNewCategory}/>
          <IconBtn icon={Undo2} label="Undo" onClick={()=>{ const prev=popUndo(); if(prev) setAndUndo(prev); }}/>
        </div>
        <p className="mt-2 text-xs text-slate-500">Tip: Right-click (desktop) or long-press (mobile) a category card to quickly archive/activate or delete.</p>
      </div>
    </div>
  );
}

/****************
 * Generic UI    *
 ****************/
function TabButton({active, onClick, icon:Icon, label}){
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${active?"bg-indigo-600 text-white border-indigo-600":"bg-white dark:bg-slate-900 dark:border-slate-800"}`}>
      <Icon className="h-4 w-4"/> {label}
    </button>
  );
}

function LabeledInput({label, value, onChange, type="text"}){
  return (
    <label className="text-sm grid gap-1">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <input type={type} value={value} onChange={e=> onChange(type==="number"? Number(e.target.value) : e.target.value)} className="px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700"/>
    </label>
  );
}

function ConfirmDialog({children, onClose, onConfirm}){
  return (
    <motion.div className="fixed inset-0 bg-black/40 grid place-items-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className="max-w-md w-full rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4" initial={{scale:.95, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:.95, opacity:0}}>
        <div className="mb-3">{children}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-xl border">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-2 rounded-xl bg-rose-600 text-white">Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/****************
 * Helper funcs  *
 ****************/
function randomColor(){
  const hues = [220, 200, 180, 160, 140, 280, 260, 20, 40, 0, 320];
  const h = hues[Math.floor(Math.random()*hues.length)];
  const s = 70; const l = 55;
  return `hsl(${h} ${s}% ${l}%)`;
}
function escapeCsv(s){ return '"'+String(s).replaceAll('"','""')+'"'; }
function unescapeCsv(s){ return String(s||"").replace(/^\"|\"$/g, '').replaceAll('""','"'); }
function splitCsv(line){
  const out = []; let curr = ''; let inQ = false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(inQ && line[i+1]==='"'){ curr+='"'; i++; }
      else inQ=!inQ;
    }else if(ch===',' && !inQ){ out.push(curr); curr=''; }
    else curr+=ch;
  }
  out.push(curr);
  return out;
}
function upsertCategory(state, cat){
  const idx = state.categories.findIndex(c=>c.id===cat.id);
  if(idx>=0) state.categories[idx] = { ...state.categories[idx], ...cat };
  else state.categories.push(cat);
  const arr = state.order[cat.cycle] || [];
  if(!arr.includes(cat.id)) arr.push(cat.id);
  state.order[cat.cycle] = arr;
}
function buildCalendarDays(monthDate){
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = [];
  for(let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    days.push(d);
  }
  return days;
}