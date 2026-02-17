
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TreeRecord, 
  CoordRecord, 
  ViewType 
} from './types';
import { 
  SPECIES_LIST, 
  PLOT_LIST 
} from './constants';
import { apiGet, apiPost } from './services/sheetsService';
import { utmToLatLng } from './utils/geo';
import { 
  ClipboardList, 
  MapPin, 
  Map as MapIcon, 
  BarChart3, 
  Trees, 
  Search, 
  Plus, 
  RotateCcw,
  Loader2,
  Trash2,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icons in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const App: React.FC = () => {
  // --- STATE ---
  const [records, setRecords] = useState<TreeRecord[]>([]);
  const [coordRecords, setCoordRecords] = useState<CoordRecord[]>([]);
  const [activeView, setActiveView] = useState<ViewType>('table');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form States
  const [plotCode, setPlotCode] = useState('');
  const [treeNumber, setTreeNumber] = useState('');
  const [speciesCode, setSpeciesCode] = useState('');
  const [rowMain, setRowMain] = useState('');
  const [rowSub, setRowSub] = useState('');
  const [dbhCm, setDbhCm] = useState('');
  const [heightM, setHeightM] = useState('');
  const [status, setStatus] = useState<'alive' | 'dead' | null>(null);
  const [note, setNote] = useState('');
  const [recorder, setRecorder] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
  const [growthMode, setGrowthMode] = useState<'new' | 'update'>('new');
  const [selectedUpdateTree, setSelectedUpdateTree] = useState('');

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [plotFilter, setPlotFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // --- ACTIONS ---
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const growthRes = await apiGet('growth_logs');
      if (growthRes.success) {
        setRecords(growthRes.data);
      }
      const coordRes = await apiGet('trees_profile');
      if (coordRes.success) {
        setCoordRecords(coordRes.data);
      }
      showToast('Data synced with cloud', 'success');
    } catch (err: any) {
      showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const treeCodePreview = useMemo(() => {
    if (!plotCode || !speciesCode || !treeNumber) return '—';
    return `${plotCode}${speciesCode}${treeNumber.toString().padStart(3, '0')}`;
  }, [plotCode, speciesCode, treeNumber]);

  const tagLabelPreview = useMemo(() => {
    if (!plotCode || !speciesCode || !treeNumber || !rowMain || !rowSub) return '—';
    const plot = PLOT_LIST.find(p => p.code === plotCode);
    const species = SPECIES_LIST.find(s => s.code === speciesCode);
    const mainPad = rowMain.toString().padStart(2, '0');
    return `${treeNumber} ${plot?.short || plotCode} ${mainPad} (${rowSub}) ${species?.name || speciesCode}`;
  }, [plotCode, speciesCode, treeNumber, rowMain, rowSub]);

  const handleStatusSet = (s: 'alive' | 'dead') => setStatus(s);

  const clearForm = () => {
    setPlotCode('');
    setTreeNumber('');
    setSpeciesCode('');
    setRowMain('');
    setRowSub('');
    setDbhCm('');
    setHeightM('');
    setStatus(null);
    setNote('');
  };

  const handleSubmit = async () => {
    if (!plotCode || !speciesCode || !treeNumber || !rowMain || !rowSub || !recorder) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    const species = SPECIES_LIST.find(s => s.code === speciesCode);
    const treeCode = treeCodePreview;
    
    const newRecord: Partial<TreeRecord> = {
      tree_code: treeCode,
      tag_label: tagLabelPreview,
      plot_code: plotCode,
      species_code: speciesCode,
      species_group: speciesCode.startsWith('A') ? 'A' : 'B',
      species_name: species?.name || '',
      tree_number: parseInt(treeNumber),
      row_main: rowMain,
      row_sub: rowSub,
      dbh_cm: dbhCm || null,
      height_m: heightM || null,
      status: status,
      note: note,
      recorder: recorder,
      survey_date: surveyDate,
    };

    setIsLoading(true);
    try {
      const res = await apiPost({ action: 'addGrowthLog', ...newRecord });
      if (res.success) {
        showToast(`Saved ${treeCode}`, 'success');
        clearForm();
        fetchData();
      }
    } catch (err: any) {
      showToast('Error saving data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTERED DATA ---
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = !searchTerm || 
        r.tree_code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.species_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlot = !plotFilter || r.plot_code === plotFilter;
      const matchesStatus = !statusFilter || r.status === statusFilter;
      return matchesSearch && matchesPlot && matchesStatus;
    });
  }, [records, searchTerm, plotFilter, statusFilter]);

  // --- STATS DATA ---
  const stats = useMemo(() => {
    const total = records.length;
    const alive = records.filter(r => r.status === 'alive').length;
    const dead = records.filter(r => r.status === 'dead').length;
    
    const speciesData: any[] = [];
    const speciesCounts: any = {};
    records.forEach(r => {
      speciesCounts[r.species_name] = (speciesCounts[r.species_name] || 0) + 1;
    });
    Object.keys(speciesCounts).forEach(name => {
      speciesData.push({ name, value: speciesCounts[name] });
    });

    const plotData: any[] = [];
    const plotCounts: any = {};
    records.forEach(r => {
      plotCounts[r.plot_code] = (plotCounts[r.plot_code] || 0) + 1;
    });
    Object.keys(plotCounts).forEach(code => {
      plotData.push({ name: code, value: plotCounts[code] });
    });

    return { 
      total, 
      alive, 
      dead, 
      alivePct: total ? Math.round((alive / total) * 100) : 0,
      deadPct: total ? Math.round((dead / total) * 100) : 0,
      speciesData: speciesData.sort((a,b) => b.value - a.value).slice(0, 10),
      plotData: plotData.sort((a,b) => b.value - a.value)
    };
  }, [records]);

  // --- COMPONENTS ---
  const TabButton: React.FC<{ view: ViewType; icon: React.ReactNode; label: string }> = ({ view, icon, label }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
        activeView === view 
          ? 'text-white border-green-400 bg-white/5' 
          : 'text-white/60 border-transparent hover:text-white/80'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* HEADER */}
      <header className="bg-[#2d5a27] text-white shadow-lg z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Trees size={24} className="text-green-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">ระบบบันทึกข้อมูลต้นไม้</h1>
              <p className="text-xs text-white/70 font-light">โครงการป่าอเนกประสงค์ คทช. แม่แจ่ม</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
              <span className="text-xs text-white/60 mr-2">ทั้งหมด:</span>
              <span className="font-mono font-bold text-yellow-400">{stats.total}</span>
            </div>
            <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
              <span className="text-xs text-white/60 mr-2">รอด:</span>
              <span className="font-mono font-bold text-green-400">{stats.alive}</span>
            </div>
            <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
              <span className="text-xs text-white/60 mr-2">ตาย:</span>
              <span className="font-mono font-bold text-red-400">{stats.dead}</span>
            </div>
          </div>
          <button 
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <RotateCcw size={20} />}
          </button>
        </div>
        <nav className="border-t border-white/10">
          <div className="container mx-auto px-4 flex overflow-x-auto no-scrollbar">
            <TabButton view="table" icon={<ClipboardList size={18} />} label="ตารางข้อมูล" />
            <TabButton view="coords" icon={<MapPin size={18} />} label="พิกัดต้นไม้" />
            <TabButton view="map" icon={<MapIcon size={18} />} label="แผนที่ดาวเทียม" />
            <TabButton view="stats" icon={<BarChart3 size={18} />} label="สถิติ" />
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT FORM PANEL */}
        <aside className="w-96 border-r border-gray-200 bg-white flex flex-col overflow-y-auto shrink-0">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">📍 ข้อมูลแปลงและต้นไม้</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">แปลง</label>
                <select 
                  value={plotCode} 
                  onChange={(e) => setPlotCode(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none"
                >
                  <option value="">— เลือกแปลง —</option>
                  {PLOT_LIST.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">ต้นที่</label>
                <input 
                  type="number" 
                  value={treeNumber}
                  onChange={(e) => setTreeNumber(e.target.value)}
                  placeholder="เช่น 14"
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none" 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">ชนิดพันธุ์</label>
                <select 
                  value={speciesCode} 
                  onChange={(e) => setSpeciesCode(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 outline-none"
                >
                  <option value="">— เลือกพันธุ์ไม้ —</option>
                  <optgroup label="🌲 ไม้ป่า (A)">
                    {SPECIES_LIST.filter(s => s.group === 'A').map(s => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
                  </optgroup>
                  <optgroup label="🍎 ไม้ผล (B)">
                    {SPECIES_LIST.filter(s => s.group === 'B').map(s => <option key={s.code} value={s.code}>{s.code} {s.name}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">หลัก (Row)</label>
                <input 
                  type="text" 
                  value={rowMain}
                  onChange={(e) => setRowMain(e.target.value)}
                  placeholder="02"
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">แถว (Sub)</label>
                <input 
                  type="text" 
                  value={rowSub}
                  onChange={(e) => setRowSub(e.target.value)}
                  placeholder="03-A"
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono" 
                />
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-gray-100 bg-green-50/30">
            <h3 className="text-xs font-bold uppercase tracking-widest text-green-700 mb-4 flex items-center gap-2">
              <Plus size={14} /> อัตโนมัติ
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white border border-green-200 rounded-lg p-3 shadow-sm">
                <label className="text-[10px] font-bold text-green-700 uppercase mb-1 block">tree_code</label>
                <p className="font-mono text-lg font-semibold text-green-800">{treeCodePreview}</p>
              </div>
              <div className="bg-white border border-green-200 rounded-lg p-3 shadow-sm">
                <label className="text-[10px] font-bold text-green-700 uppercase mb-1 block">tag_label</label>
                <p className="text-xs font-medium text-green-800 leading-tight">{tagLabelPreview}</p>
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">📏 การเติบโต</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">โตคอราก (ซม.)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={dbhCm}
                  onChange={(e) => setDbhCm(e.target.value)}
                  placeholder="0.0"
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">สูง (ม.)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={heightM}
                  onChange={(e) => setHeightM(e.target.value)}
                  placeholder="0.0"
                  className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono" 
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs font-semibold text-gray-500">สถานะ</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleStatusSet('alive')}
                  className={`py-2 text-sm font-bold rounded-md border-2 transition-all ${
                    status === 'alive' 
                      ? 'bg-green-100 border-green-600 text-green-700' 
                      : 'bg-white border-gray-200 text-gray-400 hover:border-green-400'
                  }`}
                >
                  ✅ รอด
                </button>
                <button 
                  onClick={() => handleStatusSet('dead')}
                  className={`py-2 text-sm font-bold rounded-md border-2 transition-all ${
                    status === 'dead' 
                      ? 'bg-red-100 border-red-600 text-red-700' 
                      : 'bg-white border-gray-200 text-gray-400 hover:border-red-400'
                  }`}
                >
                  ❌ ตาย
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">หมายเหตุ</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="(ถ้ามี)"
                className="bg-gray-50 border border-gray-200 rounded-md p-2 text-sm" 
              />
            </div>
          </div>

          <div className="p-5 bg-gray-50/50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">📅 บันทึกข้อมูล</h3>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">วันที่สำรวจ</label>
                <input 
                  type="date" 
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-md p-2 text-sm" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">ผู้บันทึก</label>
                <input 
                  type="text" 
                  value={recorder}
                  onChange={(e) => setRecorder(e.target.value)}
                  placeholder="ชื่อผู้บันทึก"
                  className="bg-white border border-gray-200 rounded-md p-2 text-sm" 
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={clearForm}
                className="px-4 py-3 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
              >
                ล้างฟอร์ม
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 bg-[#2d5a27] text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-green-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                บันทึกต้นไม้
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT PANEL */}
        <section className="flex-1 flex flex-col min-w-0 bg-white">
          {activeView === 'table' && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="ค้นหา code, ชนิด, แปลง..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-100 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 outline-none"
                  />
                </div>
                <select 
                  value={plotFilter}
                  onChange={(e) => setPlotFilter(e.target.value)}
                  className="bg-gray-100 border-none rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">ทุกแปลง</option>
                  {PLOT_LIST.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
                </select>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-100 border-none rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">ทุกสถานะ</option>
                  <option value="alive">รอดเท่านั้น</option>
                  <option value="dead">ตายเท่านั้น</option>
                </select>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-800 text-white text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">วันที่</th>
                      <th className="px-4 py-3">tree_code</th>
                      <th className="px-4 py-3">tag_label</th>
                      <th className="px-4 py-3">ชนิด</th>
                      <th className="px-4 py-3">สถานะ</th>
                      <th className="px-4 py-3 text-right">โต (ซม)</th>
                      <th className="px-4 py-3 text-right">สูง (ม)</th>
                      <th className="px-4 py-3">ผู้บันทึก</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((r, i) => (
                        <tr key={r.log_id || i} className="hover:bg-green-50/50 transition-colors group">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.survey_date}</td>
                          <td className="px-4 py-3 font-mono text-sm font-bold text-green-800 whitespace-nowrap">{r.tree_code}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-700">{r.tag_label}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${r.species_group === 'A' ? 'bg-green-600' : 'bg-orange-600'}`}></span>
                            {r.species_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'alive' ? 'bg-green-100 text-green-700' : 
                              r.status === 'dead' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {r.status === 'alive' ? '✅ รอด' : r.status === 'dead' ? '❌ ตาย' : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{r.dbh_cm || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm">{r.height_m || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{r.recorder}</td>
                          <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-400">
                            <Search size={48} strokeWidth={1} />
                            <p>ไม่พบข้อมูลที่ต้องการ</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'coords' && (
            <div className="flex flex-col h-full">
              <div className="p-6 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-center gap-3 text-yellow-800 mb-4">
                  <MapPin size={24} />
                  <h2 className="text-xl font-bold">จัดการพิกัดต้นไม้</h2>
                </div>
                <div className="bg-white p-5 rounded-xl border border-yellow-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                   <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-yellow-700">เลือกต้นไม้</label>
                    <select className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-sm">
                      <option value="">— เลือก Tree Code —</option>
                      {records.map(r => <option key={r.tree_code} value={r.tree_code}>{r.tree_code} ({r.species_name})</option>)}
                    </select>
                   </div>
                   <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-yellow-700">พิกัด X (UTM Easting)</label>
                    <input type="number" placeholder="439776" className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono" />
                   </div>
                   <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-yellow-700">พิกัด Y (UTM Northing)</label>
                    <input type="number" placeholder="2041323" className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-sm font-mono" />
                   </div>
                   <button className="bg-yellow-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-yellow-700 transition-colors shadow-sm">
                    บันทึกพิกัด
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-800 text-white text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">tree_code</th>
                      <th className="px-4 py-3">UTM X</th>
                      <th className="px-4 py-3">UTM Y</th>
                      <th className="px-4 py-3">Lat / Lng</th>
                      <th className="px-4 py-3">สถานะ</th>
                      <th className="px-4 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coordRecords.length > 0 ? (
                      coordRecords.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-yellow-800">{r.tree_code}</td>
                          <td className="px-4 py-3 font-mono text-sm">{r.utm_x}</td>
                          <td className="px-4 py-3 font-mono text-sm">{r.utm_y}</td>
                          <td className="px-4 py-3 font-mono text-xs text-green-700">
                            {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ มีพิกัด</span>
                          </td>
                          <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                             <a 
                              href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-500 hover:text-blue-700"
                             >
                               <ExternalLink size={16} />
                             </a>
                             <button className="text-red-400 hover:text-red-600">
                               <Trash2 size={16} />
                             </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="py-20 text-center text-gray-400">ยังไม่มีข้อมูลพิกัด</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'map' && (
            <div className="flex flex-col h-full relative">
              <div className="absolute top-4 right-4 z-[1000] bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">คำอธิบายสัญลักษณ์</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="w-3 h-3 bg-green-500 rounded-full border border-white"></span> รอด (Alive)
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="w-3 h-3 bg-red-500 rounded-full border border-white"></span> ตาย (Dead)
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="w-3 h-3 bg-gray-400 rounded-full border border-white"></span> ยังไม่สำรวจ
                  </div>
                </div>
              </div>
              <MapContainer 
                center={[18.4900, 98.3800]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.google.com/maps">Google Satellite</a>'
                  url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                  maxZoom={20}
                />
                {coordRecords.map((r, i) => {
                  const growthRec = records.find(g => g.tree_code === r.tree_code);
                  const isAlive = growthRec?.status === 'alive';
                  const isDead = growthRec?.status === 'dead';
                  const color = isAlive ? '#22c55e' : isDead ? '#ef4444' : '#9ca3af';

                  const customIcon = new L.DivIcon({
                    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.4)"></div>`,
                    className: 'custom-tree-marker',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                  });

                  return (
                    <Marker key={i} position={[r.lat, r.lng]} icon={customIcon}>
                      <Popup>
                        <div className="p-1 min-w-[150px]">
                          <div className="font-bold text-green-800 text-sm mb-1">{r.tree_code}</div>
                          <div className="text-[10px] text-gray-500 mb-2">{growthRec?.tag_label || 'ไม่มีข้อมูลป้าย'}</div>
                          <div className="grid grid-cols-2 gap-y-1 text-xs">
                            <span className="text-gray-400">ชนิด:</span>
                            <span className="font-semibold">{growthRec?.species_name || '—'}</span>
                            <span className="text-gray-400">โตคอราก:</span>
                            <span className="font-semibold">{growthRec?.dbh_cm || '—'} cm</span>
                            <span className="text-gray-400">ความสูง:</span>
                            <span className="font-semibold">{growthRec?.height_m || '—'} m</span>
                            <span className="text-gray-400">สถานะ:</span>
                            <span className={`font-bold ${isAlive ? 'text-green-600' : isDead ? 'text-red-600' : 'text-gray-400'}`}>
                              {isAlive ? 'รอด' : isDead ? 'ตาย' : '—'}
                            </span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}

          {activeView === 'stats' && (
            <div className="flex-1 overflow-auto p-8">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="text-green-600" /> แดชบอร์ดสถิติ
                  </h2>
                  <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                    อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH')}
                  </div>
                </div>

                {/* OVERVIEW CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">จำนวนทั้งหมด</p>
                    <p className="text-4xl font-mono font-bold text-gray-800">{stats.total}</p>
                    <p className="text-xs text-gray-500 mt-2">ต้นไม้ที่ลงทะเบียนแล้ว</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-green-500">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">อัตราการรอด</p>
                    <p className="text-4xl font-mono font-bold text-green-600">{stats.alivePct}%</p>
                    <p className="text-xs text-gray-500 mt-2">{stats.alive} จาก {stats.total} ต้น</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-red-500">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">อัตราการตาย</p>
                    <p className="text-4xl font-mono font-bold text-red-600">{stats.deadPct}%</p>
                    <p className="text-xs text-gray-500 mt-2">{stats.dead} จาก {stats.total} ต้น</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-yellow-500">
                    <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-2">ระบุพิกัดแล้ว</p>
                    <p className="text-4xl font-mono font-bold text-yellow-600">{coordRecords.length}</p>
                    <p className="text-xs text-gray-500 mt-2">{Math.round((coordRecords.length/stats.total)*100 || 0)}% ของทั้งหมด</p>
                  </div>
                </div>

                {/* CHARTS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider">Top 10 ชนิดพันธุ์ไม้</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.speciesData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {stats.speciesData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#166534' : '#15803d'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider">จำนวนต้นแยกตามแปลง</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.plotData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip 
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                             cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="value" fill="#8b5e34" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                   <h3 className="text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider">ภาพรวมสุขภาพป่า</h3>
                   <div className="flex flex-col md:flex-row items-center gap-12">
                      <div className="w-full md:w-1/3 h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie
                                  data={[
                                    { name: 'รอด', value: stats.alive },
                                    { name: 'ตาย', value: stats.dead },
                                  ]}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                               >
                                  <Cell fill="#22c55e" />
                                  <Cell fill="#ef4444" />
                               </Pie>
                               <Tooltip />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 rounded-xl">
                          <p className="text-xs font-bold text-green-700 mb-1">กลุ่มไม้ป่า (Group A)</p>
                          <p className="text-2xl font-bold text-green-900">
                            {records.filter(r => r.species_group === 'A').length} <span className="text-xs font-normal opacity-70">ต้น</span>
                          </p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl">
                          <p className="text-xs font-bold text-orange-700 mb-1">กลุ่มไม้ผล (Group B)</p>
                          <p className="text-2xl font-bold text-orange-900">
                            {records.filter(r => r.species_group === 'B').length} <span className="text-xs font-normal opacity-70">ต้น</span>
                          </p>
                        </div>
                        <div className="md:col-span-2 flex items-start gap-3 p-4 bg-blue-50 rounded-xl text-blue-800 text-sm">
                          <AlertCircle size={20} className="shrink-0 mt-0.5" />
                          <p>ควรเร่งสำรวจพิกัดให้ครบถ้วนเพื่อวิเคราะห์การกระจายตัวของชนิดพันธุ์ในพื้นที่ คทช. แม่แจ่ม ได้อย่างแม่นยำยิ่งขึ้น</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce-short ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          <span className="text-sm font-bold">{toast.msg}</span>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes bounce-short {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -10px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.5s ease infinite alternate;
        }
      `}</style>
    </div>
  );
};

export default App;
