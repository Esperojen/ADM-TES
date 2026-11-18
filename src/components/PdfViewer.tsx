import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut, Maximize, ArrowLeft, ArrowRight, Expand } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  data: Uint8Array | null;
}

export function PdfViewer({ data }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.95);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileOptions = useMemo(() => {
    if (!data) return null;
    return { data: data };
  }, [data]);


  useEffect(() => {
    setPageNumber(1);
  }, [data]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setScale(0.95);
  }

    const handleZoomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setScale(val / 100);
    }
  };

  const fitWidth = () => {
    if (containerRef.current) {
      // Assuming a standard A4/F4 proportion which is around 595px width at 1.0 scale
      const containerWidth = containerRef.current.clientWidth - 40; // padding
      setScale(containerWidth / 595);
    }
  };

  const fitPage = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 40;
      const containerHeight = containerRef.current.clientHeight - 40;
      
      const widthScale = containerWidth / 595;
      const heightScale = containerHeight / 842; // standard A4 height
      
      setScale(Math.min(widthScale, heightScale));
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 rounded-2xl border border-slate-300">
        <div className="text-slate-400">Pilih dokumen untuk melihat pratinjau</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-300 bg-slate-200">
      
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white px-4 py-2 border-b border-slate-300 z-10 shrink-0">
        
        {/* Pagination */}
        <div className="flex items-center gap-2">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 transition-colors"
            title="Halaman Sebelumnya"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-xs font-semibold text-slate-600 min-w-[80px] text-center">
            Hal {pageNumber} / {numPages || '--'}
          </span>
          <button 
            disabled={numPages === undefined || pageNumber >= numPages}
            onClick={() => setPageNumber(p => Math.min(numPages || p, p + 1))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 transition-colors"
            title="Halaman Selanjutnya"
          >
            <ArrowRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
          <button 
            onClick={fitPage} 
            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors flex items-center gap-1 text-xs font-medium"
            title="Fit Page"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={fitWidth} 
            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors flex items-center gap-1 text-xs font-medium"
            title="Fit Width"
          >
            <Expand className="w-3.5 h-3.5" />
          </button>
          
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          
          <button 
            onClick={() => setScale(s => Math.max(0.1, s - 0.05))} 
            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
            title="Zoom Out (-5%)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input 
            type="number" 
            value={Math.round(scale * 100)} 
            onChange={handleZoomInput}
            className="w-14 text-center text-xs font-bold text-slate-700 bg-transparent border border-slate-300 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 hide-arrows"
            title="Ketik zoom"
          />
          <span className="text-xs font-bold text-slate-500 -ml-2">%</span>
          <button 
            onClick={() => setScale(s => Math.min(3.0, s + 0.05))} 
            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
            title="Zoom In (+5%)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Document Canvas */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-auto bg-slate-200/80 p-4 sm:p-6 flex justify-center items-start"
      >
        <div className="bg-white shadow-2xl rounded-sm transition-transform" style={{ transformOrigin: 'top center' }}>
          <Document 
            file={fileOptions!} 
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="p-12 text-slate-500 font-medium animate-pulse flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                Memuat Pratinjau Dokumen...
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderTextLayer={false} 
              renderAnnotationLayer={false}
              className="max-w-full"
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
