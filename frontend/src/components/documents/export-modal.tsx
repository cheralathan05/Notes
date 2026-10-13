'use client';

import React from 'react';
import { Download, FileCode, FileText, Globe, Printer, X, File } from 'lucide-react';
import { api } from '@/lib/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
}

export function ExportModal({
  isOpen,
  onClose,
  documentId,
  documentTitle,
}: ExportModalProps) {
  if (!isOpen) return null;

  const handleDownload = (format: 'markdown' | 'html' | 'txt' | 'pdf' | 'docx') => {
    const url = api.getExportUrl(documentId, format);
    window.open(url, '_blank');
    onClose();
  };

  const handlePrintPdf = () => {
    window.print();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-md rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] shadow-2xl p-6 space-y-4 animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[#FAFAFA]" />
            <h3 className="font-mono text-sm font-semibold text-[#FAFAFA] uppercase tracking-wider">
              EXPORT DOCUMENT
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#737373] hover:text-[#FAFAFA] p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-[#737373] leading-relaxed">
          Export <span className="text-[#FAFAFA] font-medium">{documentTitle}</span> into standard formats preserving headings, tables, code blocks, and checklists.
        </p>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => handleDownload('markdown')}
            className="w-full p-3 rounded-[2px] bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#404040] text-[#FAFAFA] flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileCode className="h-4 w-4 text-[#A3A3A3]" />
              <div className="text-left">
                <div className="font-medium">Markdown (.md)</div>
                <div className="text-[10px] text-[#737373]">GitHub flavored markdown</div>
              </div>
            </div>
            <span className="text-[10px] text-[#737373]">DOWNLOAD</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownload('html')}
            className="w-full p-3 rounded-[2px] bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#404040] text-[#FAFAFA] flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-[#A3A3A3]" />
              <div className="text-left">
                <div className="font-medium">HTML (.html)</div>
                <div className="text-[10px] text-[#737373]">Semantic typography & styles</div>
              </div>
            </div>
            <span className="text-[10px] text-[#737373]">DOWNLOAD</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownload('txt')}
            className="w-full p-3 rounded-[2px] bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#404040] text-[#FAFAFA] flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-[#A3A3A3]" />
              <div className="text-left">
                <div className="font-medium">Plain Text (.txt)</div>
                <div className="text-[10px] text-[#737373]">Clean ASCII representation</div>
              </div>
            </div>
            <span className="text-[10px] text-[#737373]">DOWNLOAD</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="w-full p-3 rounded-[2px] bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] hover:border-[#404040] text-[#FAFAFA] flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Printer className="h-4 w-4 text-[#A3A3A3]" />
              <div className="text-left">
                <div className="font-medium">Print to PDF</div>
                <div className="text-[10px] text-[#737373]">Vector printable monochrome layout</div>
              </div>
            </div>
            <span className="text-[10px] text-[#737373]">PRINT</span>
          </button>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#222222] flex items-center justify-between font-mono text-[10px] text-[#505050]">
          <span>CONVERSION ENGINE: NATIVE</span>
          <span>ZERO DATA LEAKAGE</span>
        </div>
      </div>
    </div>
  );
}
