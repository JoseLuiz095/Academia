import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../types'

type AuthState = {
  user: User | null
  loading: boolean
  workspaces: Workspace[]
  workspace: Workspace | null
  isMaster: boolean
  selectWorkspace: (id: string) => void
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const selectedWorkspaceKey = 'academia:selected-workspace'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isMaster, setIsMaster] = useState(false)
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(selectedWorkspaceKey))

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const currentUser = userError ? null : userData.user
    setUser(currentUser)
    if (!currentUser) {
      setWorkspaces([])
      setIsMaster(false)
      setLoading(false)
      return
    }

    const [memberResult, ownedResult, masterResult] = await Promise.all([
      supabase.from('workspace_members').select('workspace_id').eq('user_id', currentUser.id),
      supabase.from('workspaces').select('id').eq('owner_id', currentUser.id),
      supabase.from('platform_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle(),
    ])
    const ids = Array.from(new Set([
      ...(memberResult.data ?? []).map((item) => item.workspace_id as string),
      ...(ownedResult.data ?? []).map((item) => item.id as string),
    ]))
    if (ids.length) {
      const { data } = await supabase.from('workspaces')
        .select('id,owner_id,name,slug,niche,description,whatsapp_number,pix_key,pix_receiver,pix_city,service_cities,published,created_at')
        .in('id', ids)
        .order('created_at', { ascending: true })
      setWorkspaces((data ?? []) as Workspace[])
    } else {
      setWorkspaces([])
    }
    setIsMaster(Boolean(masterResult.data))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  const workspace = useMemo(
    () => workspaces.find((item) => item.id === selectedId) ?? workspaces[0] ?? null,
    [workspaces, selectedId],
  )

  const selectWorkspace = (id: string) => {
    setSelectedId(id)
    localStorage.setItem(selectedWorkspaceKey, id)
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
    setUser(null)
    setWorkspaces([])
    setIsMaster(false)
  }

  return <AuthContext.Provider value={{ user, loading, workspaces, workspace, isMaster, selectWorkspace, refresh, signOut }}>
    {children}
  </AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider ausente')
  return context
}
