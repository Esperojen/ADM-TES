import React from 'react';
import { 
  Building2, 
  Users, 
  LayoutGrid, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Sparkles,
  Sun,
  Palette,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { SchoolMetadata, ValidationSummary, AppTheme } from '../types';

interface NavbarProps {
  metadata: SchoolMetadata;
  validation: ValidationSummary;
  totalRooms: number;
  activeTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onQuickPrint: () => void;
  onOpenBackupRestore?: () => void;
  onOpenGoogleSheetsSync?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  metadata,
  validation,
  totalRooms,
  activeTheme,
  onThemeChange,
  onQuickPrint,
  onOpenBackupRestore,
  onOpenGoogleSheetsSync
}) => {
  const themeOptions: Array<{ id: AppTheme; name: string; color: string; bg: string }> = [
    { id: 'calm_slate', name: 'Calm Slate', color: 'bg-slate-700', bg: 'bg-slate-100' },
    { id: 'warm_paper', name: 'Warm Cream', color: 'bg-amber-700', bg: 'bg-amber-50' },
    { id: 'soft_teal', name: 'Soft Teal', color: 'bg-teal-700', bg: 'bg-teal-50' },
    { id: 'subtle_indigo', name: 'Subtle Indigo', color: 'bg-indigo-700', bg: 'bg-indigo-50' }
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* School Brand & Exam Title */}
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0 ring-4 ring-slate-100">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight">
                  {metadata.namaSekolah}
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                  TP {metadata.tahunAjaran}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                <span>{metadata.namaUjian}</span>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-600">Sistem Administrasi Ruang & Denah</span>
              </p>
            </div>
          </div>

          {/* Center/Right Status Indicators & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Quick Metrics Badges (Desktop) */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white shadow-2xs font-medium text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>{validation.muridDitempatkan} / {validation.totalMurid} Murid</span>
              </div>

              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white shadow-2xs font-medium text-slate-700">
                <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                <span>{totalRooms} Ruang (32/ruang)</span>
              </div>

              <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg shadow-2xs font-medium ${
                validation.status === 'Sempurna' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {validation.status === 'Sempurna' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{validation.status}</span>
              </div>
            </div>

            {/* Google Sheets Sync Button */}
            {onOpenGoogleSheetsSync && (
              <button
                onClick={onOpenGoogleSheetsSync}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-all active:scale-98 shadow-2xs cursor-pointer"
                title="Sinkronisasi Data ke Google Sheets (Real-Time)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Google Sheets</span>
              </button>
            )}

            {/* Backup & Restore Data Quick Button */}
            {onOpenBackupRestore && (
              <button
                onClick={onOpenBackupRestore}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition-all active:scale-98 shadow-2xs cursor-pointer"
                title="Cadangkan & Pulihkan Data Proyek"
              >
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="hidden sm:inline">Cadangkan / Pulihkan</span>
              </button>
            )}

            {/* Eye-friendly Theme Dropdown / Selector */}
            <div className="relative group">
              <button 
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Tema Warna"
              >
                <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
              </button>
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 hidden group-hover:block z-50">
                <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Kenyamanan Mata
                </div>
                {themeOptions.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onThemeChange(t.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      activeTheme === t.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${t.color}`} />
                      <span>{t.name}</span>
                    </div>
                    {activeTheme === t.id && <CheckCircle2 className="w-3 h-3 text-teal-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Print All Button */}
            <button
              onClick={onQuickPrint}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-all active:scale-98 cursor-pointer"
              title="Cetak Dokumen"
            >
              <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-teal-300" />
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
