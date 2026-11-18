import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Smartphone, 
  Laptop, 
  Share2, 
  LogOut, 
  Clock, 
  Database, 
  Sparkles, 
  ShieldCheck,
  Check,
  Link2,
  Unlink
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, googleSignOut, getAccessToken } from '../services/googleAuth';
import { createExamSpreadsheet, syncExamDataToSpreadsheet, SyncResult } from '../services/googleSheetsService';
import { SchoolMetadata, Student, Room } from '../types';
import { db } from '../db/db';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: SchoolMetadata;
  students: Student[];
  rooms: Room[];
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Check if raw ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  metadata,
  students,
  rooms
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Custom link state
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Load existing spreadsheet ID from db settings on open
  useEffect(() => {
    async function loadSavedConfig() {
      const idSetting = await db.appSettings.get('googleSpreadsheetId');
      const urlSetting = await db.appSettings.get('googleSpreadsheetUrl');
      const timeSetting = await db.appSettings.get('googleSpreadsheetLastSync');

      if (idSetting?.value) setSpreadsheetId(idSetting.value);
      if (urlSetting?.value) setSpreadsheetUrl(urlSetting.value);
      if (timeSetting?.value) setLastSyncTime(timeSetting.value);
    }

    if (isOpen) {
      loadSavedConfig();
    }
  }, [isOpen]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, _token) => {
        setCurrentUser(user);
      },
      () => {
        // Not authenticated
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    setErrorMessage('');
    try {
      const res = await googleSignIn();
      setCurrentUser(res.user);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal masuk dengan akun Google.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setCurrentUser(null);
  };

  const handleLinkCustomSpreadsheet = async () => {
    setErrorMessage('');
    if (!customUrlInput.trim()) {
      setErrorMessage('Silakan tempel tautan (URL) atau ID Google Spreadsheet terlebih dahulu.');
      return;
    }

    const extractedId = extractSpreadsheetId(customUrlInput);
    if (!extractedId || extractedId.length < 15) {
      setErrorMessage('Format tautan atau ID Google Spreadsheet tidak valid.');
      return;
    }

    setIsLinking(true);
    try {
      let activeToken = await getAccessToken();
      if (!activeToken) {
        const signRes = await googleSignIn();
        setCurrentUser(signRes.user);
        activeToken = signRes.accessToken;
      }

      if (activeToken) {
        // Quick verification: check if we can fetch spreadsheet info
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${extractedId}?fields=properties.title`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || 'Tidak dapat mengakses spreadsheet tersebut. Pastikan akun Google Anda memiliki izin edit.');
        }
        const sheetData = await res.json();
        setSyncStatusMsg(`Berhasil terhubung ke spreadsheet: "${sheetData.properties?.title || 'Google Sheet'}"`);
      }

      const targetUrl = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
      setSpreadsheetId(extractedId);
      setSpreadsheetUrl(targetUrl);
      await db.appSettings.put({ key: 'googleSpreadsheetId', value: extractedId });
      await db.appSettings.put({ key: 'googleSpreadsheetUrl', value: targetUrl });
      setShowLinkInput(false);
      setCustomUrlInput('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal menautkan spreadsheet.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkSpreadsheet = async () => {
    const confirm = window.confirm('Lepaskan tautan spreadsheet ini? Data di spreadsheet tidak akan terhapus.');
    if (!confirm) return;
    setSpreadsheetId('');
    setSpreadsheetUrl('');
    setLastSyncTime('');
    await db.appSettings.delete('googleSpreadsheetId');
    await db.appSettings.delete('googleSpreadsheetUrl');
    await db.appSettings.delete('googleSpreadsheetLastSync');
    setSyncStatusMsg('Tautan spreadsheet berhasil dilepaskan.');
  };

  const handleStartSync = async () => {
    setErrorMessage('');
    setSyncStatusMsg('');

    // Require token
    const token = await getAccessToken();
    if (!token) {
      // Prompt user to sign in
      try {
        await handleSignIn();
      } catch {
        return;
      }
    }

    // Explicit user confirmation before writing to Google Sheets
    const confirmed = window.confirm(
      `Sinkronkan seluruh data ujian ke Google Sheets?\n\n` +
      `• Sekolah: ${metadata.namaSekolah}\n` +
      `• Total Siswa: ${students.length} Peserta\n` +
      `• Total Ruang: ${rooms.length} Ruangan\n\n` +
      `Data akan dibuatkan/diperbarui pada Google Spreadsheet Anda di Google Drive.`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    try {
      let targetId = spreadsheetId;
      let targetUrl = spreadsheetUrl;

      // 1. If no spreadsheet created yet, create one
      if (!targetId) {
        setSyncStatusMsg('Membuat Google Spreadsheet baru di Google Drive...');
        const title = `Data Ruang & Denah Ujian - ${metadata.namaSekolah || 'Sekolah'} (${metadata.tahunAjaran || '2026/2027'})`;
        const created = await createExamSpreadsheet(title);
        targetId = created.spreadsheetId;
        targetUrl = created.spreadsheetUrl;
        
        setSpreadsheetId(targetId);
        setSpreadsheetUrl(targetUrl);
        await db.appSettings.put({ key: 'googleSpreadsheetId', value: targetId });
        await db.appSettings.put({ key: 'googleSpreadsheetUrl', value: targetUrl });
      }

      // 2. Sync all tables
      setSyncStatusMsg('Menulis data peserta, denah ruangan, dan jadwal ujian ke Spreadsheet...');
      const result: SyncResult = await syncExamDataToSpreadsheet({
        spreadsheetId: targetId,
        metadata,
        students,
        rooms
      });

      setLastSyncTime(result.syncedAt);
      await db.appSettings.put({ key: 'googleSpreadsheetLastSync', value: result.syncedAt });
      setSyncStatusMsg(`Berhasil disinkronkan pada ${result.syncedAt}!`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyinkronkan ke Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyLink = () => {
    if (spreadsheetUrl) {
      navigator.clipboard.writeText(spreadsheetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-wide">Sinkronisasi Google Sheets</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Cloud Live
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Hubungkan dan buka data denah & ruang ujian secara real-time di HP, tablet, atau laptop manapun
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Section 1: Google Account Authentication */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-300 overflow-hidden">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    currentUser.displayName?.charAt(0) || 'G'
                  )}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-slate-500" />
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  {currentUser ? currentUser.displayName || 'Akun Google Terhubung' : 'Akun Google Belum Terhubung'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {currentUser ? currentUser.email : 'Masuk untuk mengizinkan pembuatan & sinkronisasi Google Sheets'}
                </span>
              </div>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar
              </button>
            ) : (
              /* Official Google Sign In Button */
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isLoadingAuth}
                className="inline-flex items-center justify-center gap-2.5 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg shadow-2xs hover:shadow-xs transition-all active:scale-98 cursor-pointer self-start sm:self-auto"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{isLoadingAuth ? 'Menghubungkan...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>

          {/* Section 2: Active Data & Status Card */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950">Data yang Siap Disinkronkan</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                {metadata.namaSekolah}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80">
                <span className="text-[10px] text-slate-400 block font-medium">Total Murid</span>
                <strong className="text-sm text-slate-800 font-bold">{students.length} Siswa</strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80">
                <span className="text-[10px] text-slate-400 block font-medium">Total Ruang</span>
                <strong className="text-sm text-slate-800 font-bold">{rooms.length} Ruang</strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80">
                <span className="text-[10px] text-slate-400 block font-medium">Jadwal Sesi</span>
                <strong className="text-sm text-slate-800 font-bold">
                  {metadata.jadwalUjian?.length || 0} Hari Ujian
                </strong>
              </div>
            </div>

            {lastSyncTime && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium pt-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terakhir diperbarui: <strong>{lastSyncTime}</strong></span>
              </div>
            )}
          </div>

          {/* Section 3: Spreadsheet Target Link & Custom Link Input */}
          {spreadsheetUrl && !showLinkInput ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Google Spreadsheet Aktif Terhubung
                </span>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  Tersimpan di Google Drive
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={spreadsheetUrl}
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 select-all font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                </button>
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Buka Sheet</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowLinkInput(true)}
                  className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Tautkan ke Spreadsheet Lain</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnlinkSpreadsheet}
                  className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Lepaskan Sambungan</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Tautkan ke Google Spreadsheet Anda
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Tempel URL atau ID Google Spreadsheet yang sudah Anda buat sebelumnya
                    </span>
                  </div>
                </div>

                {spreadsheetUrl && (
                  <button
                    type="button"
                    onClick={() => setShowLinkInput(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLinkCustomSpreadsheet();
                    }
                  }}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleLinkCustomSpreadsheet}
                  disabled={isLinking || !customUrlInput.trim()}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  {isLinking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menautkan...</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Tautkan Spreadsheet</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-500">
                💡 <em>Tip:</em> Pastikan izin berbagi (Share) spreadsheet mengizinkan akun Google yang Anda gunakan untuk mengedit. Jika belum punya berkas, Anda juga bisa langsung menekan tombol hijau di bawah untuk membuat berkas baru secara otomatis.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sync Status / Progress Message */}
          {syncStatusMsg && !errorMessage && (
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-2 text-xs text-teal-900 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          {/* Action Button: Sync Now */}
          <button
            type="button"
            onClick={handleStartSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.99] cursor-pointer"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyinkronkan ke Google Sheets...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>
                  {spreadsheetId ? 'Sinkronkan Pembaruan ke Google Sheets Sekarang' : 'Buat & Sinkronkan ke Google Sheets'}
                </span>
              </>
            )}
          </button>

          {/* Section 4: Panduan Langkah Membuka di Semua Device */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-teal-600" />
              Cara Membuka & Memantau Data di Perangkat Apapun (HP / Tablet / Laptop)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] text-slate-600">
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> 1. Di HP / Smartphone
                </span>
                <p>
                  Buka aplikasi <strong>Google Sheets</strong> di Android/iPhone dengan akun Google Anda. File spreadsheet akan otomatis muncul di halaman depan.
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block flex items-center gap-1">
                  <Laptop className="w-3.5 h-3.5 text-teal-600" /> 2. Di Laptop / PC Lain
                </span>
                <p>
                  Buka tautan Google Spreadsheet melalui browser Chrome/Firefox/Edge. Anda dapat mencetak denah atau mengunduh Excel (.xlsx).
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block flex items-center gap-1">
                  <Share2 className="w-3.5 h-3.5 text-indigo-600" /> 3. Berbagi ke Pengawas
                </span>
                <p>
                  Klik tombol <strong>"Bagikan / Share"</strong> pada Google Spreadsheet untuk memberikan hak akses lihat (Viewer) kepada seluruh panitia & pengawas.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Integrasi Resmi Google Workspace API</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
