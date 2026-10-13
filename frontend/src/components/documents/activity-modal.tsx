'use client';

import React, { useState, useEffect } from 'react';
import { Activity, X, User, Clock, FileCheck } from 'lucide-react';
import { api, ActivityItem } from '@/lib/api';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
}

export function ActivityModal({ isOpen, onClose, documentId }: ActivityModalProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getDocumentActivity(documentId).then((res) => {
        if (res.success && res.data?.activities) {
          setActivities(res.data.activities);
        }
        setLoading(false);
      });
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="w-full max-w-lg rounded-[var(--radius-sm)] bg-[#101010] border border-[#2D2D2D] shadow-2xl p-6 space-y-4 animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#FAFAFA]" />
            <h3 className="font-mono text-sm font-semibold text-[#FAFAFA] uppercase tracking-wider">
              DOCUMENT ACTIVITY AUDIT
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#737373] hover:text-[#FAFAFA] p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2 font-mono text-xs">
          {loading ? (
            <div className="py-8 text-center text-[#737373] animate-pulse">
              RETRIEVING ACTIVITY LOG...
            </div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center text-[#505050]">
              NO ACTIVITY RECORDED
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="p-2.5 rounded-[2px] bg-[#141414] border border-[#222222] flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#FAFAFA] uppercase text-[11px]">
                      {act.action}
                    </span>
                    <span className="text-[10px] text-[#737373]">
                      BY {act.user?.displayName || 'OPERATOR'}
                    </span>
                  </div>
                  {act.metadata?.title && (
                    <p className="text-[11px] text-[#A3A3A3]">
                      Title: &quot;{act.metadata.title}&quot;
                    </p>
                  )}
                  {act.metadata?.version && (
                    <p className="text-[10px] text-[#505050]">
                      Incremented to OCC Version {act.metadata.version}
                    </p>
                  )}
                </div>

                <div className="text-[10px] text-[#505050] flex-shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(act.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-[#222222] flex items-center justify-between font-mono text-[10px] text-[#505050]">
          <span>IMMUTABLE AUDIT TRAIL</span>
          <span>POSTGRESQL LOGGED</span>
        </div>
      </div>
    </div>
  );
}
