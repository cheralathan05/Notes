'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, WorkspacePublic } from '@/lib/api';
import { useAuth } from './auth-context';

interface WorkspaceContextType {
  currentWorkspace: WorkspacePublic | null;
  workspaces: WorkspacePublic[];
  isLoadingWorkspaces: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, description?: string) => Promise<{ success: boolean; workspace?: WorkspacePublic; error?: string }>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspacePublic[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspacePublic | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(true);

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoadingWorkspaces(false);
      return;
    }

    try {
      setIsLoadingWorkspaces(true);
      const res = await api.listWorkspaces();
      if (res.success && res.data?.workspaces) {
        const list = res.data.workspaces;
        setWorkspaces(list);

        const storedId = api.getActiveWorkspaceId();
        const matched = storedId ? list.find((w) => w.id === storedId) : null;
        const active = matched || list.find((w) => w.isCurrent) || list[0] || null;

        if (active) {
          setCurrentWorkspace(active);
          api.setActiveWorkspaceId(active.id);
        } else {
          setCurrentWorkspace(null);
          api.setActiveWorkspaceId(null);
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces in context:', err);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [user]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    const handleWorkspaceChanged = (e: any) => {
      // Re-sync workspace list and current workspace
      refreshWorkspaces();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('kronos:workspace-changed', handleWorkspaceChanged);
      return () => window.removeEventListener('kronos:workspace-changed', handleWorkspaceChanged);
    }
  }, [refreshWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      api.setActiveWorkspaceId(target.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kronos:workspace-changed', { detail: { workspaceId: target.id } }));
      }
    }
  }, [workspaces]);

  const createWorkspace = useCallback(async (name: string, description?: string) => {
    try {
      const res = await api.createWorkspace({ name, description });
      if (res.success && res.data?.workspace) {
        await refreshWorkspaces();
        if (res.data.workspace.id) {
          switchWorkspace(res.data.workspace.id);
        }
        return { success: true, workspace: res.data.workspace };
      }
      return { success: false, error: res.error?.message || 'Failed to create workspace' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error creating workspace' };
    }
  }, [refreshWorkspaces, switchWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        isLoadingWorkspaces,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
